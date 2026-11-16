"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { ChartTooltip } from "@/components/charts/chart-tooltip";
import { compact, kes } from "@/lib/format";

export type SalesLinePoint = { label: string; sales: number };

/** One line of sales per day. Shillings on the left axis. */
export function SalesLine({ data }: { data: SalesLinePoint[] }) {
    return (
        <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
                    <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
                    <XAxis
                        dataKey="label"
                        tickLine={false}
                        axisLine={false}
                        tick={{ fill: "var(--chart-label)", fontSize: 12 }}
                        minTickGap={16}
                    />
                    <YAxis
                        tickLine={false}
                        axisLine={false}
                        width={52}
                        tick={{ fill: "var(--chart-label)", fontSize: 12 }}
                        tickFormatter={compact}
                    />
                    <Tooltip
                        cursor={{ stroke: "var(--chart-grid)" }}
                        content={<ChartTooltip formatter={(_, value) => kes(value)} />}
                    />
                    <Line
                        type="monotone"
                        dataKey="sales"
                        name="Sales"
                        stroke="var(--chart-1)"
                        strokeWidth={2.5}
                        dot={false}
                        activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--card)" }}
                    />
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
}
