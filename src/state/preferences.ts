export const THEMES = ['classic', 'slate', 'nord', 'dracula', 'solarized', 'cyberpunk', 'dark-grey', 'full-black', 'forest', 'bubblegum', 'autumn'] as const;
export type Theme = (typeof THEMES)[number];
export const THEME_NAMES: Record<Theme, string> = {
  classic: 'Classic', slate: 'Slate', nord: 'Nord', dracula: 'Dracula', solarized: 'Solarized',
  cyberpunk: 'Cyberpunk', 'dark-grey': 'Dark Grey', 'full-black': 'Full Black',
  forest: 'Forest', bubblegum: 'Bubblegum', autumn: 'Autumn',
};

export function readPreference(key: string): string | null {
  try { return localStorage.getItem(`taskflow.${key}`); } catch { return null; }
}

export function writePreference(key: string, value: string) {
  try { localStorage.setItem(`taskflow.${key}`, value); } catch { /* Preferences are optional; task storage is SQLite. */ }
}

export function initialTheme(): Theme {
  const saved = readPreference('theme');
  return THEMES.find(theme => theme === saved) ?? 'classic';
}
