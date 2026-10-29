/** Money is whole shillings on the sales side, so no decimals are shown. */
export function money(value: unknown): string {
    const n = Number(value ?? 0);

    return Number.isFinite(n) ? n.toLocaleString("en-KE", { maximumFractionDigits: 2 }) : "0";
}

export function kes(value: unknown): string {
    return `KES ${money(value)}`;
}

/** Compact axis labels: 184500 reads as 184.5k. */
export function compact(value: number): string {
    return value >= 1000 ? `${Number((value / 1000).toFixed(1))}k` : String(Math.round(value));
}

const EAT = "Africa/Nairobi";

export function dateTime(value: unknown): string {
    if (!value) return "—";

    const d = new Date(String(value));

    if (Number.isNaN(d.getTime())) return "—";

    return d.toLocaleString("en-KE", {
        timeZone: EAT,
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
    });
}

export function timeOnly(value: unknown): string {
    if (!value) return "—";

    const d = new Date(String(value));

    if (Number.isNaN(d.getTime())) return "—";

    return d.toLocaleTimeString("en-KE", { timeZone: EAT, hour: "2-digit", minute: "2-digit", hour12: false });
}

/** Status words to the four tints. Anything unmapped stays neutral. */
export type Tone = "ok" | "warn" | "bad" | "info" | "default";

const TONES: Record<string, Tone> = {
    FISCALIZED: "ok",
    COMPLETED: "ok",
    MATCHED: "ok",
    PAID: "ok",
    ACTIVE: "ok",
    CONNECTED: "ok",
    DELIVERED: "ok",
    SUCCESS: "ok",
    PENDING: "warn",
    AWAITING_PAYMENT: "warn",
    PROCESSING: "warn",
    UNMATCHED: "warn",
    PARTIALLY_PAID: "warn",
    QUEUED: "warn",
    FAILED: "bad",
    REJECTED: "bad",
    CANCELLED: "bad",
    CLOSED: "bad",
    AMOUNT_MISMATCH: "bad",
    EXPIRED: "bad",
    DRAFT: "default",
    NEW: "info",
    OPEN: "info",
    SENT: "info",
};

export function tone(status: unknown): Tone {
    return TONES[String(status ?? "").toUpperCase()] ?? "default";
}

/** "AMOUNT_MISMATCH" reads as "Amount mismatch". */
export function statusLabel(status: unknown): string {
    const raw = String(status ?? "").trim();

    if (!raw) return "Unknown";

    const words = raw.replace(/_/g, " ").toLowerCase();

    return words.charAt(0).toUpperCase() + words.slice(1);
}

export function initials(name: unknown): string {
    const parts = String(name ?? "").trim().split(/\s+/).filter(Boolean);

    if (!parts.length) return "e";

    return parts.slice(0, 2).map((p) => p[0]!.toUpperCase()).join("");
}
