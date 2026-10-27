import { createHmac, timingSafeEqual } from 'node:crypto';

// Проверка Telegram Web App initData (https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app)
// Возвращает { ok: true, user } или { ok: false, error }.
export function verifyInitData(initData, botToken, { maxAgeSec = 86400, now = Date.now() } = {}) {
  if (typeof initData !== 'string' || !initData || initData.length > 4096 || !botToken) {
    return { ok: false, error: 'bad_init' };
  }
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash || !/^[0-9a-f]{64}$/.test(hash)) return { ok: false, error: 'bad_init' };
  params.delete('hash');

  const dcs = [...params.entries()]
    .map(([k, v]) => `${k}=${v}`)
    .sort()
    .join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(botToken).digest();
  const calc = createHmac('sha256', secret).update(dcs).digest();
  const given = Buffer.from(hash, 'hex');
  if (given.length !== calc.length || !timingSafeEqual(given, calc)) return { ok: false, error: 'bad_signature' };

  const authDate = Number(params.get('auth_date'));
  if (!Number.isFinite(authDate) || authDate <= 0) return { ok: false, error: 'bad_init' };
  const age = now / 1000 - authDate;
  if (age > maxAgeSec || age < -300) return { ok: false, error: 'expired' };

  let user;
  try { user = JSON.parse(params.get('user') || ''); } catch { return { ok: false, error: 'bad_init' }; }
  if (!user || !Number.isSafeInteger(user.id) || user.id <= 0) return { ok: false, error: 'bad_init' };
  return { ok: true, user: { id: user.id, username: user.username || null, first_name: user.first_name || null } };
}
