"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { languages } from "@/lib/languages";

const STORAGE_KEY = "kamal-language";
const ORIGINAL_TEXT = Symbol("kamalOriginalText");
const ORIGINAL_ATTRS = Symbol("kamalOriginalAttrs");
const ATTRIBUTES = ["placeholder", "aria-label", "title", "alt"];
const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "SVG", "PATH", "CODE", "PRE"]);

function normalizedText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
}

function shouldTranslateText(value) {
    const text = normalizedText(value);
    return text.length > 1 && /[A-Za-z]/.test(text);
}

function isInsideSkippedNode(node) {
    const element = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
    return Boolean(element?.closest("[data-no-translate], [translate='no'], input, textarea"));
}

function getTextNodes(root) {
    const nodes = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
            const sourceText = node[ORIGINAL_TEXT] || node.nodeValue;
            if (!shouldTranslateText(sourceText) || isInsideSkippedNode(node)) {
                return NodeFilter.FILTER_REJECT;
            }
            if (SKIP_TAGS.has(node.parentElement?.tagName)) {
                return NodeFilter.FILTER_REJECT;
            }
            return NodeFilter.FILTER_ACCEPT;
        }
    });
    let node = walker.nextNode();
    while (node) {
        nodes.push(node);
        node = walker.nextNode();
    }
    return nodes;
}

function getAttributeElements(root) {
    return [...root.querySelectorAll(ATTRIBUTES.map((attribute) => `[${attribute}]`).join(","))]
        .filter((element) => !element.closest("[data-no-translate], [translate='no']"))
        .filter((element) => !SKIP_TAGS.has(element.tagName));
}

function createCacheKey(languageCode, text) {
    return `${languageCode}::${text}`;
}

function restoreEnglish() {
    document.querySelectorAll("[data-kamal-translated='true']").forEach((element) => {
        if (element[ORIGINAL_ATTRS]) {
            Object.entries(element[ORIGINAL_ATTRS]).forEach(([attribute, value]) => {
                element.setAttribute(attribute, value);
            });
        }
        element.removeAttribute("data-kamal-translated");
    });

    getTextNodes(document.body).forEach((node) => {
        if (node[ORIGINAL_TEXT]) {
            node.nodeValue = node[ORIGINAL_TEXT];
        }
    });
}

async function requestTranslations(language, texts) {
    const response = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            languageCode: language.code,
            languageName: language.name,
            texts
        })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.ok) {
        throw new Error(result.message || "Translation failed.");
    }
    return result.translations || {};
}

export function LanguageProvider({ children }) {
    const [languageCode, setLanguageCode] = useState("en");
    const [isHydrated, setIsHydrated] = useState(false);
    const cacheRef = useRef(new Map());
    const translatingRef = useRef(false);
    const queuedRef = useRef(false);

    const activeLanguage = useMemo(() => {
        return languages.find((language) => language.code === languageCode) || languages[0];
    }, [languageCode]);

    useEffect(() => {
        const savedLanguage = localStorage.getItem(STORAGE_KEY);
        if (languages.some((language) => language.code === savedLanguage)) {
            setLanguageCode(savedLanguage);
        }
        setIsHydrated(true);
    }, []);

    useEffect(() => {
        if (!isHydrated) {
            return;
        }

        function handleLanguageChange(event) {
            const nextCode = event.detail?.languageCode;
            if (!languages.some((language) => language.code === nextCode)) {
                return;
            }
            localStorage.setItem(STORAGE_KEY, nextCode);
            setLanguageCode(nextCode);
        }

        window.addEventListener("kamal-language-change", handleLanguageChange);
        return () => window.removeEventListener("kamal-language-change", handleLanguageChange);
    }, [isHydrated]);

    useEffect(() => {
        if (!isHydrated) {
            return;
        }

        document.documentElement.lang = activeLanguage.code;
        document.documentElement.dir = activeLanguage.direction || "ltr";
        document.documentElement.dataset.kamalLanguage = activeLanguage.code;

        async function translatePage() {
            if (translatingRef.current) {
                queuedRef.current = true;
                return;
            }

            translatingRef.current = true;
            queuedRef.current = false;

            try {
                if (activeLanguage.code === "en") {
                    restoreEnglish();
                    return;
                }

                const textNodes = getTextNodes(document.body);
                const attributeElements = getAttributeElements(document.body);
                const originals = [];

                textNodes.forEach((node) => {
                    if (!node[ORIGINAL_TEXT]) {
                        node[ORIGINAL_TEXT] = node.nodeValue;
                    }
                    const text = normalizedText(node[ORIGINAL_TEXT]);
                    if (text) {
                        originals.push(text);
                    }
                });

                attributeElements.forEach((element) => {
                    if (!element[ORIGINAL_ATTRS]) {
                        element[ORIGINAL_ATTRS] = {};
                    }
                    ATTRIBUTES.forEach((attribute) => {
                        const value = element.getAttribute(attribute);
                        const sourceText = element[ORIGINAL_ATTRS]?.[attribute] || value;
                        if (!shouldTranslateText(sourceText)) {
                            return;
                        }
                        if (!element[ORIGINAL_ATTRS][attribute]) {
                            element[ORIGINAL_ATTRS][attribute] = value;
                        }
                        originals.push(normalizedText(element[ORIGINAL_ATTRS][attribute]));
                    });
                });

                const uniqueTexts = [...new Set(originals)].filter((text) => !cacheRef.current.has(createCacheKey(activeLanguage.code, text)));
                if (uniqueTexts.length) {
                    const translations = await requestTranslations(activeLanguage, uniqueTexts.slice(0, 120));
                    Object.entries(translations).forEach(([text, translation]) => {
                        cacheRef.current.set(createCacheKey(activeLanguage.code, text), translation);
                    });
                }

                textNodes.forEach((node) => {
                    const original = normalizedText(node[ORIGINAL_TEXT]);
                    const translation = cacheRef.current.get(createCacheKey(activeLanguage.code, original));
                    if (translation) {
                        node.nodeValue = node.nodeValue.replace(node.nodeValue.trim(), translation);
                    }
                });

                attributeElements.forEach((element) => {
                    ATTRIBUTES.forEach((attribute) => {
                        const original = normalizedText(element[ORIGINAL_ATTRS]?.[attribute]);
                        const translation = cacheRef.current.get(createCacheKey(activeLanguage.code, original));
                        if (translation) {
                            element.setAttribute(attribute, translation);
                            element.dataset.kamalTranslated = "true";
                        }
                    });
                });
            }
            catch (error) {
                console.error("KAMAL language translation failed", error);
            }
            finally {
                translatingRef.current = false;
                if (queuedRef.current) {
                    setTimeout(translatePage, 80);
                }
            }
        }

        translatePage();
        const observer = new MutationObserver(() => {
            window.clearTimeout(observer.translateTimer);
            observer.translateTimer = window.setTimeout(translatePage, 160);
        });
        observer.observe(document.body, { childList: true, subtree: true });

        return () => observer.disconnect();
    }, [activeLanguage, isHydrated]);

    return children;
}
