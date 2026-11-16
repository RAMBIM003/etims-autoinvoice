"use client";

import * as React from "react";
import Link from "next/link";
import {
    ArrowRightIcon,
    BoxIcon,
    CircleCheckIcon,
    CreditCardIcon,
    PieChartIcon,
    ReceiptIcon,
    ShoppingCartIcon,
    TrendingUpIcon,
    TriangleAlertIcon,
    LayoutDashboardIcon,
    type LucideIcon,
} from "lucide-react";

import { OrdersBars, type OrdersBarPoint } from "@/components/charts/orders-bars";
import { PaymentsDonut } from "@/components/charts/payments-donut";
import { SalesLine, type SalesLinePoint } from "@/components/charts/sales-line";
import { KpiTile } from "@/components/kpi-tile";
import { ListCard } from "@/components/list-card";
import { PageHero } from "@/components/page-hero";
import { ChartSkeleton, DonutSkeleton, TableSkeleton } from "@/components/skeletons";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState, ErrorState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useApi } from "@/hooks/use-api";
import { api } from "@/lib/api";
import { dateTime, kes, timeOnly } from "@/lib/format";
import type { DashboardPayload, Payment, Sale } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Buckets sales into one point per day for the last `days` days, in EAT. */
function buildSeries(sales: Sale[], days: number): { label: string; sales: number; orders: number }[] {
    const points: { label: string; sales: number; orders: number }[] = [];
    const now = new Date();

    for (let i = days - 1; i >= 0; i--) {
        const day = new Date(now);

        day.setDate(now.getDate() - i);

        const key = day.toISOString().slice(0, 10);
        const onDay = sales.filter((s) => String(s.created_at).slice(0, 10) === key);

        points.push({
            label: day.toLocaleDateString("en-KE", {
                timeZone: "Africa/Nairobi",
                weekday: days <= 7 ? "short" : undefined,
                day: days > 7 ? "2-digit" : undefined,
                month: days > 7 ? "short" : undefined,
            }),
            sales: onDay.reduce((total, s) => total + Number(s.total_amount || 0), 0),
            orders: onDay.length,
        });
    }

    return points;
}

/* Accent colours by meaning: brand for money, ink for orders, green for good,
   amber for something to act on, blue for setup counts. */
const ACCENT = {
    sales: "var(--primary)",
    orders: "var(--chart-2)",
    good: "var(--ok)",
    action: "var(--chart-4)",
    info: "var(--info)",
} as const;

const RANGES = [
    { value: "7", label: "7 days" },
    { value: "30", label: "30 days" },
];

function RangeToggle({ value, onChange }: { value: string; onChange: (value: string) => void }) {
    return (
        <div role="group" aria-label="Date range" className="bg-muted inline-flex rounded-lg p-0.5">
            {RANGES.map((range) => (
                <button
                    key={range.value}
                    type="button"
                    aria-pressed={value === range.value}
                    onClick={() => onChange(range.value)}
                    className={cn(
                        "rounded-md px-2.5 py-1 text-xs font-semibold transition-colors",
                        value === range.value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
                    )}
                >
                    {range.label}
                </button>
            ))}
        </div>
    );
}

function ChartCard({
    icon: Icon,
    title,
    description,
    tools,
    children,
}: {
    icon: LucideIcon;
    title: string;
    description: string;
    tools?: React.ReactNode;
    children: React.ReactNode;
}) {
    return (
        <section className="bg-card/70 flex flex-col gap-4 rounded-xl border p-4 shadow-sm backdrop-blur-md">
            <header className="flex items-start gap-3">
                <span className="bg-muted text-primary grid size-8 shrink-0 place-items-center rounded-lg">
                    <Icon className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                    <h2 className="text-sm font-bold">{title}</h2>
                    <p className="text-muted-foreground text-xs">{description}</p>
                </div>
                {tools ? <div className="shrink-0">{tools}</div> : null}
            </header>
            {children}
        </section>
    );
}

