import { createHmac } from 'node:crypto';

// Подпись вебхука Telegram выводится из BOT_TOKEN на сервере, отдельный секрет хранить не нужно.
// Допустимые символы secret_token у Telegram: A-Z a-z 0-9 _ - (hex подходит).
export function webhookSecret() {
  return createHmac('sha256', process.env.BOT_TOKEN || '')
    .update('habit-rpg-webhook-v1')
    .digest('hex');
}
