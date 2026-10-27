import { supa } from '../lib/supa.js';

const MESSAGES = [
  'Сегодняшние квесты ещё не закрыты. Лобби ждёт.',
  'День идёт. XP сами себя не заработают.',
  'Серия держится на одном квесте. Закрой хотя бы один.',
  'Сегодняшний день ещё можно спасти.',
  'Другие игроки уже в деле. Твоя очередь.',
  'Один квест — и день засчитан. Это займёт пару минут.',
  'NPC откладывает. Игрок заходит и закрывает квест.',
];

export default async function handler(req) {
  const auth = req.headers.get('authorization');
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('unauthorized', { status: 401 });
  }

  const r = await supa('tg_links?select=tg_id&limit=2000');
  const rows = await r.json();
  if (!Array.isArray(rows)) {
    return new Response('db error', { status: 502 });
  }

  // каждый день разное сообщение
  const dayIndex = new Date().getDay();
  const text = MESSAGES[dayIndex % MESSAGES.length];
  const APP_URL = process.env.APP_URL || 'https://suanity.github.io/habit-rpg';
  const reply_markup = { inline_keyboard: [[{ text: 'Войти в лобби', web_app: { url: APP_URL } }]] };

  let sent = 0;
  for (const row of rows) {
    const t = await fetch(`https://api.telegram.org/bot${process.env.BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: row.tg_id, text, reply_markup }),
    }).catch(() => null);
    if (t && t.ok) sent++;
  }

  return new Response(`Отправлено: ${sent}`);
}
