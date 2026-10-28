"use client";

/** Recharts' default tooltip ignores the theme, so the card is ours.
    Recharts injects active/payload/label at render time, so they are optional
    here and the element can be passed to `content` with only `formatter` set. */
type TooltipEntry = { dataKey?: string | number; name?: string | number; value?: number | string; color?: string };

export function ChartTooltip({
    active,
    payload,
    label,
    formatter,
}: {
    active?: boolean;
    payload?: TooltipEntry[];
    label?: string | number;
    formatter?: (name: string, value: number) => string;
}) {
    if (!active || !payload?.length) return null;

    return (
        <div className="bg-popover text-popover-foreground min-w-36 rounded-lg border p-2.5 text-xs shadow-xl">
            {label ? <p className="mb-1.5 font-bold">{String(label)}</p> : null}
            <ul className="flex flex-col gap-1">
                {payload.map((entry) => (
                    <li key={String(entry.dataKey ?? entry.name)} className="flex items-center gap-2">
                        <span
                            aria-hidden
                            className="size-2 shrink-0 rounded-full"
                            style={{ background: entry.color }}
                        />
                        <span className="text-muted-foreground">{entry.name}</span>
                        <span className="tabular ml-auto font-bold">
                            {formatter
                                ? formatter(String(entry.name), Number(entry.value))
                                : Number(entry.value).toLocaleString("en-KE")}
                        </span>
                    </li>
                ))}
            </ul>
        </div>
    );
}