export default function MerchantDashboardPage() {
    const [range, setRange] = React.useState("7");

    const dashboard = useApi<DashboardPayload>(() => api.dashboard() as Promise<DashboardPayload>);
    const sales = useApi<{ sales: Sale[] }>(() => api.sales() as unknown as Promise<{ sales: Sale[] }>);
    const payments = useApi<{ payments: Payment[] }>(
        () => api.payments() as unknown as Promise<{ payments: Payment[] }>
    );

    const data = dashboard.data;
    const allSales = React.useMemo(() => sales.data?.sales ?? [], [sales.data]);
    const allPayments = React.useMemo(() => payments.data?.payments ?? [], [payments.data]);

    const series = React.useMemo(() => buildSeries(allSales, Number(range)), [allSales, range]);
    /* Two days: yesterday for the trend, today for the order count. */
    const twoDays = React.useMemo(() => buildSeries(allSales, 2), [allSales]);

    if (dashboard.error) {
        return (
            <>
                <PageHero
                    title="Dashboard"
                    description="Here's your day at a glance."
                    icon={LayoutDashboardIcon}
                />
                <ErrorState message={dashboard.error} onRetry={dashboard.reload} />
            </>
        );
    }

    /* The page frame renders straight away; each panel fills in as its own data lands. */
    const loading = !data;
    const stats = data?.stats;
    const reveal = "animate-in fade-in duration-500";

    const name = data?.merchant?.trading_name ?? "";
    const yesterdaySales = twoDays[0]?.sales ?? 0;
    const todaySales = Number(stats?.today_sales ?? 0);
    const trend =
        yesterdaySales > 0
            ? `${todaySales >= yesterdaySales ? "+" : ""}${Math.round(((todaySales - yesterdaySales) / yesterdaySales) * 100)}% vs yesterday`
            : "No sales yesterday to compare";

    const matched = allPayments.filter((p) => p.status === "MATCHED").length;
    const unmatched = allPayments.filter((p) => p.status === "UNMATCHED");
    const unmatchedTotal = unmatched.reduce((total, p) => total + Number(p.amount || 0), 0);
    const mismatch = allPayments.filter((p) => p.status === "AMOUNT_MISMATCH").length;
    const otherPayments = Math.max(0, allPayments.length - matched - unmatched.length - mismatch);

    const salesPoints: SalesLinePoint[] = series.map((p) => ({ label: p.label, sales: p.sales }));
    const ordersPoints: OrdersBarPoint[] = series.map((p) => ({ label: p.label, orders: p.orders }));

    const receiptsPct =
        stats && stats.invoices ? Math.min(100, Math.round((stats.fiscalized_invoices / stats.invoices) * 100)) : 0;

    return (
        <>
            <PageHero
                title={name ? `Hey there 👋 ${name}` : "Hey there 👋"}
                description="Here's your day at a glance."
                icon={LayoutDashboardIcon}
                action={
                    <Button asChild>
                        <Link href="/merchant/orders">
                            New order <ArrowRightIcon />
                        </Link>
                    </Button>
                }
            />

            {loading ? (
                <p role="status" className="sr-only">
                    Loading your dashboard
                </p>
            ) : null}

            {/* Row 1: six KPI tiles */}
            <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6" aria-busy={loading}>
                <KpiTile
                    label="Today's sales"
                    value={stats ? kes(stats.today_sales) : ""}
                    sub={trend}
                    icon={TrendingUpIcon}
                    accent={ACCENT.sales}
                    loading={loading}
                />
                <KpiTile
                    label="Orders today"
                    value={String(twoDays[1]?.orders ?? 0)}
                    sub={stats ? `of ${stats.orders} total` : undefined}
                    icon={ShoppingCartIcon}
                    accent={ACCENT.orders}
                    loading={loading}
                />
                <KpiTile
                    label="Matched payments"
                    value={stats ? String(stats.matched_payments) : ""}
                    sub={`of ${allPayments.length} payments`}
                    icon={CircleCheckIcon}
                    accent={ACCENT.good}
                    loading={loading}
                />
                <KpiTile
                    label="Unmatched, needs action"
                    value={stats ? String(stats.unmatched_payments) : ""}
                    sub={kes(unmatchedTotal)}
                    icon={TriangleAlertIcon}
                    accent={ACCENT.action}
                    loading={loading}
                    footer={
                        <Link href="/merchant/payments" className="text-primary inline-flex items-center gap-1 text-xs font-semibold">
                            Review <ArrowRightIcon className="size-3" />
                        </Link>
                    }
                />
                <KpiTile
                    label="Receipts issued"
                    value={stats ? `${stats.fiscalized_invoices} of ${stats.invoices}` : ""}
                    icon={ReceiptIcon}
                    accent={ACCENT.good}
                    loading={loading}
                    footer={
                        <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full" aria-hidden>
                            <div
                                className="bg-ok h-full rounded-full transition-[width] duration-700"
                                style={{ width: `${receiptsPct}%` }}
                            />
                        </div>
                    }
                />
                <KpiTile
                    label="Active items"
                    value={stats ? String(stats.items) : ""}
                    icon={BoxIcon}
                    accent={ACCENT.info}
                    loading={loading}
                />
            </div>

            {/* Row 2: three charts */}
            <div className="mb-4 grid items-start gap-3 xl:grid-cols-3">
                <ChartCard
                    icon={TrendingUpIcon}
                    title="Sales over time"
                    description="Your sales for the selected period"
                    tools={<RangeToggle value={range} onChange={setRange} />}
                >
                    {sales.loading ? (
                        <ChartSkeleton />
                    ) : (
                        <div className={reveal}>
                            <SalesLine data={salesPoints} />
                        </div>
                    )}
                </ChartCard>

                <ChartCard
                    icon={PieChartIcon}
                    title="Payments by status"
                    description="Breakdown of M-Pesa payments"
                >
                    {payments.loading ? (
                        <DonutSkeleton />
                    ) : allPayments.length ? (
                        <div className={reveal}>
                            <PaymentsDonut
                                total={allPayments.length}
                                caption="total payments"
                                data={[
                                    { name: "Matched", value: matched, colour: "var(--chart-2)" },
                                    { name: "Unmatched", value: unmatched.length, colour: "var(--chart-4)" },
                                    { name: "Amount mismatch", value: mismatch, colour: "var(--chart-1)" },
                                    { name: "Other", value: otherPayments, colour: "var(--chart-5)" },
                                ]}
                            />
                        </div>
                    ) : (
                        <EmptyState
                            icon={CreditCardIcon}
                            title="No payments yet"
                            description="Once a customer pays your paybill, the payment appears here and matches itself to an open order."
                        />
                    )}
                </ChartCard>

                <ChartCard
                    icon={ShoppingCartIcon}
                    title="Orders per day"
                    description="How many orders were raised each day"
                    tools={<RangeToggle value={range} onChange={setRange} />}
                >
                    {sales.loading ? (
                        <ChartSkeleton />
                    ) : (
                        <div className={reveal}>
                            <OrdersBars data={ordersPoints} />
                        </div>
                    )}
                </ChartCard>
            </div>

            {/* Row 3: recent lists, with scrolling tables */}
            <div className="grid items-start gap-3 lg:grid-cols-2">
                <ListCard
                    icon={ShoppingCartIcon}
                    title="Recent orders"
                    description="The last eight orders raised"
                    tools={
                        <Button asChild variant="ghost" size="sm">
                            <Link href="/merchant/orders">
                                View all <ArrowRightIcon />
                            </Link>
                        </Button>
                    }
                >
                    {loading ? (
                        <TableSkeleton
                            rows={8}
                            delay={4}
                            columns={[
                                { kind: "mono" },
                                { kind: "text", className: "@max-xl:hidden" },
                                { kind: "amount" },
                                { kind: "badge" },
                            ]}
                        />
                    ) : data.orders.length ? (
                        <Table className={reveal}>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Order</TableHead>
                                    <TableHead className="@max-xl:hidden">Customer</TableHead>
                                    <TableHead>Amount</TableHead>
                                    <TableHead>Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {data.orders.map((order) => (
                                    <TableRow key={order.id}>
                                        <TableCell className="font-mono text-xs">{order.order_reference}</TableCell>
                                        <TableCell className="@max-xl:hidden">{order.customer_name}</TableCell>
                                        <TableCell className="tabular font-bold">{kes(order.total_amount)}</TableCell>
                                        <TableCell>
                                            <StatusBadge status={order.status} />
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    ) : (
                        <EmptyState
                            icon={ShoppingCartIcon}
                            title="No orders yet"
                            description="Raise an order from the Orders page, or let a buyer place one against your catalogue."
                        />
                    )}
                </ListCard>

                <ListCard
                    icon={CreditCardIcon}
                    title="Recent payments"
                    description="The last eight M-Pesa payments"
                    tools={
                        <Button asChild variant="ghost" size="sm">
                            <Link href="/merchant/payments">
                                View all <ArrowRightIcon />
                            </Link>
                        </Button>
                    }
                >
                    {loading ? (
                        <TableSkeleton
                            rows={8}
                            delay={5}
                            columns={[
                                { kind: "mono" },
                                { kind: "mono", className: "@max-xl:hidden" },
                                { kind: "amount" },
                                { kind: "badge" },
                                { kind: "time", className: "@max-md:hidden" },
                            ]}
                        />
                    ) : data.payments.length ? (
                        <Table className={reveal}>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>M-Pesa ref</TableHead>
                                    <TableHead className="@max-xl:hidden">Reference</TableHead>
                                    <TableHead>Amount</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="@max-md:hidden">Time</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {data.payments.map((payment) => (
                                    <TableRow key={payment.id}>
                                        <TableCell className="font-mono text-xs">{payment.trans_id || "—"}</TableCell>
                                        <TableCell className="text-muted-foreground font-mono text-xs @max-xl:hidden">
                                            {payment.payment_reference || "—"}
                                        </TableCell>
                                        <TableCell className="tabular font-bold">{kes(payment.amount)}</TableCell>
                                        <TableCell>
                                            <StatusBadge status={payment.status} />
                                        </TableCell>
                                        <TableCell className="text-muted-foreground @max-md:hidden">
                                            {timeOnly(payment.paid_at)}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    ) : (
                        <EmptyState
                            icon={CreditCardIcon}
                            title="No payments yet"
                            description="Register your M-Pesa callbacks under Connections so paybill payments reach this list."
                        />
                    )}
                </ListCard>
            </div>

            {loading ? null : (
                <p className="text-muted-foreground mt-2 text-xs">
                    Last refreshed {dateTime(new Date().toISOString())} EAT
                </p>
            )}
        </>
    );
}
