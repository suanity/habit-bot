import { webhookSecret } from '../lib/secret.js';

const SUPABASE_URL = 'https://ivmdbkukjvxzoazcicet.supabase.co';
// Серверный ключ Supabase (secret / service_role). Хранится только в переменных окружения Vercel.
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY;

const supa = (path, opts = {}) =>
  fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...opts,
    headers: {
      apikey: SUPABASE_KEY,
      // legacy service_role — JWT, новый secret key (sb_secret_...) передаётся только в apikey
      ...(SUPABASE_KEY && SUPABASE_KEY.startsWith('eyJ') ? { Authorization: `Bearer ${SUPABASE_KEY}` } : {}),
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
  });

const tg = (method, body) =>
  fetch(`https://api.telegram.org/bot${process.env.BOT_TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

// Берёт свободный код атомарно: пометка used проходит только если код всё ещё свободен.
async function sendCode(chatId) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const r = await supa('codes?used=eq.false&limit=1&select=code');
    const rows = await r.json();
    if (!Array.isArray(rows) || !rows.length) {
      await tg('sendMessage', { chat_id: chatId, text: '⚠️ Коды закончились. Свяжись с автором.' });
      return null;
    }
    const code = rows[0].code;
    const claim = await supa(`codes?code=eq.${encodeURIComponent(code)}&used=eq.false`, {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ used: true, chat_id: chatId }),
    });
    const claimed = await claim.json();
    if (Array.isArray(claimed) && claimed.length) return code;
  }
  return null;
}

async function registerNotify(chatId, code) {
  const c = await supa(`codes?code=eq.${encodeURIComponent(code)}&select=chat_id`);
  const codeRows = await c.json();
  if (!Array.isArray(codeRows) || !codeRows.length) {
    await tg('sendMessage', { chat_id: chatId, text: '❌ Код не найден.' });
    return;
  }
  const owner = codeRows[0].chat_id;
  if (owner && String(owner) !== String(chatId)) {
    await tg('sendMessage', { chat_id: chatId, text: '❌ Этот код выдан другому аккаунту.' });
    return;
  }
  const r = await supa(`user_data?code=eq.${encodeURIComponent(code)}&select=code`);
  const rows = await r.json();
  if (!Array.isArray(rows) || !rows.length) {
    await tg('sendMessage', {
      chat_id: chatId,
      text: '❌ Код ещё не активирован. Сначала открой приложение и активируй его — потом напиши /notify.',
    });
    return;
  }
  await supa(`user_data?code=eq.${encodeURIComponent(code)}`, {
    method: 'PATCH',
    body: JSON.stringify({ chat_id: chatId }),
  });
  await tg('sendMessage', {
    chat_id: chatId,
    text: '✅ Уведомления подключены!\nКаждый вечер в 21:00 буду напоминать заполнить день.',
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(200).send('ok');
    return;
  }

  // Проверка подписи Telegram: без неё любой может подделать апдейт от имени администратора.
  // Подпись выводится из BOT_TOKEN; вебхук регистрируется страницей /api/setup.
  if (!process.env.BOT_TOKEN || req.headers['x-telegram-bot-api-secret-token'] !== webhookSecret()) {
    res.status(401).send('unauthorized');
    return;
  }

  const body = req.body;
  const msg = body?.message;
  if (!msg) {
    res.status(200).send('ok');
    return;
  }

  const chatId = msg.chat.id;
  const text = (msg.text || '').trim();
  const username = msg.from?.username || msg.from?.first_name || 'пользователь';
  const ADMIN_ID = process.env.ADMIN_ID;
  const APP_URL = process.env.APP_URL || 'https://suanity.github.io/habit-rpg';
  // Подпись уже проверена выше, поэтому chat.id в апдейте можно считать подлинным.
  const isAdmin = Boolean(ADMIN_ID) && String(chatId) === String(ADMIN_ID);

  if (text === '/start') {
    await tg('sendMessage', {
      chat_id: chatId,
      text: `👋 Привет, ${username}!\n\nHabit RPG — прокачка реальной жизни в стиле RPG. Ставишь галочки, получаешь XP, качаешь уровень.\n\n💳 Купить доступ → /buy\n🔔 Подключить уведомления → /notify КОД`,
    });
  } else if (text === '/buy') {
    await supa('pending', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates' },
      body: JSON.stringify({ chat_id: chatId, username }),
    });
    await tg('sendMessage', {
      chat_id: chatId,
      text: `💳 Стоимость: 500 ₽\n\nПереведи на карту и пришли скриншот оплаты сюда.\n\nКак подтвержу — сразу пришлю код активации 🚀`,
    });
    if (ADMIN_ID) {
      await tg('sendMessage', {
        chat_id: ADMIN_ID,
        text: `🛒 Новый запрос!\n\n👤 @${username}\n🆔 ${chatId}\n\nОтправь: /approve ${chatId}`,
      });
    }
  } else if (text.startsWith('/approve') && isAdmin) {
    const targetId = parseInt(text.split(' ')[1]);
    if (!targetId) {
      await tg('sendMessage', { chat_id: chatId, text: 'Использование: /approve <chat_id>' });
    } else {
      const code = await sendCode(targetId);
      if (code) {
        await tg('sendMessage', {
          chat_id: targetId,
          text: `✅ Оплата подтверждена!\n\nТвой код:\n\`${code}\`\n\nОткрой приложение и введи код:\n${APP_URL}\n\nПосле активации напиши:\n/notify ${code}`,
          parse_mode: 'Markdown',
        });
        await tg('sendMessage', { chat_id: chatId, text: `✅ Код отправлен → ${targetId}` });
        await supa(`pending?chat_id=eq.${targetId}`, { method: 'DELETE' });
      }
    }
  } else if (text.startsWith('/notify')) {
    const code = text.split(' ')[1]?.trim().toUpperCase();
    if (!code) {
      await tg('sendMessage', {
        chat_id: chatId,
        text: 'Использование: /notify HRPG-XXXX-XXXX-XXXX',
      });
    } else {
      await registerNotify(chatId, code);
    }
  } else if (text === '/pending' && isAdmin) {
    const r = await supa('pending?select=chat_id,username,created_at&order=created_at');
    const rows = await r.json();
    if (!Array.isArray(rows) || !rows.length) {
      await tg('sendMessage', { chat_id: chatId, text: '📭 Нет ожидающих.' });
    } else {
      const list = rows.map(r => `@${r.username} → /approve ${r.chat_id}`).join('\n');
      await tg('sendMessage', { chat_id: chatId, text: `📋 Ожидают:\n\n${list}` });
    }
  } else if (text === '/codes' && isAdmin) {
    const r = await supa('codes?used=eq.false&select=code');
    const rows = await r.json();
    await tg('sendMessage', { chat_id: chatId, text: `🔑 Свободных кодов: ${Array.isArray(rows) ? rows.length : 0}` });
  }

  res.status(200).send('ok');
}
