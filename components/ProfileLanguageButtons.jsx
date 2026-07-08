"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Languages } from "lucide-react";
import { languages } from "@/lib/languages";

const STORAGE_KEY = "kamal-language";

function setAppLanguage(languageCode) {
    localStorage.setItem(STORAGE_KEY, languageCode);
    window.dispatchEvent(new CustomEvent("kamal-language-change", {
        detail: { languageCode }
    }));
}

export function ProfileLanguageButtons({ className = "grid gap-2 sm:grid-cols-2" }) {
    const [selectedLanguage, setSelectedLanguage] = useState("en");

    useEffect(() => {
        const savedLanguage = localStorage.getItem(STORAGE_KEY);
        if (languages.some((language) => language.code === savedLanguage)) {
            setSelectedLanguage(savedLanguage);
        }

        function handleLanguageChange(event) {
            setSelectedLanguage(event.detail?.languageCode || "en");
        }

        window.addEventListener("kamal-language-change", handleLanguageChange);
        return () => window.removeEventListener("kamal-language-change", handleLanguageChange);
    }, []);

    return (<div className={className} data-no-translate>
      {languages.map((language) => {
        const isSelected = selectedLanguage === language.code;
        return (<button className={`touch-target inline-flex items-center justify-center gap-2 rounded-lg border bg-surface px-3 py-2 font-semibold hover:border-primary ${isSelected ? "border-primary text-primary" : "border-border"}`} key={language.code} onClick={() => {
              setSelectedLanguage(language.code);
              setAppLanguage(language.code);
          }} type="button">
          {isSelected ? (<CheckCircle2 aria-hidden="true" className="h-4 w-4"/>) : (<Languages aria-hidden="true" className="h-4 w-4"/>)}
          <span>{language.nativeName}</span>
        </button>);
      })}
    </div>);
}
