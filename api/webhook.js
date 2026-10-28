import { webhookSecret } from '../lib/secret.js';
import { parseDrop, parseHide, parseSkin, moscowDay, DROP_USAGE, BOSS_USAGE, SKIN_USAGE, SKIN_NAMES, HELP_ADMIN } from '../lib/drop.js';
import { supa } from '../lib/supa.js';

const tg = (method, body) =>
  fetch(`https://api.telegram.org/bot${process.env.BOT_TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

const openButton = (url, text = 'Войти в лобби') => ({
  inline_keyboard: [[{ text, web_app: { url } }]],
});

// Выдаёт доступ атомарно на стороне базы: свободный код привязывается к Telegram-аккаунту.
async function grantAccess(tgId) {
  const r = await supa('rpc/grant_access', { method: 'POST', body: JSON.stringify({ p_tg_id: tgId }) });
  if (!r.ok) return null;
  const code = await r.json();
  return typeof code === 'string' ? code : null;
}

// Рассылка подписчикам пачками по 20, возвращает {sent, total}.
async function broadcast(note, markup) {
  const sr = await supa('tg_links?select=tg_id&limit=500');
  const subs = await sr.json();
  const ids = Array.isArray(subs) ? [...new Set(subs.map(s => String(s.tg_id)))] : [];
  let sent = 0;
  for (let i = 0; i < ids.length; i += 20) {
    const part = await Promise.all(
      ids.slice(i, i + 20).map(id =>
        tg('sendMessage', { chat_id: id, text: note, reply_markup: markup }).then(r => r.ok).catch(() => false)
      )
    );
    sent += part.filter(Boolean).length;
  }
  return { sent, total: ids.length };
}

async function isLinked(tgId) {
  const r = await supa(`tg_links?tg_id=eq.${tgId}&select=tg_id&limit=1`);
  const rows = await r.json();
  return Array.isArray(rows) && rows.length > 0;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(200).send('ok');
    return;
  }

  // Проверка подписи Telegram: без неё любой может подделать апдейт от имени администратора.
  // Подпись выводится из BOT_TOKEN; вебхук уже зарегистрирован в Telegram.
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

  if (/^\/start(@\w+)?(\s|$)/.test(text)) {
    if (await isLinked(chatId)) {
      await tg('sendMessage', {
        chat_id: chatId,
        text: `С возвращением, ${username}. Квесты дня ждут в лобби.`,
        reply_markup: openButton(APP_URL),
      });
    } else {
      await tg('sendMessage', {
        chat_id: chatId,
        text: `NO NPC. Мультиплеер из твоей реальной жизни.\n\nЕжедневные квесты на тело, разум, волю, влияние и деньги. Ранги, серии, рейтинг недели и другие игроки рядом.\n\nПолучить доступ → /buy`,
      });
    }
  } else if (text === '/buy') {
    const pr = await supa(`pending?chat_id=eq.${chatId}&select=chat_id&limit=1`);
    const already = await pr.json().catch(() => []);
    const isNew = !(Array.isArray(already) && already.length);
    await supa('pending', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates' },
      body: JSON.stringify({ chat_id: chatId, username }),
    });
    await tg('sendMessage', {
      chat_id: chatId,
      text: `Стоимость: 500 ₽\n\nПереведи на карту и пришли скриншот оплаты сюда.\n\nПосле подтверждения доступ откроется автоматически.`,
    });
    if (ADMIN_ID && isNew) {
      await tg('sendMessage', {
        chat_id: ADMIN_ID,
        text: `Новый запрос\n\n@${username}\n${chatId}\n\n/approve ${chatId}`,
      });
    }
  } else if (text.startsWith('/approve') && isAdmin) {
    const targetId = parseInt(text.split(' ')[1]);
    if (!targetId) {
      await tg('sendMessage', { chat_id: chatId, text: 'Использование: /approve <chat_id>' });
    } else {
      const code = await grantAccess(targetId);
      if (code) {
        await tg('sendMessage', {
          chat_id: targetId,
          text: 'Оплата подтверждена. Лобби открыто. Жми кнопку, выбирай героя и забирай первый квест.',
          reply_markup: openButton(APP_URL),
        });
        await tg('sendMessage', { chat_id: chatId, text: `Доступ открыт → ${targetId}` });
        await supa(`pending?chat_id=eq.${targetId}`, { method: 'DELETE' });
      } else {
        await tg('sendMessage', { chat_id: chatId, text: 'Не удалось выдать доступ: свободные коды закончились.' });
      }
    }
  } else if (text === '/pending' && isAdmin) {
    const r = await supa('pending?select=chat_id,username,created_at&order=created_at');
    const rows = await r.json();
    if (!Array.isArray(rows) || !rows.length) {
      await tg('sendMessage', { chat_id: chatId, text: 'Нет ожидающих.' });
    } else {
      const list = rows.map(r => `@${r.username} → /approve ${r.chat_id}`).join('\n');
      await tg('sendMessage', { chat_id: chatId, text: `Ожидают:\n\n${list}` });
    }
  } else if (/^\/drop(@\w+)?(\s|$)/.test(text) && isAdmin) {
    const p = parseDrop(text);
    if (p.error) {
      await tg('sendMessage', { chat_id: chatId, text: DROP_USAGE });
    } else {
      const day = moscowDay();
      const ins = await supa('world_quests', {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify({
          title: p.title, descr: p.descr, stat: p.stat, xp: p.xp,
          kind: 'daily', day_from: day, day_to: day, source: 'drop',
        }),
      });
      const created = await ins.json();
      if (!ins.ok || !Array.isArray(created) || !created.length) {
        await tg('sendMessage', { chat_id: chatId, text: 'Не удалось создать квест.' });
      } else {
        const note = `Новый квест в лобби\n${p.stat} +${p.xp} XP\n${p.title}`;
        const markup = openButton(`${APP_URL}?q=${created[0].id}`, 'Открыть квест');
        const { sent, total: ids } = await broadcast(note, markup);
        await tg('sendMessage', { chat_id: chatId, text: `Квест #${created[0].id} выпущен на ${day}. Уведомлено: ${sent}/${ids}` });
      }
    }
  } else if (/^\/boss(@\w+)?(\s|$)/.test(text) && isAdmin) {
    const p = parseDrop(text, 'boss');
    if (p.error) {
      await tg('sendMessage', { chat_id: chatId, text: BOSS_USAGE });
    } else {
      const r = await supa('rpc/admin_set_boss', {
        method: 'POST',
        body: JSON.stringify({ p_title: p.title, p_descr: p.descr, p_stat: p.stat, p_xp: p.xp }),
      });
      const out = r.ok ? await r.json().catch(() => null) : null;
      if (!out || !out.ok) {
        const why = out && out.error === 'has_claims'
          ? 'Босса недели уже закрыли игроки. Заменить нельзя, сделай это со следующей недели.'
          : 'Не удалось поставить босса.';
        await tg('sendMessage', { chat_id: chatId, text: why });
      } else {
        const note = `Босс недели\n${p.stat} +${p.xp} XP\n${p.title}`;
        const { sent, total } = await broadcast(note, openButton(`${APP_URL}?q=${out.id}`, 'Открыть босса'));
        await tg('sendMessage', { chat_id: chatId, text: `Босс #${out.id} поставлен на неделю с ${out.week_start}. Уведомлено: ${sent}/${total}` });
      }
    }
  } else if (/^\/(un)?hide(@\w+)?(\s|$)/.test(text) && isAdmin) {
    const p = parseHide(text);
    if (!p) {
      await tg('sendMessage', { chat_id: chatId, text: 'Использование: /hide ПОЗЫВНОЙ или /unhide ПОЗЫВНОЙ' });
    } else {
      const r = await supa(`players?nick=eq.${encodeURIComponent(p.nick)}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify({ hidden: p.hide }),
      });
      const rows = r.ok ? await r.json().catch(() => []) : [];
      await tg('sendMessage', {
        chat_id: chatId,
        text: Array.isArray(rows) && rows.length ? `${p.nick}: ${p.hide ? 'скрыт из рейтинга и лобби' : 'снова виден'}` : 'Игрок с таким позывным не найден.',
      });
    }
  } else if (/^\/(un)?skin(@\w+)?(\s|$)/.test(text) && isAdmin) {
    const p = parseSkin(text);
    if (!p) {
      await tg('sendMessage', { chat_id: chatId, text: SKIN_USAGE });
    } else {
      const pr = await supa(`players?nick=eq.${encodeURIComponent(p.nick)}&select=code,nick&limit=1`);
      const prow = pr.ok ? await pr.json().catch(() => []) : [];
      if (!Array.isArray(prow) || !prow.length) {
        await tg('sendMessage', { chat_id: chatId, text: 'Игрок с таким позывным не найден.' });
      } else {
        const fn = p.grant ? 'admin_grant_item' : 'admin_revoke_item';
        const r = await supa(`rpc/${fn}`, { method: 'POST', body: JSON.stringify({ p_code: prow[0].code, p_item: p.id }) });
        const out = r.ok ? await r.json().catch(() => null) : null;
        if (!out || !out.ok) {
          const why = { already_owned: `Уже выдан (№${out && out.serial}).`, sold_out: 'Тираж закончился.', not_owned: 'У игрока нет этого скина.' }[out && out.error] || 'Не удалось.';
          await tg('sendMessage', { chat_id: chatId, text: why });
        } else if (p.grant) {
          await tg('sendMessage', { chat_id: chatId, text: `${SKIN_NAMES[p.id]} #${out.serial} из ${out.max} выдан: ${prow[0].nick}` });
          const lr = await supa(`tg_links?code=eq.${prow[0].code}&select=tg_id&limit=1`);
          const lrow = lr.ok ? await lr.json().catch(() => []) : [];
          if (Array.isArray(lrow) && lrow.length) {
            await tg('sendMessage', {
              chat_id: lrow[0].tg_id,
              text: `Тебе выдан эксклюзивный скин ${SKIN_NAMES[p.id]} #${out.serial} из ${out.max}.\nОн в редакторе героя, вкладка СКИНЫ.`,
              reply_markup: openButton(APP_URL, 'Надеть'),
            }).catch(() => {});
          }
        } else {
          await tg('sendMessage', { chat_id: chatId, text: `${SKIN_NAMES[p.id]} забран у ${prow[0].nick}. Номер издания не освобождается.` });
        }
      }
    }
  } else if (text === '/skins' && isAdmin) {
    const r = await supa('skin_catalog?select=item_id,name,issued,max_serial&order=item_id');
    const rows = r.ok ? await r.json().catch(() => []) : [];
    await tg('sendMessage', { chat_id: chatId, text: Array.isArray(rows) && rows.length ? rows.map(x => `${x.item_id} ${x.name}: ${x.issued}/${x.max_serial}`).join('\n') : 'Каталог пуст.' });
  } else if (/^\/help(@\w+)?$/.test(text) && isAdmin) {
    await tg('sendMessage', { chat_id: chatId, text: HELP_ADMIN });
  } else if (text === '/codes' && isAdmin) {
    const r = await supa('codes?used=eq.false&select=code');
    const rows = await r.json();
    await tg('sendMessage', { chat_id: chatId, text: `Свободных мест: ${Array.isArray(rows) ? rows.length : 0}` });
  }

  res.status(200).send('ok');
}
