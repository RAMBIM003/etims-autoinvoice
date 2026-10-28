import { cn } from "@/lib/utils";

/**
 * A plain inline SVG, not a chart library: it carries no axes or interaction,
 * and drawing it by hand keeps the stat cards cheap. Colours are CSS variables
 * written straight into SVG attributes, so both themes are covered without JS.
 */
export function Sparkline({
    values,
    tone = "brand",
    className,
}: {
    values: number[];
    tone?: "brand" | "ink";
    className?: string;
}) {
    if (values.length < 2) return null;

    const w = 120;
    const h = 24;
    const max = Math.max(1, ...values);
    const min = Math.min(...values);
    const span = max - min || 1;

    const points = values.map((v, i) => {
        const x = (i * w) / (values.length - 1);
        const y = h - 2 - ((h - 6) * (v - min)) / span;

        return [x, y] as const;
    });

    const line = points.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
    const colour = tone === "brand" ? "var(--chart-1)" : "var(--chart-2)";

    return (
        <svg
            viewBox={`0 0 ${w} ${h}`}
            preserveAspectRatio="none"
            aria-hidden
            className={cn("h-6 w-full", className)}
        >
            <path d={`${line} L${w},${h} L0,${h} Z`} fill={colour} fillOpacity="0.12" />
            <path d={line} fill="none" stroke={colour} strokeWidth="2" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        </svg>
    );
}
