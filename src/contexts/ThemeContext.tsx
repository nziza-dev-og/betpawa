
"use client";

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';

type Theme = "light" | "dark" | "system";

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  resolvedTheme: "light" | "dark";
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
}

export function ThemeProvider({
  children,
  defaultTheme = "system",
  storageKey = "skytrax-theme", 
}: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window !== 'undefined') {
      try {
        const storedTheme = window.localStorage.getItem(storageKey);
        if (storedTheme && ["light", "dark", "system"].includes(storedTheme)) {
          return storedTheme as Theme;
        }
      } catch (e) {
        console.error("Error reading theme from localStorage", e);
      }
    }
    return defaultTheme;
  });

  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const root = window.document.documentElement;
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const handleSystemThemeChange = (e: MediaQueryListEvent) => {
      if (theme === "system") {
        const systemIsDark = e.matches;
        root.classList.remove(systemIsDark ? "light" : "dark");
        root.classList.add(systemIsDark ? "dark" : "light");
        setResolvedTheme(systemIsDark ? "dark" : "light");
      }
    };
    
    let currentResolvedTheme: "light" | "dark";
    if (theme === "system") {
      currentResolvedTheme = mediaQuery.matches ? "dark" : "light";
      mediaQuery.addEventListener('change', handleSystemThemeChange);
    } else {
      currentResolvedTheme = theme;
      mediaQuery.removeEventListener('change', handleSystemThemeChange);
    }

    root.classList.remove("light", "dark");
    root.classList.add(currentResolvedTheme);
    setResolvedTheme(currentResolvedTheme);

    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(storageKey, theme);
      } catch (e) {
        console.error("Error saving theme to localStorage", e);
      }
    }
    
    return () => {
        mediaQuery.removeEventListener('change', handleSystemThemeChange);
    }
  }, [theme, storageKey]);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, resolvedTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
};
