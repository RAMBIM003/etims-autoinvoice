"use client";

/** A single share shown as a ring. Used for receipts issued out of all invoices. */
export function ProgressRing({ value, total, label }: { value: number; total: number; label: string }) {
    const pct = total ? Math.min(100, Math.round((value / total) * 100)) : 0;
    const radius = 44;
    const circumference = 2 * Math.PI * radius;

    return (
        <div className="flex items-center gap-5">
            <div className="relative size-28 shrink-0">
                <svg viewBox="0 0 110 110" className="size-full -rotate-90" role="img" aria-label={`${pct}% ${label}`}>
                    <circle cx="55" cy="55" r={radius} fill="none" stroke="var(--border)" strokeWidth="10" />
                    <circle
                        cx="55"
                        cy="55"
                        r={radius}
                        fill="none"
                        stroke="var(--chart-2)"
                        strokeWidth="10"
                        strokeLinecap="round"
                        strokeDasharray={circumference}
                        strokeDashoffset={circumference * (1 - pct / 100)}
                        className="transition-[stroke-dashoffset] duration-700"
                    />
                </svg>
                <div className="absolute inset-0 grid place-items-center">
                    <span className="tabular font-display text-2xl font-extrabold">{pct}%</span>
                </div>
            </div>
            <div className="min-w-0 text-sm">
                <p className="tabular font-bold">
                    {value} of {total}
                </p>
                <p className="text-muted-foreground text-xs">{label}</p>
            </div>
        </div>
    );
}
