const SUPABASE_URL = 'https://ivmdbkukjvxzoazcicet.supabase.co';
// Серверный ключ Supabase (secret / service_role). Хранится только в переменных окружения Vercel.
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY;

const MESSAGES = [
  '⚔️ Ты успел все квесты выполнить сегодня?',
  '🔥 День идёт. XP сами себя не заработают.',
  '💀 Не дай стрику оборваться. Зайди и отметь.',
  '🗡️ Сегодняшний день ещё можно спасти.',
  '⚡ Твой персонаж ждёт. Квесты не закрыты.',
  '🏆 Один день без отметки — и стрик сгорит.',
  '🎯 Зайди, отметь задания. Это займёт 10 секунд.',
];

export default async function handler(req) {
  const auth = req.headers.get('authorization');
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('unauthorized', { status: 401 });
  }

  const r = await fetch(
    `${SUPABASE_URL}/rest/v1/user_data?chat_id=not.is.null&select=chat_id`,
    {
      headers: {
        apikey: SUPABASE_KEY,
        ...(SUPABASE_KEY && SUPABASE_KEY.startsWith('eyJ') ? { Authorization: `Bearer ${SUPABASE_KEY}` } : {}),
      },
    }
  );
  const rows = await r.json();
  if (!Array.isArray(rows)) {
    return new Response('db error', { status: 502 });
  }

  // каждый день разное сообщение
  const dayIndex = new Date().getDay();
  const text = MESSAGES[dayIndex % MESSAGES.length];

  let sent = 0;
  for (const row of rows) {
    await fetch(`https://api.telegram.org/bot${process.env.BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: row.chat_id, text }),
    });
    sent++;
  }

  return new Response(`Отправлено: ${sent}`);
}
