import fs from "fs";
import path from "path";

export const GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions";
export const OPENCODE_CHAT_URL = "https://opencode.ai/zen/go/v1/chat/completions";
export const OPENCODE_MODEL = "mimo-v2.5";
export const AI_BUSY_MESSAGE = "The AI model is temporarily busy. Please wait a few seconds and try again.";

const MAX_PROVIDER_RETRY_WAIT_MS = 5000;

export function sanitizeApiKey(value) {
    return String(value || "")
        .trim()
        .replace(/^["']|["']$/g, "")
        .replace(/[\u200B-\u200D\uFEFF\r\n\t ]/g, "")
        .trim();
}

function localEnvApiKey(name) {
    try {
        const envPath = path.join(process.cwd(), ".env.local");
        const envText = fs.readFileSync(envPath, "utf8");
        const line = envText
            .split("\n")
            .find((entry) => entry.trim().startsWith(`${name}=`));
        if (!line) {
            return "";
        }
        return sanitizeApiKey(line.slice(line.indexOf("=") + 1));
    }
    catch {
        return "";
    }
}

export function localEnvGroqKey() {
    return localEnvApiKey("GROQ_API_KEY");
}

export function groqApiKey() {
    return localEnvGroqKey() || sanitizeApiKey(process.env.GROQ_API_KEY);
}

export function opencodeApiKey() {
    return localEnvApiKey("OPENCODE_API_KEY") ||
        localEnvApiKey("OPENCODE_GO_API_KEY") ||
        sanitizeApiKey(process.env.OPENCODE_API_KEY) ||
        sanitizeApiKey(process.env.OPENCODE_GO_API_KEY);
}

export function chatProviderConfig({ fallbackModel, requireMultimodal = false } = {}) {
    const preference = sanitizeApiKey(process.env.KAMAL_AI_PROVIDER).toLowerCase();
    const opencodeKey = opencodeApiKey();
    const groqKey = groqApiKey();
    const opencodeModel = sanitizeApiKey(process.env.OPENCODE_MODEL) || OPENCODE_MODEL;
    const opencodeUrl = sanitizeApiKey(process.env.OPENCODE_CHAT_URL) || OPENCODE_CHAT_URL;

    if (preference === "groq" && groqKey && !requireMultimodal) {
        return {
            id: "groq",
            name: "Groq",
            apiKey: groqKey,
            url: GROQ_CHAT_URL,
            model: fallbackModel
        };
    }
    if (opencodeKey) {
        return {
            id: "opencode-go",
            name: "OpenCode Go",
            apiKey: opencodeKey,
            url: opencodeUrl,
            model: opencodeModel
        };
    }
    if (groqKey) {
        return {
            id: "groq",
            name: "Groq",
            apiKey: groqKey,
            url: GROQ_CHAT_URL,
            model: fallbackModel
        };
    }
    return null;
}

function sleep(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

function retryAfterHeaderToMs(value) {
    if (!value) {
        return 0;
    }
    const numeric = Number(value);
    if (Number.isFinite(numeric) && numeric >= 0) {
        return numeric * 1000;
    }
    const dateMs = Date.parse(value);
    if (Number.isFinite(dateMs)) {
        return Math.max(0, dateMs - Date.now());
    }
    return 0;
}

function retryAfterMessageToMs(value) {
    const match = String(value || "").match(/try again in\s+([\d.]+)\s*s/i);
    if (!match) {
        return 0;
    }
    const seconds = Number(match[1]);
    return Number.isFinite(seconds) && seconds >= 0 ? seconds * 1000 : 0;
}

function retryDelayMs(response, message, attempt) {
    const providerDelay = retryAfterHeaderToMs(response.headers.get("retry-after")) || retryAfterMessageToMs(message);
    const fallbackDelay = Math.min(1000 * 2 ** attempt, MAX_PROVIDER_RETRY_WAIT_MS);
    return Math.min(providerDelay || fallbackDelay, MAX_PROVIDER_RETRY_WAIT_MS);
}

function isRateLimit(status, message) {
    return status === 429 || /rate limit|tokens per minute|too many requests/i.test(String(message || ""));
}

function providerError({ response, data, fallbackMessage }) {
    const rawMessage = data?.error?.message || data?.message || "";
    const rateLimited = isRateLimit(response.status, rawMessage);
    return {
        ok: false,
        status: response.status,
        data,
        rawMessage,
        rateLimited,
        message: rateLimited ? AI_BUSY_MESSAGE : fallbackMessage
    };
}

export async function fetchProviderJson({
    url,
    apiKey,
    body,
    headers = {},
    method = "POST",
    retryAttempts = 2,
    fallbackMessage = "The AI model could not respond right now. Please try again."
}) {
    for (let attempt = 0; attempt <= retryAttempts; attempt += 1) {
        const response = await fetch(url, {
            method,
            headers: {
                Authorization: `Bearer ${apiKey}`,
                ...headers
            },
            body: typeof body === "function" ? body() : body
        });
        const data = await response.json().catch(() => ({}));
        if (response.ok) {
            return { ok: true, status: response.status, data };
        }

        const error = providerError({ response, data, fallbackMessage });
        if ((error.rateLimited || response.status === 503) && attempt < retryAttempts) {
            await sleep(retryDelayMs(response, error.rawMessage, attempt));
            continue;
        }
        return error;
    }

    return {
        ok: false,
        status: 503,
        data: {},
        rawMessage: "",
        rateLimited: true,
        message: AI_BUSY_MESSAGE
    };
}

export function openAiCompatibleChatPayload({ model, messages, maxTokens, temperature, topP, ...extra }) {
    return {
        model,
        messages,
        ...(temperature !== undefined ? { temperature } : {}),
        ...(topP !== undefined ? { top_p: topP } : {}),
        ...(maxTokens !== undefined ? { max_tokens: maxTokens } : {}),
        ...extra
    };
}

export async function fetchChatCompletion({
    url,
    apiKey,
    fallbackMessage,
    retryAttempts,
    ...payload
}) {
    return fetchProviderJson({
        url,
        apiKey,
        retryAttempts,
        fallbackMessage,
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(openAiCompatibleChatPayload(payload))
    });
}

export const fetchGroqJson = fetchProviderJson;
