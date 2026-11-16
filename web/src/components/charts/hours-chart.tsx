"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { ChartTooltip } from "@/components/charts/chart-tooltip";

export type HourPoint = { hour: number; orders: number };

/** Orders per hour of the day. All 24 hours are drawn, so quiet hours show as gaps. */
export function HoursChart({ data }: { data: HourPoint[] }) {
    const byHour = new Map(data.map((d) => [d.hour, d.orders]));
    const full = Array.from({ length: 24 }, (_, hour) => ({
        label: String(hour).padStart(2, "0"),
        orders: byHour.get(hour) ?? 0,
    }));

    return (
        <div className="h-52 w-full">
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={full} margin={{ top: 8, right: 4, bottom: 0, left: -16 }}>
                    <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
                    <XAxis
                        dataKey="label"
                        tickLine={false}
                        axisLine={false}
                        interval={2}
                        tick={{ fill: "var(--chart-label)", fontSize: 11 }}
                    />
                    <YAxis
                        tickLine={false}
                        axisLine={false}
                        allowDecimals={false}
                        width={28}
                        tick={{ fill: "var(--chart-label)", fontSize: 11 }}
                    />
                    <Tooltip
                        cursor={{ fill: "var(--chart-grid)", fillOpacity: 0.4 }}
                        content={<ChartTooltip />}
                    />
                    <Bar dataKey="orders" name="Orders" fill="var(--chart-3)" radius={[4, 4, 0, 0]} maxBarSize={18} />
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}
