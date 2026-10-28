"use client";

import { Area, ComposedChart, CartesianGrid, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { ChartTooltip } from "@/components/charts/chart-tooltip";
import { compact, kes } from "@/lib/format";

export type SalesPoint = { label: string; sales: number; orders: number };

/**
 * Shillings on the left axis, order count on the right. Two scales because the
 * two series differ by three orders of magnitude and a shared axis would flatten
 * the order line onto the baseline.
 */
export function SalesChart({ data }: { data: SalesPoint[] }) {
    return (
        <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
                    <defs>
                        <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.24} />
                            <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
                    <XAxis
                        dataKey="label"
                        tickLine={false}
                        axisLine={false}
                        tick={{ fill: "var(--chart-label)", fontSize: 12 }}
                        minTickGap={16}
                    />
                    <YAxis
                        yAxisId="sales"
                        tickLine={false}
                        axisLine={false}
                        width={52}
                        tick={{ fill: "var(--chart-label)", fontSize: 12 }}
                        tickFormatter={compact}
                    />
                    <YAxis
                        yAxisId="orders"
                        orientation="right"
                        tickLine={false}
                        axisLine={false}
                        width={32}
                        tick={{ fill: "var(--chart-label)", fontSize: 12 }}
                        allowDecimals={false}
                    />
                    <Tooltip
                        cursor={{ stroke: "var(--chart-grid)" }}
                        content={
                            <ChartTooltip
                                formatter={(name, value) => (name === "Sales" ? kes(value) : String(value))}
                            />
                        }
                    />
                    <Area
                        yAxisId="sales"
                        type="monotone"
                        dataKey="sales"
                        name="Sales"
                        stroke="var(--chart-1)"
                        strokeWidth={2.5}
                        fill="url(#salesFill)"
                        dot={false}
                        activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--card)" }}
                    />
                    <Line
                        yAxisId="orders"
                        type="monotone"
                        dataKey="orders"
                        name="Orders"
                        stroke="var(--chart-2)"
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 3.5 }}
                    />
                </ComposedChart>
            </ResponsiveContainer>
        </div>
    );
}
