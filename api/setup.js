import { webhookSecret } from '../lib/secret.js';

const APP_URL = process.env.APP_URL || 'https://suanity.github.io/habit-rpg';
const WEBHOOK_URL = process.env.WEBHOOK_URL || 'https://habit-bot-nu.vercel.app/api/webhook';

const DESCRIPTION =
  'С этого дня ты не NPC. Входи в этот мир с двух ног и начни менять то, что долго откладывал. Теперь ты в лобби с другими: покажи, что ты умеешь не только говорить, но и делать. Жми «ВОЙТИ» и пусть сегодняшняя твоя версия сделает для твоей будущей чуть больше. Добро пожаловать!';
const SHORT_DESCRIPTION = 'Добро пожаловать в лобби. Твой главный конкурент — не люди вокруг, а вчерашний ты.';

// Регистрирует вебхук Telegram с подписью. Идемпотентно: повторный вызов ставит те же значения.
// Секреты в ответ не попадают.
export default async function handler(req, res) {
  const token = process.env.BOT_TOKEN;
  if (!token) {
    res.status(500).json({ ok: false, error: 'BOT_TOKEN is not set' });
    return;
  }

  const setRes = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: WEBHOOK_URL,
      secret_token: webhookSecret(),
      allowed_updates: ['message'],
    }),
  });
  const set = await setRes.json();

  const infoRes = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`);
  const info = (await infoRes.json()).result || {};

  // Оформление бота: ?brand=1. Telegram ограничивает частоту смены имени, поэтому не по умолчанию.
  let brand;
  if (req.query && req.query.brand === '1') {
    const call = async (method, body) => {
      const r = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const j = await r.json();
      return { ok: Boolean(j.ok), description: j.ok ? undefined : j.description };
    };
    brand = {
      name: await call('setMyName', { name: 'NO NPC' }),
      description: await call('setMyDescription', { description: DESCRIPTION }),
      short_description: await call('setMyShortDescription', { short_description: SHORT_DESCRIPTION }),
      menu_button: await call('setChatMenuButton', {
        menu_button: { type: 'web_app', text: 'Войти', web_app: { url: APP_URL } },
      }),
    };
  }

  res.status(200).json({
    brand,
    set_ok: Boolean(set.ok),
    set_description: set.description,
    url: info.url,
    pending_update_count: info.pending_update_count,
    last_error_message: info.last_error_message || null,
  });
}
