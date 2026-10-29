import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/*
 * Placeholders shaped like the content they stand in for, so nothing moves
 * when the data lands. Widths come from fixed lists rather than Math.random()
 * so the shapes do not change between renders.
 */

const rise = (index: number) => ({ "--rise-delay": `${index * 70}ms` }) as React.CSSProperties;

/* An area chart's silhouette, used as a mask so the shimmer takes its shape. */
const WAVE =
    "M0 72 C30 64 55 38 95 44 S150 82 195 60 S265 18 305 34 S365 66 400 28";
const svgMask = (body: string) =>
    `url("data:image/svg+xml,${encodeURIComponent(
        `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 100' preserveAspectRatio='none'>${body}</svg>`
    )}")`;
const AREA_MASK = svgMask(`<path d='${WAVE} L400 100 L0 100 Z' fill='black'/>`);
const LINE_MASK = svgMask(
    `<path d='${WAVE}' fill='none' stroke='black' stroke-width='3' vector-effect='non-scaling-stroke' stroke-linecap='round'/>`
);
const SPARK_MASK = svgMask(
    `<path d='M0 70 C40 60 70 85 120 55 S200 20 250 45 S340 30 400 12' fill='none' stroke='black' stroke-width='2.5' vector-effect='non-scaling-stroke' stroke-linecap='round'/>`
);

const masked = (mask: string): React.CSSProperties => ({
    maskImage: mask,
    WebkitMaskImage: mask,
    maskSize: "100% 100%",
    WebkitMaskSize: "100% 100%",
});

/** The value and sparkline of a stat card. */
export function StatValueSkeleton({ sparkline }: { sparkline?: boolean }) {
    return (
        <>
            <Skeleton className="mt-1.5 h-5 w-24 rounded-md" />
            {sparkline ? <div className="skeleton mt-2.5 h-6 w-full" style={masked(SPARK_MASK)} /> : null}
        </>
    );
}

/** Sales chart: gridlines, a shimmering area and line, and the day labels. */
export function ChartSkeleton({ days = 7 }: { days?: number }) {
    return (
        <div className="skeleton-rise flex h-60 w-full flex-col pt-2 pb-1" aria-hidden style={rise(2)}>
            <div className="relative flex-1">
                {[0, 1, 2, 3].map((i) => (
                    <div
                        key={i}
                        className="border-border absolute inset-x-8 border-t border-dashed"
                        style={{ top: `${i * 30 + 4}%` }}
                    />
                ))}
                <div className="absolute inset-y-0 left-0 flex w-6 flex-col justify-between py-0.5">
                    {[0, 1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-2 w-full rounded-full" />
                    ))}
                </div>
                <div className="absolute inset-y-0 left-8 right-8">
                    <div className="skeleton absolute inset-0 opacity-50" style={masked(AREA_MASK)} />
                    <div className="skeleton absolute inset-0" style={masked(LINE_MASK)} />
                </div>
            </div>
            <div className="mt-2 flex justify-between px-8">
                {Array.from({ length: days }).map((_, i) => (
                    <Skeleton key={i} className="h-2 w-6 rounded-full" />
                ))}
            </div>
        </div>
    );
}

/** Donut ring with its legend, laid out like PaymentsDonut. */
export function DonutSkeleton() {
    const ring = "radial-gradient(circle, transparent 59%, black 60%)";

    return (
        <div className="skeleton-rise flex flex-wrap items-center gap-4" aria-hidden style={rise(3)}>
            <div className="relative size-36 shrink-0">
                <div className="skeleton absolute inset-0 rounded-full" style={{ maskImage: ring, WebkitMaskImage: ring }} />
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5">
                    <Skeleton className="h-5 w-8" />
                    <Skeleton className="h-2 w-12 rounded-full" />
                </div>
            </div>
            <ul className="min-w-36 flex-1">
                {[64, 80, 56, 40].map((width, i) => (
                    <li key={i} className="flex items-center gap-2 py-1.5">
                        <Skeleton className="size-2.5 shrink-0 rounded-full" />
                        <Skeleton className="h-2.5 rounded-full" style={{ width }} />
                        <Skeleton className="ml-auto h-2.5 w-4 rounded-full" />
                        <Skeleton className="h-2.5 w-7 rounded-full" />
                    </li>
                ))}
            </ul>
        </div>
    );
}

export type SkeletonColumn = {
    /** What sits in the cell, which sets its shape. */
    kind: "mono" | "text" | "amount" | "badge" | "time";
    /** The same responsive class the real column uses, so it hides at the same width. */
    className?: string;
};

const WIDTHS: Record<SkeletonColumn["kind"], number[]> = {
    mono: [112, 104, 120, 96, 116],
    text: [96, 72, 110, 84, 64],
    amount: [64, 52, 72, 58, 48],
    badge: [72, 88, 64, 80, 70],
    time: [40, 40, 40, 40, 40],
};

/** A table header strip and rows whose cells are shaped by what they will hold. */
export function TableSkeleton({ columns, rows = 6, delay = 0 }: { columns: SkeletonColumn[]; rows?: number; delay?: number }) {
    return (
        <div className="skeleton-rise overflow-hidden rounded-lg" aria-hidden style={rise(delay)}>
            <div className="bg-foreground/90 dark:bg-secondary flex h-9 items-center gap-4 rounded-lg px-3">
                {columns.map((col, c) => (
                    <div key={c} className={cn("flex-1", col.className)}>
                        <div className="bg-background/25 h-2 w-12 rounded-full" />
                    </div>
                ))}
            </div>
            {Array.from({ length: rows }).map((_, r) => (
                <div key={r} className="flex h-[43px] items-center gap-4 border-b px-3 last:border-0">
                    {columns.map((col, c) => (
                        <div key={c} className={cn("flex-1", col.className)}>
                            <Skeleton
                                className={cn(col.kind === "badge" ? "h-5 rounded-full" : "h-3 rounded-full")}
                                style={{ width: WIDTHS[col.kind][(r + c) % 5], maxWidth: "100%" }}
                            />
                        </div>
                    ))}
                </div>
            ))}
        </div>
    );
}

export { rise as riseDelay };
