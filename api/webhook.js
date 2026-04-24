const SUPABASE_URL = 'https://ivmdbkukjvxzoazcicet.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml2bWRia3VranZ4em9hemNpY2V0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcwMTk5OTgsImV4cCI6MjA5MjU5NTk5OH0.0--m60cy6Ppz3_TC1-aX8sBG1ibyqHWE-ozR4y0zZM8';

const supa = (path, opts = {}) =>
  fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...opts,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
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

async function sendCode(chatId) {
  const r = await supa('codes?used=eq.false&limit=1&select=code');
  const rows = await r.json();
  if (!rows.length) {
    await tg('sendMessage', { chat_id: chatId, text: '⚠️ Коды закончились. Свяжись с автором.' });
    return null;
  }
  const code = rows[0].code;
  await supa(`codes?code=eq.${encodeURIComponent(code)}`, {
    method: 'PATCH',
    body: JSON.stringify({ used: true, chat_id: chatId }),
  });
  return code;
}

async function registerNotify(chatId, code) {
  const r = await supa(`user_data?code=eq.${encodeURIComponent(code)}&select=code`);
  const rows = await r.json();
  if (!rows.length) {
    await tg('sendMessage', {
      chat_id: chatId,
      text: '❌ Код не найден. Сначала открой приложение и активируй его — потом напиши /notify.',
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
  const APP_URL = process.env.APP_URL || 'https://ссылка-на-приложение';

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
  } else if (text.startsWith('/approve') && String(chatId) === String(ADMIN_ID)) {
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
  } else if (text === '/pending' && String(chatId) === String(ADMIN_ID)) {
    const r = await supa('pending?select=chat_id,username,created_at&order=created_at');
    const rows = await r.json();
    if (!rows.length) {
      await tg('sendMessage', { chat_id: chatId, text: '📭 Нет ожидающих.' });
    } else {
      const list = rows.map(r => `@${r.username} → /approve ${r.chat_id}`).join('\n');
      await tg('sendMessage', { chat_id: chatId, text: `📋 Ожидают:\n\n${list}` });
    }
  } else if (text === '/codes' && String(chatId) === String(ADMIN_ID)) {
    const r = await supa('codes?used=eq.false&select=code');
    const rows = await r.json();
    await tg('sendMessage', { chat_id: chatId, text: `🔑 Свободных кодов: ${rows.length}` });
  }

  res.status(200).send('ok');
}
