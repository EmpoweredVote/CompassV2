import { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext({ isDark: true, toggle: () => {} });
const KEY = 'ev:color-scheme';

function resolveInitialTheme() {
  const stored = localStorage.getItem(KEY);
  if (stored === 'dark') return true;
  if (stored === 'light') return false;
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
      if (!localStorage.getItem(KEY)) setIsDark(!e.matches);
    };
    mq.addEventListener('change', handleChange);
    return () => mq.removeEventListener('change', handleChange);
  }, []);

  function toggle() {
    setIsDark((prev) => {
      const next = !prev;
      localStorage.setItem(KEY, next ? 'dark' : 'light');
      return next;
    });
  }

  return <ThemeContext.Provider value={{ isDark, toggle }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
