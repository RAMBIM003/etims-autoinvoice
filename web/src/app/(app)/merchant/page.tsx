"use client";

import * as React from "react";
import Link from "next/link";
import {
    ArrowRightIcon,
    CreditCardIcon,
    FileTextIcon,
    LayoutDashboardIcon,
    PieChartIcon,
    ShoppingCartIcon,
    TrendingUpIcon,
} from "lucide-react";

import { PaymentsDonut } from "@/components/charts/payments-donut";
import { SalesChart, type SalesPoint } from "@/components/charts/sales-chart";
import { ListCard } from "@/components/list-card";
import { PageHero } from "@/components/page-hero";
import { ChartSkeleton, DonutSkeleton, TableSkeleton } from "@/components/skeletons";
import { StatCard } from "@/components/stat-card";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState, ErrorState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useApi } from "@/hooks/use-api";
import { api } from "@/lib/api";
import { dateTime, kes, timeOnly } from "@/lib/format";
import type { DashboardPayload, Payment, Sale } from "@/lib/types";

/** Buckets sales into one point per day for the last `days` days, in EAT. */
function buildSeries(sales: Sale[], days: number): SalesPoint[] {
    const points: SalesPoint[] = [];
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

    const countBy = (status: string) => allPayments.filter((p) => p.status === status).length;
    const matched = countBy("MATCHED");
    const unmatched = countBy("UNMATCHED");
    const mismatch = countBy("AMOUNT_MISMATCH");
    const otherPayments = Math.max(0, allPayments.length - matched - unmatched - mismatch);

    if (dashboard.error) {
        return (
            <>
                <PageHero
                    crumb="Merchant / Dashboard"
                    title="Your"
                    accent="dashboard"
                    description="Live transaction view for your eTIMS AutoInvoice account."
                    icon={LayoutDashboardIcon}
                />
                <ErrorState message={dashboard.error} onRetry={dashboard.reload} />
            </>
        );
    }

    const todaySeries = series.map((p) => p.sales);
    const ordersSeries = series.map((p) => p.orders);

    /* The page frame renders straight away; each panel fills in as its own data lands. */
    const loading = !data;
    const stats = data?.stats;
    const reveal = "animate-in fade-in duration-500";

    return (
        <>
            <PageHero
                crumb="Merchant / Dashboard"
                title="Your"
                accent="dashboard"
                description="Live transaction view for your eTIMS AutoInvoice account."
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

            <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-busy={loading}>
                <StatCard
                    label="Today's sales"
                    value={stats && kes(stats.today_sales)}
                    series={todaySeries}
                    loading={loading}
                    icon={TrendingUpIcon}
                />
                <StatCard
                    label="Orders"
                    value={stats && String(stats.orders)}
                    series={ordersSeries}
                    loading={loading}
                    icon={ShoppingCartIcon}
                    tone="ink"
                />
                <StatCard
                    label="Matched payments"
                    value={stats && String(stats.matched_payments)}
                    delta={
                        stats?.unmatched_payments
                            ? { direction: "down", text: `${stats.unmatched_payments} unmatched` }
                            : undefined
                    }
                    loading={loading}
                    icon={CreditCardIcon}
                />
                <StatCard
                    label="Fiscalized invoices"
                    value={stats && `${stats.fiscalized_invoices} of ${stats.invoices}`}
                    loading={loading}
                    icon={FileTextIcon}
                    tone="ink"
                />
            </div>

            <div className="mb-4 grid items-start gap-3 lg:grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)]">
                <Card>
                    <CardHeader>
                        <span className="bg-primary-soft text-primary grid size-8 shrink-0 place-items-center rounded-lg">
                            <TrendingUpIcon className="size-4" />
                        </span>
                        <CardTitle>Sales overview</CardTitle>
                        <div className="ml-auto">
                            <Select value={range} onValueChange={setRange}>
                                <SelectTrigger size="sm" className="w-36" aria-label="Date range">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="7">Last 7 days</SelectItem>
                                    <SelectItem value="30">Last 30 days</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-muted-foreground mb-1 flex justify-center gap-4 text-xs">
                            <span className="flex items-center gap-1.5">
                                <i className="bg-chart-1 size-2 rounded-full" aria-hidden /> Sales (KES)
                            </span>
                            <span className="flex items-center gap-1.5">
                                <i className="bg-chart-2 size-2 rounded-full" aria-hidden /> Orders
                            </span>
                        </div>
                        {sales.loading ? (
                            <ChartSkeleton />
                        ) : (
                            <div className={reveal}>
                                <SalesChart data={series} />
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <span className="bg-primary-soft text-primary grid size-8 shrink-0 place-items-center rounded-lg">
                            <PieChartIcon className="size-4" />
                        </span>
                        <CardTitle>Payments by status</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {payments.loading ? (
                            <DonutSkeleton />
                        ) : allPayments.length ? (
                            <div className={reveal}>
                                <PaymentsDonut
                                    total={allPayments.length}
                                    caption="payments"
                                    data={[
                                        { name: "Matched", value: matched, colour: "var(--chart-2)" },
                                        { name: "Unmatched", value: unmatched, colour: "var(--chart-4)" },
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
                    </CardContent>
                </Card>
            </div>

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
