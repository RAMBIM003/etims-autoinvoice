import { AlertTriangleIcon, BanIcon, CheckIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/* Same form as the card's total above it: KES 1,800.00. */
const kes = (value: unknown) =>
    `KES ${Number(value ?? 0).toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/* The path a purchase takes, in the order the backend moves it through. */
const STAGES = [
    { key: "AWAITING_PAYMENT", label: "Ordered" },
    { key: "PAYMENT_RECEIVED", label: "Paid" },
    { key: "FISCALIZING", label: "With KRA" },
    { key: "RECEIPT_READY", label: "Receipt ready" },
];

export type StageGroup = "progress" | "ready" | "attention" | "cancelled";

/** How a stage reads to a buyer: a short status, its tint, and which filter tab it belongs to. */
export const STAGE_INFO: Record<string, { label: string; tone: "ok" | "warn" | "bad" | "info" | "default"; group: StageGroup }> = {
    AWAITING_PAYMENT: { label: "Awaiting payment", tone: "warn", group: "progress" },
    PAYMENT_RECEIVED: { label: "Paid", tone: "info", group: "progress" },
    FISCALIZING: { label: "With KRA", tone: "info", group: "progress" },
    RECEIPT_READY: { label: "Receipt ready", tone: "ok", group: "ready" },
    PAYMENT_MISMATCH: { label: "Payment issue", tone: "bad", group: "attention" },
    FISCALIZATION_FAILED: { label: "Receipt delayed", tone: "bad", group: "attention" },
    CANCELLED: { label: "Cancelled", tone: "default", group: "cancelled" },
};

export function stageInfo(stage: string) {
    return STAGE_INFO[stage] ?? { label: stage, tone: "default" as const, group: "progress" as const };
}

/**
 * Where a purchase is, as a stepper: completed steps carry a tick, the
 * current one a pulsing dot. A purchase that left the path (cancelled, paid
 * the wrong amount, refused by KRA) gets a plain-language note instead.
 */
export function PurchaseStage({
    stage,
    paid,
    total,
}: {
    stage: string;
    /** What M-Pesa actually received, to explain a payment mismatch. */
    paid?: string | number | null;
    total?: string | number;
}) {
    if (stage === "CANCELLED") {
        return (
            <p className="bg-secondary text-muted-foreground flex items-start gap-2 rounded-lg px-3 py-2.5 text-xs">
                <BanIcon className="mt-px size-3.5 shrink-0" />
                This order was cancelled. Nothing was charged.
            </p>
        );
    }

    if (stage === "PAYMENT_MISMATCH" || stage === "FISCALIZATION_FAILED") {
        const message =
            stage === "PAYMENT_MISMATCH"
                ? `${paid != null ? `You paid ${kes(paid)} of ${kes(total)}. ` : "The amount paid does not match the order. "}The merchant has to resolve it before a receipt can be issued.`
                : "KRA has not accepted the invoice yet. The merchant can retry it, and your receipt follows as soon as KRA signs it.";

        return (
            <p className="border-bad-border bg-bad-soft text-bad flex items-start gap-2 rounded-lg border px-3 py-2.5 text-xs leading-relaxed">
                <AlertTriangleIcon className="mt-px size-3.5 shrink-0" />
                {message}
            </p>
        );
    }

    /* The last step is an outcome, not a wait: once reached, it is done. */
    const reached = STAGES.findIndex((s) => s.key === stage);
    const current = stage === "RECEIPT_READY" ? STAGES.length : reached;

    return (
        <ol className="flex items-start" aria-label="Purchase progress">
            {STAGES.map((step, index) => {
                const done = index < current;
                const active = index === current;

                return (
                    <li
                        key={step.key}
                        aria-current={active ? "step" : undefined}
                        className="relative flex flex-1 flex-col items-center gap-1.5 text-center"
                    >
                        {/* The line into this step, from the previous one. */}
                        {index > 0 ? (
                            <span
                                aria-hidden
                                className={cn(
                                    "absolute top-[9px] right-1/2 left-[-50%] h-0.5 rounded-full",
                                    done || active ? "bg-ok" : "bg-border"
                                )}
                            />
                        ) : null}
                        <span
                            className={cn(
                                "relative grid size-5 place-items-center rounded-full border-2",
                                done && "border-ok bg-ok text-white",
                                active && "border-warn bg-card",
                                !done && !active && "border-border bg-card"
                            )}
                        >
                            {done ? <CheckIcon className="size-3" strokeWidth={3} /> : null}
                            {active ? (
                                <span className="bg-warn size-2 rounded-full motion-safe:animate-pulse" />
                            ) : null}
                        </span>
                        <span
                            className={cn(
                                "text-[11px] leading-tight font-semibold",
                                done && "text-foreground",
                                active && "text-warn",
                                !done && !active && "text-muted-foreground"
                            )}
                        >
                            {step.label}
                            <span className="sr-only">{done ? " (done)" : active ? " (current)" : ""}</span>
                        </span>
                    </li>
                );
            })}
        </ol>
    );
}
