import { supa } from '../lib/supa.js';

const MESSAGES = [
  'Ты успел все квесты выполнить сегодня?',
  'День идёт. XP сами себя не заработают.',
  'Не дай стрику оборваться. Зайди и отметь.',
  'Сегодняшний день ещё можно спасти.',
  'Твой персонаж ждёт. Квесты не закрыты.',
  'Один день без отметки — и стрик сгорит.',
  'Зайди, отметь задания. Это займёт 10 секунд.',
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
  const reply_markup = { inline_keyboard: [[{ text: 'Войти в Мир', web_app: { url: APP_URL } }]] };

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
