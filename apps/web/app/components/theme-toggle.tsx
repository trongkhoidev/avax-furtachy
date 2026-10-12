"use client";

import { Moon, Sun } from "lucide-react";

export function ThemeToggle() {
  function toggleTheme() {
    const root = document.documentElement;
    const nextTheme = root.dataset.theme === "light" ? "dark" : "light";
    root.dataset.theme = nextTheme;
    root.style.colorScheme = nextTheme;
    try {
      window.localStorage.setItem("wolfdao-theme", nextTheme);
    } catch {
      // The toggle still works for this session when storage is unavailable.
    }
  }

  return (
    <button
      className="theme-toggle"
      type="button"
      aria-label="Toggle light and dark theme"
      title="Toggle light and dark theme"
      onClick={toggleTheme}
    >
      <Sun className="theme-toggle-sun" size={17} aria-hidden="true" />
      <Moon className="theme-toggle-moon" size={17} aria-hidden="true" />
      <span className="sr-only">Toggle light and dark theme</span>
    </button>
  );
}
