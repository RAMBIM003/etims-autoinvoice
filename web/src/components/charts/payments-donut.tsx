"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import { ChartTooltip } from "@/components/charts/chart-tooltip";

export type Slice = { name: string; value: number; colour: string };

export function PaymentsDonut({ data, total, caption }: { data: Slice[]; total: number; caption: string }) {
    const slices = data.filter((d) => d.value > 0);

    return (
        <div className="flex flex-wrap items-center gap-4">
            <div className="relative h-36 w-36 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={slices}
                            dataKey="value"
                            nameKey="name"
                            innerRadius="68%"
                            outerRadius="100%"
                            paddingAngle={slices.length > 1 ? 2 : 0}
                            stroke="none"
                            isAnimationActive={false}
                        >
                            {slices.map((slice) => (
                                <Cell key={slice.name} fill={slice.colour} />
                            ))}
                        </Pie>
                        <Tooltip content={<ChartTooltip />} />
                    </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <span className="tabular font-display text-xl font-extrabold">{total}</span>
                    <span className="text-muted-foreground text-[10px]">{caption}</span>
                </div>
            </div>
            <ul className="min-w-36 flex-1 text-xs">
                {slices.map((slice) => (
                    <li key={slice.name} className="flex items-center gap-2 py-1">
                        <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ background: slice.colour }} />
                        <span className="min-w-0 truncate">{slice.name}</span>
                        <b className="tabular ml-auto">{slice.value}</b>
                        <span className="text-muted-foreground tabular w-9 text-right">
                            {total ? Math.round((slice.value / total) * 100) : 0}%
                        </span>
                    </li>
                ))}
            </ul>
        </div>
    );
}
