import { NextResponse } from "next/server";
import { searchUserNames } from "@/lib/auth/sqliteStore";

export const runtime = "nodejs";

const appSearchItems = [
    { id: "nav-home", name: "Home", href: "/", type: "Page" },
    { id: "nav-session", name: "Session", href: "/session", type: "Page" },
    { id: "nav-history", name: "History", href: "/onboarding/history", type: "Page" },
    { id: "nav-reminders", name: "Reminders", href: "/reminders", type: "Page" },
    { id: "nav-diet", name: "Diet", href: "/diet", type: "Page" },
    { id: "nav-analyser", name: "Analyser", href: "/image-upload", type: "Page" },
    { id: "nav-search", name: "Search", href: "/search", type: "Page" },
    { id: "nav-report", name: "Report", href: "/reports/demo", type: "Page" },
    { id: "quick-fever", name: "Last fever note", href: "/onboarding/history", type: "Quick search" },
    { id: "quick-medicine", name: "Medicine reminders", href: "/reminders", type: "Quick search" },
    { id: "quick-emergency", name: "Emergency signs", href: "/emergency", type: "Quick search" },
    { id: "quick-doctor-report", name: "Doctor report", href: "/reports/demo", type: "Quick search" }
];

function normalizeSearchText(value) {
    return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function hasCharactersInOrder(text, query) {
    let queryIndex = 0;
    for (const character of text) {
        if (character === query[queryIndex]) {
            queryIndex += 1;
        }
        if (queryIndex === query.length) {
            return true;
        }
    }
    return false;
}

function matchesQuery(item, query) {
    const normalizedName = normalizeSearchText(item.name);
    const normalizedQuery = normalizeSearchText(query);
    if (!normalizedQuery) {
        return false;
    }
    return normalizedName.includes(normalizedQuery) ||
        normalizedName.split(" ").some((word) => word.startsWith(normalizedQuery)) ||
        hasCharactersInOrder(normalizedName.replaceAll(" ", ""), normalizedQuery.replaceAll(" ", ""));
}

export async function GET(request) {
    const query = String(request.nextUrl.searchParams.get("q") || "").trim();
    const appResults = query ? appSearchItems.filter((item) => matchesQuery(item, query)) : [];
    const patientResults = searchUserNames(query).map((user) => ({
        ...user,
        type: "Patient"
    }));
    return NextResponse.json({
        ok: true,
        results: [...appResults, ...patientResults]
    });
}
