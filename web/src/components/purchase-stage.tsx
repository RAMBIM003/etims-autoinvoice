import { cn } from "@/lib/utils";

/* The path a purchase takes, in the order the backend moves it through. */
const STAGES = [
    { key: "AWAITING_PAYMENT", label: "Awaiting payment" },
    { key: "PAYMENT_RECEIVED", label: "Payment received" },
    { key: "FISCALIZING", label: "Fiscalizing" },
    { key: "RECEIPT_READY", label: "Receipt ready" },
];

const FAILED = new Set(["CANCELLED", "FISCALIZATION_FAILED", "PAYMENT_MISMATCH"]);

export function PurchaseStage({ stage }: { stage: string }) {
    if (FAILED.has(stage)) {
        const message =
            stage === "CANCELLED"
                ? "This order was cancelled. Nothing was charged."
                : stage === "PAYMENT_MISMATCH"
                  ? "The amount paid does not match the order. The merchant has to resolve it before a receipt is issued."
                  : "Fiscalization failed. The merchant can retry it; your receipt follows once KRA accepts the invoice.";

        return (
            <p className="border-bad-border bg-bad-soft text-bad rounded-md border px-3 py-2 text-xs">{message}</p>
        );
    }

    const current = STAGES.findIndex((s) => s.key === stage);

    return (
        <ol className="flex flex-wrap gap-1.5">
            {STAGES.map((item, index) => {
                const done = current > index;
                const active = current === index;

                return (
                    <li
                        key={item.key}
                        aria-current={active ? "step" : undefined}
                        className={cn(
                            "flex-1 rounded-md px-2 py-1.5 text-center text-[11px] font-semibold",
                            done && "bg-ok-soft text-ok",
                            active && "bg-warn-soft text-warn",
                            !done && !active && "bg-secondary text-muted-foreground"
                        )}
                    >
                        {item.label}
                    </li>
                );
            })}
        </ol>
    );
}
