"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

const storageKey = "kamal-theme";

export function ThemeToggle() {
    const [theme, setTheme] = useState("light");

    useEffect(() => {
        const savedTheme = window.localStorage.getItem(storageKey);
        const nextTheme = savedTheme === "dark" ? "dark" : "light";
        setTheme(nextTheme);
        document.documentElement.dataset.theme = nextTheme;
    }, []);

    function toggleTheme() {
        const nextTheme = theme === "dark" ? "light" : "dark";
        setTheme(nextTheme);
        window.localStorage.setItem(storageKey, nextTheme);
        document.documentElement.dataset.theme = nextTheme;
    }

    const isDark = theme === "dark";

    return (<button aria-label={`Switch to ${isDark ? "light" : "dark"} mode`} aria-pressed={isDark} className="touch-target inline-flex items-center justify-center gap-2 rounded-full border border-[#324c4a]/10 bg-[#daf8ef] px-4 py-3 text-sm font-extrabold text-[#324c4a] transition hover:bg-white" onClick={toggleTheme} type="button">
      {isDark ? <Sun aria-hidden="true" className="h-4 w-4"/> : <Moon aria-hidden="true" className="h-4 w-4"/>}
      <span>{isDark ? "Light" : "Dark"}</span>
    </button>);
}
