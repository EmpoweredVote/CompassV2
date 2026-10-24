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
  // 4. OS preference
  return !window.matchMedia('(prefers-color-scheme: light)').matches;
}

export function ThemeProvider({ children }) {
  const [isDark, setIsDark] = useState(resolveInitialTheme);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
  }, [isDark]);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: light)');
    const handleChange = (e) => {
      // Only follow the OS for a visitor who has made no choice anywhere — a cookie is a
      // choice carried in from another app, and outranks the OS exactly as it does above.
      if (!readCookie() && !localStorage.getItem(KEY)) setIsDark(!e.matches);
    };
    mq.addEventListener('change', handleChange);
    return () => mq.removeEventListener('change', handleChange);
  }, []);

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
