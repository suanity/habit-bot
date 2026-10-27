import { verifyInitData } from '../lib/tgauth.js';
import { supa } from '../lib/supa.js';

// Приложение живёт на GitHub Pages, поэтому разрешён только этот origin.
const ALLOWED_ORIGINS = ['https://suanity.github.io'];

// Обмен подписанных данных Telegram на сессию игрока.
// Код доступа остаётся внутренним токеном: пользователь его не вводит и не видит.
export default async function handler(req, res) {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Max-Age', '86400');
  }
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ ok: false, error: 'method' }); return; }

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = null; } }
  const v = verifyInitData(body && body.initData, process.env.BOT_TOKEN);
  if (!v.ok) { res.status(401).json({ ok: false, error: v.error }); return; }

  let rows;
  try {
    const r = await supa(`tg_links?tg_id=eq.${v.user.id}&select=code&limit=1`);
    rows = await r.json();
  } catch { res.status(502).json({ ok: false, error: 'db' }); return; }
  if (!Array.isArray(rows)) { res.status(502).json({ ok: false, error: 'db' }); return; }
  if (!rows.length) { res.status(200).json({ ok: false, error: 'no_access' }); return; }

  res.status(200).json({ ok: true, code: rows[0].code });
}
