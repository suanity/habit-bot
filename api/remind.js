const SUPABASE_URL = 'https://ivmdbkukjvxzoazcicet.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml2bWRia3VranZ4em9hemNpY2V0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcwMTk5OTgsImV4cCI6MjA5MjU5NTk5OH0.0--m60cy6Ppz3_TC1-aX8sBG1ibyqHWE-ozR4y0zZM8';

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
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('unauthorized', { status: 401 });
  }

  const r = await fetch(
    `${SUPABASE_URL}/rest/v1/user_data?chat_id=not.is.null&select=chat_id`,
    { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
  );
  const rows = await r.json();

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
