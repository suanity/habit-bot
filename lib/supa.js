export const SUPABASE_URL = 'https://ivmdbkukjvxzoazcicet.supabase.co';

// Серверный ключ Supabase (secret / service_role). Хранится только в переменных окружения Vercel.
export const supa = (path, opts = {}) => {
  const key = process.env.SUPABASE_SECRET_KEY;
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...opts,
    headers: {
      apikey: key,
      // legacy service_role — JWT, новый secret key (sb_secret_...) передаётся только в apikey
      ...(key && key.startsWith('eyJ') ? { Authorization: `Bearer ${key}` } : {}),
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
  });
};
