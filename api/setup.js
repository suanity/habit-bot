import { webhookSecret } from '../lib/secret.js';

const WEBHOOK_URL = process.env.WEBHOOK_URL || 'https://habit-bot-nu.vercel.app/api/webhook';

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

  res.status(200).json({
    set_ok: Boolean(set.ok),
    set_description: set.description,
    url: info.url,
    pending_update_count: info.pending_update_count,
    last_error_message: info.last_error_message || null,
  });
}
