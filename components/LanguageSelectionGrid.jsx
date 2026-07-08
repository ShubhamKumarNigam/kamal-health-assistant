"use client";

import { useEffect, useState } from "react";
import { ArrowRight, CheckCircle2, Loader2 } from "lucide-react";
import { ActionButton } from "@/components/ActionButton";
import { languages } from "@/lib/languages";

const STORAGE_KEY = "kamal-language";

function chooseLanguage(languageCode) {
    localStorage.setItem(STORAGE_KEY, languageCode);
    window.dispatchEvent(new CustomEvent("kamal-language-change", {
        detail: { languageCode }
    }));
}

export function LanguageSelectionGrid() {
    const [selectedLanguage, setSelectedLanguage] = useState("en");
    const [isChanging, setIsChanging] = useState(false);

    useEffect(() => {
        const savedLanguage = localStorage.getItem(STORAGE_KEY);
        if (languages.some((language) => language.code === savedLanguage)) {
            setSelectedLanguage(savedLanguage);
        }

        function handleLanguageChange(event) {
            setSelectedLanguage(event.detail?.languageCode || "en");
            setIsChanging(false);
        }

        window.addEventListener("kamal-language-change", handleLanguageChange);
        return () => window.removeEventListener("kamal-language-change", handleLanguageChange);
    }, []);

    return (<section className="grid gap-3 sm:grid-cols-2">
      {languages.map((language) => {
        const isSelected = selectedLanguage === language.code;
        return (<button className={`touch-target rounded-lg border bg-surface p-5 text-left shadow-soft transition hover:border-primary ${isSelected ? "border-primary" : "border-border"}`} data-no-translate key={language.code} onClick={() => {
              setIsChanging(language.code !== "en");
              setSelectedLanguage(language.code);
              chooseLanguage(language.code);
          }} type="button">
            <span className="flex items-start justify-between gap-3">
              <span>
                <span className="block text-2xl font-bold">{language.nativeName}</span>
                <span className="mt-1 block text-text-secondary">{language.name}</span>
              </span>
              {isSelected ? (<CheckCircle2 aria-hidden="true" className="h-6 w-6 text-primary"/>) : isChanging ? (<Loader2 aria-hidden="true" className="h-6 w-6 animate-spin text-primary"/>) : null}
            </span>
            <span className="mt-4 block leading-7 text-text-secondary">
              {language.sample}
            </span>
          </button>);
      })}
      <div className="sm:col-span-2">
        <ActionButton href="/onboarding/history" icon={ArrowRight} label="Continue to health history"/>
      </div>
    </section>);
}
