// Разбор команды /drop: "/drop FAME 20 Текст квеста | необязательное описание"
const STATS = ['HP', 'INT', 'FAME', 'GOLD', 'STAMINA'];

// Игровой день — по Москве (UTC+3), как в базе (world_today()).
export function moscowDay(now = Date.now()) {
  return new Date(now + 3 * 3600e3).toISOString().slice(0, 10);
}

export function parseDrop(text) {
  const m = /^\/drop(?:@\w+)?\s+(\S+)\s+(\d{1,3})\s+([\s\S]+)$/.exec(text.trim());
  if (!m) return { error: 'format' };
  const stat = m[1].toUpperCase();
  if (!STATS.includes(stat)) return { error: 'stat' };
  const xp = parseInt(m[2], 10);
  if (xp < 1 || xp > 100) return { error: 'xp' };
  const [titleRaw, ...rest] = m[3].split('|');
  const title = titleRaw.trim();
  const descr = rest.join('|').trim() || null;
  if (title.length < 3 || title.length > 120) return { error: 'title' };
  if (descr && descr.length > 300) return { error: 'descr' };
  return { stat, xp, title, descr };
}

export const DROP_USAGE =
  'Использование: /drop СТАТ XP Текст [| описание]\nСТАТ: HP, INT, FAME, GOLD, STAMINA. XP: 1–100.\nПример: /drop FAME 25 Снять сцену против света | Один дубль, 30 секунд';
