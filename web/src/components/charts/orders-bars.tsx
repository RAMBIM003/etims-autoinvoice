"use client";

import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { ChartTooltip } from "@/components/charts/chart-tooltip";

export type OrdersBarPoint = { label: string; orders: number };

/** Order count per day, one bar each. */
export function OrdersBars({ data }: { data: OrdersBarPoint[] }) {
    return (
        <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data} margin={{ top: 16, right: 8, bottom: 0, left: -16 }}>
                    <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
                    <XAxis
                        dataKey="label"
                        tickLine={false}
                        axisLine={false}
                        tick={{ fill: "var(--chart-label)", fontSize: 12 }}
                        minTickGap={12}
                    />
                    <YAxis
                        tickLine={false}
                        axisLine={false}
                        allowDecimals={false}
                        width={32}
                        tick={{ fill: "var(--chart-label)", fontSize: 12 }}
                    />
                    <Tooltip
                        cursor={{ fill: "var(--chart-grid)", fillOpacity: 0.4 }}
                        content={<ChartTooltip />}
                    />
                    <Bar dataKey="orders" name="Orders" fill="var(--chart-2)" radius={[6, 6, 0, 0]} maxBarSize={28}>
                        <LabelList dataKey="orders" position="top" className="fill-muted-foreground text-[11px]" />
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}
