"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import { ChartTooltip } from "@/components/charts/chart-tooltip";
import { kes } from "@/lib/format";

export type ItemPoint = { name: string; total: number };

const COLOURS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

/** Share of the last 30 days' sales by item. The centre shows the total; the list gives each item's share. */
export function ItemsDonut({ data }: { data: ItemPoint[] }) {
    const slices = data
        .filter((d) => d.total > 0)
        .map((d, i) => ({ ...d, colour: COLOURS[i % COLOURS.length] }));
    const total = slices.reduce((sum, s) => sum + s.total, 0);

    return (
        <div className="flex flex-wrap items-center gap-4">
            <div className="relative h-40 w-40 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={slices}
                            dataKey="total"
                            nameKey="name"
                            innerRadius="66%"
                            outerRadius="100%"
                            paddingAngle={slices.length > 1 ? 2 : 0}
                            stroke="none"
                            isAnimationActive={false}
                        >
                            {slices.map((slice) => (
                                <Cell key={slice.name} fill={slice.colour} />
                            ))}
                        </Pie>
                        <Tooltip content={<ChartTooltip formatter={(_, value) => kes(value)} />} />
                    </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <span className="tabular font-display text-sm font-extrabold">{kes(total)}</span>
                    <span className="text-muted-foreground text-[10px]">last 30 days</span>
                </div>
            </div>
            <ul className="min-w-40 flex-1 text-xs">
                {slices.map((slice) => (
                    <li key={slice.name} className="flex items-center gap-2 py-1">
                        <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ background: slice.colour }} />
                        <span className="min-w-0 truncate">{slice.name}</span>
                        <b className="tabular ml-auto">{kes(slice.total)}</b>
                        <span className="text-muted-foreground tabular w-9 text-right">
                            {total ? Math.round((slice.total / total) * 100) : 0}%
                        </span>
                    </li>
                ))}
            </ul>
        </div>
    );
}
