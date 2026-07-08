import crypto from "crypto";

export const DIAGNOSIS_SESSION_COOKIE = "kamal_diagnosis_session";
const TOKEN_TTL_SECONDS = 2 * 60 * 60;

function secretKey() {
    return process.env.KAMAL_JWT_SECRET || process.env.GROQ_API_KEY || "kamal-local-diagnosis-secret";
}

function base64UrlEncode(value) {
    return Buffer.from(value).toString("base64url");
}

function base64UrlJson(value) {
    return base64UrlEncode(JSON.stringify(value));
}

function sign(data) {
    return crypto.createHmac("sha256", secretKey()).update(data).digest("base64url");
}

function timingSafeEqualText(a, b) {
    const left = Buffer.from(a);
    const right = Buffer.from(b);
    return left.length === right.length && crypto.timingSafeEqual(left, right);
}

export function createDiagnosisSessionJwt({ userId, intakeId }) {
    const now = Math.floor(Date.now() / 1000);
    const header = base64UrlJson({ alg: "HS256", typ: "JWT" });
    const payload = base64UrlJson({
        sub: userId,
        intakeId,
        purpose: "diagnosis_session",
        jti: crypto.randomUUID(),
        iat: now,
        exp: now + TOKEN_TTL_SECONDS
    });
    const data = `${header}.${payload}`;
    return `${data}.${sign(data)}`;
}

export function verifyDiagnosisSessionJwt(token, { userId, intakeId }) {
    if (!token) {
        return false;
    }
    const parts = token.split(".");
    if (parts.length !== 3) {
        return false;
    }
    const [header, payload, signature] = parts;
    const expectedSignature = sign(`${header}.${payload}`);
    if (!timingSafeEqualText(signature, expectedSignature)) {
        return false;
    }
    try {
        const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
        const now = Math.floor(Date.now() / 1000);
        return decoded.purpose === "diagnosis_session" &&
            decoded.sub === userId &&
            decoded.intakeId === intakeId &&
            Number(decoded.exp) > now;
    }
    catch {
        return false;
    }
}

export function diagnosisSessionCookieOptions(request) {
    const isSecureRequest = request.headers.get("x-forwarded-proto") === "https" ||
        new URL(request.url).protocol === "https:";
    return {
        httpOnly: true,
        sameSite: "lax",
        secure: isSecureRequest,
        maxAge: TOKEN_TTL_SECONDS,
        path: "/"
    };
}
