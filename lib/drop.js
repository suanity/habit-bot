// Разбор команды /drop: "/drop AURA 20 Текст квеста | необязательное описание"
const STATS = ['VIGOR', 'MIND', 'WILL', 'AURA', 'GOLD'];

// Игровой день — по Москве (UTC+3), как в базе (world_today()).
export function moscowDay(now = Date.now()) {
  return new Date(now + 3 * 3600e3).toISOString().slice(0, 10);
}

export function parseDrop(text, cmd = 'drop') {
  const m = new RegExp(`^\\/${cmd}(?:@\\w+)?\\s+(\\S+)\\s+(\\d{1,3})\\s+([\\s\\S]+)$`).exec(text.trim());
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
  'Использование: /drop СТАТ XP Текст [| описание]\nСТАТ: VIGOR, MIND, WILL, AURA, GOLD. XP: 1–100.\nПример: /drop AURA 25 Снять сцену против света | Один дубль, 30 секунд';

export const BOSS_USAGE =
  'Использование: /boss СТАТ XP Название | описание\nЗаменяет босса текущей недели. XP: 1–100. Пока кто-то уже закрыл босса, заменить нельзя.\nПример: /boss WILL 60 Неделя без сладкого | Ни одного десерта до воскресенья';

export function parseHide(text) {
  const m = /^\/(hide|unhide)(?:@\w+)?\s+([\s\S]{1,40})$/.exec(text.trim());
  if (!m) return null;
  const nick = m[2].trim();
  return nick.length >= 3 && nick.length <= 16 ? { hide: m[1] === 'hide', nick } : null;
}

// Эксклюзивные скины: названия совпадают с таблицей skin_catalog в базе.
export const SKIN_NAMES = { 1: 'GOLD', 2: 'CHROME', 3: 'ICE', 4: 'NEON', 5: 'OBSIDIAN', 6: 'GLITCH', 7: 'LAVA', 8: 'HOLO', 9: 'VOID', 10: 'CREATOR' };

// "/skin ПОЗЫВНОЙ GOLD" или "/skin ПОЗЫВНОЙ 1"; "/unskin" — забрать.
export function parseSkin(text) {
  const m = /^\/(skin|unskin)(?:@\w+)?\s+(.{3,16}?)\s+(\S{1,10})$/.exec(text.trim());
  if (!m) return null;
  const raw = m[3].toUpperCase();
  const id = /^\d{1,2}$/.test(raw) ? parseInt(raw, 10) : Object.keys(SKIN_NAMES).map(Number).find(k => SKIN_NAMES[k] === raw);
  if (!id || !SKIN_NAMES[id]) return null;
  return { grant: m[1] === 'skin', nick: m[2].trim(), id };
}

export const SKIN_USAGE =
  'Использование: /skin ПОЗЫВНОЙ СКИН или /unskin ПОЗЫВНОЙ СКИН\nСкины: ' +
  Object.entries(SKIN_NAMES).map(([k, v]) => `${k} ${v}`).join(', ') + '\nПример: /skin Кай_77 GOLD';

export const HELP_ADMIN = [
  '/pending — ожидающие оплаты',
  '/approve ID — открыть доступ',
  '/drop СТАТ XP Текст | описание — квест на сегодня',
  '/boss СТАТ XP Название | описание — босс недели',
  '/hide ПОЗЫВНОЙ — скрыть игрока из рейтинга',
  '/unhide ПОЗЫВНОЙ — вернуть',
  '/skin ПОЗЫВНОЙ СКИН — выдать нумерованный скин',
  '/unskin ПОЗЫВНОЙ СКИН — забрать скин',
  '/skins — сколько выдано',
  '/codes — свободные места',
].join('\n');
