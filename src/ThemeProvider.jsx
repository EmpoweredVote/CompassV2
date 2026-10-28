import { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext({ isDark: true, toggle: () => {} });
const KEY = 'ev:color-scheme';
const COOKIE_NAME = 'ev_theme';

function readCookie() {
  const cookie = document.cookie.split(';').map(c => c.trim()).find(c => c.startsWith(`${COOKIE_NAME}=`));
  return cookie ? cookie.split('=')[1] : null;
}

// The cookie is how a choice reaches the other .empowered.vote apps. Writing it only on the
// Essentials side made the trip one-way: a toggle here was overridden by the stale cookie on
// the next load, because the cookie outranks our own localStorage above.
function setCrossAppCookie(value) {
  const expires = new Date();
  expires.setFullYear(expires.getFullYear() + 1);
  document.cookie = `${COOKIE_NAME}=${value}; domain=.empowered.vote; path=/; expires=${expires.toUTCString()}; SameSite=Lax`;
}

function resolveInitialTheme() {
  // 1. ev_theme cookie (set by every .empowered.vote app on toggle — cross-subdomain priority)
  const cookie = readCookie();
  if (cookie) return cookie === 'dark';
  // 2. ev:color-scheme (ThemeProvider's canonical key)
  const stored = localStorage.getItem(KEY);
  if (stored === 'dark') return true;
  if (stored === 'light') return false;
  // 3. compass_dark_mode (CalibrationOverlay legacy key)
  const legacy = localStorage.getItem('compass_dark_mode');
  if (legacy !== null) return legacy === 'true';
  // 4. Dark. The OS is NOT consulted — a browser reports prefers-color-scheme: light when the
  //    OS has no preference set at all, so reading it could not tell "never chose" apart from
  //    "chose light", and every undecided visitor landed on a light page.
  return true;
}

export function ThemeProvider({ children }) {
  const [isDark, setIsDark] = useState(resolveInitialTheme);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
  }, [isDark]);

  // There WAS a matchMedia listener here that followed the OS mid-session for a visitor who
  // had chosen nothing anywhere. It went on 2026-10-27, with the OS fallback above: once dark
  // became the default for everyone undecided, this was the one path left that could still
  // move them to light without them asking.

  function toggle() {
    setIsDark((prev) => {
      const next = !prev;
      const value = next ? 'dark' : 'light';
      localStorage.setItem(KEY, value);
      setCrossAppCookie(value);
      return next;
    });
  }

  return <ThemeContext.Provider value={{ isDark, toggle }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
