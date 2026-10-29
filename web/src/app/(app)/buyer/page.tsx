"use client";

import * as React from "react";
import {
    AlertTriangleIcon,
    CalendarSearchIcon,
    ExternalLinkIcon,
    MessageSquareIcon,
    ReceiptIcon,
    SearchIcon,
    ShoppingCartIcon,
    WalletIcon,
} from "lucide-react";
import { toast } from "sonner";

import { ANY_DATE, DateRangeFilter, type DateRange, dayKey, inRange } from "@/components/date-range-filter";
import { PageHero } from "@/components/page-hero";
import { PurchaseStage, type StageGroup, stageInfo } from "@/components/purchase-stage";
import { StatCard } from "@/components/stat-card";
import { EmptyState, ErrorState } from "@/components/states";
import { TablePagination, usePagination } from "@/components/table-pagination";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useApi } from "@/hooks/use-api";
import { ApiError, api } from "@/lib/api";
import { initials, timeOnly } from "@/lib/format";
import type { BuyerPurchase } from "@/lib/types";

/* `short` is what a phone shows, so all four tabs fit without scrolling. */
const TABS: { value: "all" | StageGroup; label: string; short: string }[] = [
    { value: "all", label: "All", short: "All" },
    { value: "progress", label: "In progress", short: "Active" },
    { value: "ready", label: "Receipt ready", short: "Ready" },
    { value: "attention", label: "Needs attention", short: "Issues" },
];

/* Stages where the buyer's money has left their M-Pesa. */
const PAID = new Set(["PAYMENT_RECEIVED", "FISCALIZING", "RECEIPT_READY", "FISCALIZATION_FAILED"]);

/** Purchases always show cents: KES 806.20. */
function money(value: unknown) {
    const n = Number(value ?? 0);

    return `KES ${(Number.isFinite(n) ? n : 0).toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** "Today", "Yesterday", "Mon, 27 Oct", with the year only when it is not this one. */
function dayHeading(key: string, today: string) {
    const yesterday = new Date(`${today}T12:00:00Z`);

    yesterday.setUTCDate(yesterday.getUTCDate() - 1);

    if (key === today) return "Today";
    if (key === yesterday.toISOString().slice(0, 10)) return "Yesterday";

    return new Date(`${key}T12:00:00Z`).toLocaleDateString("en-KE", {
        timeZone: "UTC",
        weekday: "short",
        day: "numeric",
        month: "short",
        year: key.slice(0, 4) === today.slice(0, 4) ? undefined : "numeric",
    });
}

function itemSummary(purchase: BuyerPurchase) {
    const items = purchase.items ?? [];

    if (!items.length) return null;

    const named = items
        .slice(0, 2)
        .map((i) => `${i.item_name}${Number(i.quantity) !== 1 ? ` × ${Number(i.quantity)}` : ""}`)
        .join(", ");

    return items.length > 2 ? `${named} and ${items.length - 2} more` : named;
}

export default function BuyerPurchasesPage() {
    const purchases = useApi<{ orders: BuyerPurchase[] }>(
        () => api.buyerOrders() as unknown as Promise<{ orders: BuyerPurchase[] }>
    );

    const [tab, setTab] = React.useState<(typeof TABS)[number]["value"]>("all");
    const [query, setQuery] = React.useState("");
    const [period, setPeriod] = React.useState<DateRange>(ANY_DATE);

    const all = React.useMemo(() => purchases.data?.orders ?? [], [purchases.data]);
    const today = dayKey(new Date());

    const counts = React.useMemo(() => {
        const by = (group: StageGroup) => all.filter((p) => stageInfo(p.stage).group === group).length;

        return { all: all.length, progress: by("progress"), ready: by("ready"), attention: by("attention"), cancelled: by("cancelled") };
    }, [all]);

    const spentThisMonth = all
        .filter((p) => PAID.has(p.stage) && dayKey(p.order.created_at).slice(0, 7) === today.slice(0, 7))
        .reduce((total, p) => total + Number(p.order.total_amount || 0), 0);

    const needle = query.toLowerCase().trim();
    const visible = all.filter((p) => {
        const matchesTab = tab === "all" || stageInfo(p.stage).group === tab;
        const haystack = [
            p.order.merchant_name,
            p.order.order_reference,
            p.invoice?.number,
            p.invoice?.kra_receipt_number,
            p.payment?.trans_id,
            ...(p.items ?? []).map((i) => i.item_name),
        ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();

        return matchesTab && inRange(p.order.created_at, period) && haystack.includes(needle);
    });

    const paged = usePagination(visible, `${tab}|${needle}|${period.from}|${period.to}`);

    /* Consecutive purchases on the same day share one heading. */
    const groups = paged.rows.reduce<{ key: string; items: BuyerPurchase[] }[]>((acc, purchase) => {
        const key = dayKey(purchase.order.created_at);
        const last = acc[acc.length - 1];

        if (last?.key === key) last.items.push(purchase);
        else acc.push({ key, items: [purchase] });

        return acc;
    }, []);

    async function resend(invoiceId: string) {
        try {
            await api.sendReceiptSms(invoiceId);
            toast.success("Receipt link sent to your phone.");
        } catch (error) {
            toast.error(error instanceof ApiError ? error.message : "The receipt could not be sent.");
        }
    }

    const loading = purchases.loading;

    return (
        <>
            <PageHero
                crumb="Buyer / Purchases"
                title="My"
                accent="purchases"
                description="Everything you have bought, and where each fiscal receipt has got to."
                icon={ShoppingCartIcon}
            />

            {purchases.error ? <ErrorState message={purchases.error} onRetry={purchases.reload} /> : null}

            {/* On a phone the headline figure takes the full width and the two counts share a row. */}
            <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                <div className="col-span-2 sm:col-span-1">
                    <StatCard label="Spent this month" value={money(spentThisMonth)} icon={WalletIcon} loading={loading} />
                </div>
                <StatCard
                    label="Receipts ready"
                    value={`${counts.ready} of ${counts.all - counts.cancelled}`}
                    icon={ReceiptIcon}
                    tone="ink"
                    loading={loading}
                />
                <StatCard
                    label="Needs attention"
                    value={String(counts.attention)}
                    delta={counts.attention ? { direction: "down", text: "A merchant has to act" } : undefined}
                    icon={AlertTriangleIcon}
                    tone={counts.attention ? "brand" : "ink"}
                    loading={loading}
                />
            </div>

            <Card className="mb-4 gap-3 p-3 sm:p-4">
                <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
                    <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)} className="min-w-0">
                        <TabsList className="no-scrollbar w-full max-w-full justify-start overflow-x-auto lg:w-fit">
                            {TABS.map((t) => (
                                <TabsTrigger key={t.value} value={t.value} className="shrink-0 gap-1.5" aria-label={t.label}>
                                    <span className="sm:hidden">{t.short}</span>
                                    <span className="hidden sm:inline">{t.label}</span>
                                    <span
                                        className={
                                            t.value === "attention" && counts.attention
                                                ? "bg-bad text-white rounded-full px-1.5 text-[10px] leading-4 font-bold tabular"
                                                : "text-muted-foreground tabular text-[11px]"
                                        }
                                    >
                                        {loading ? "–" : counts[t.value]}
                                    </span>
                                </TabsTrigger>
                            ))}
                        </TabsList>
                    </Tabs>
                    <div className="flex items-center gap-2 lg:ml-auto">
                        <div className="relative min-w-0 flex-1 lg:w-72 lg:flex-none">
                            <SearchIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                            <Input
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="Search shop, item, order or receipt"
                                aria-label="Search purchases"
                                className="h-9 pl-9"
                            />
                        </div>
                        <DateRangeFilter
                            value={period}
                            onChange={setPeriod}
                            hint="Purchases are filtered by the day you bought, in Nairobi time."
                        />
                    </div>
                </div>
            </Card>

            {loading ? (
                <PurchasesSkeleton />
            ) : visible.length ? (
                <div className="grid gap-5">
                    {groups.map((group) => (
                        <section key={group.key} aria-labelledby={`day-${group.key}`}>
                            <h2
                                id={`day-${group.key}`}
                                className="text-muted-foreground mb-2 px-1 text-xs font-bold tracking-wider uppercase"
                            >
                                {dayHeading(group.key, today)}
                            </h2>
                            <div className="grid gap-3">
                                {group.items.map((purchase) => (
                                    <PurchaseCard key={purchase.order.id} purchase={purchase} onResend={resend} />
                                ))}
                            </div>
                        </section>
                    ))}
                    <div className="text-muted-foreground flex flex-wrap items-center justify-between gap-3 px-1 text-sm">
                        <TablePagination pagination={paged} noun="purchases" unfiltered={all.length} />
                    </div>
                </div>
            ) : all.length ? (
                <Card>
                    <EmptyState
                        icon={period.from || period.to ? CalendarSearchIcon : SearchIcon}
                        title="No purchases match"
                        description="Try another tab, clear the search, or widen the dates."
                        action={
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                    setTab("all");
                                    setQuery("");
                                    setPeriod(ANY_DATE);
                                }}
                            >
                                Show all purchases
                            </Button>
                        }
                    />
                </Card>
            ) : (
                <Card>
                    <EmptyState
                        icon={ShoppingCartIcon}
                        title="No purchases yet"
                        description="When you pay a merchant who uses eTIMS AutoInvoice, the order and its fiscal receipt appear here."
                    />
                </Card>
            )}
        </>
    );
}

function PurchaseCard({ purchase, onResend }: { purchase: BuyerPurchase; onResend: (invoiceId: string) => void }) {
    const { order, invoice, payment } = purchase;
    const info = stageInfo(purchase.stage);
    const summary = itemSummary(purchase);
    const ready = purchase.stage === "RECEIPT_READY";

    return (
        <Card className="gap-0 overflow-hidden p-0">
            <div className="flex items-start gap-3 p-4 sm:p-5">
                <span
                    aria-hidden
                    className="bg-primary-soft text-primary font-display grid size-10 shrink-0 place-items-center rounded-xl text-sm font-extrabold"
                >
                    {initials(order.merchant_name || "Merchant")}
                </span>
                <div className="min-w-0 flex-1">
                    <p className="font-display truncate text-[15px] font-bold">{order.merchant_name || "Merchant"}</p>
                    {summary ? <p className="truncate text-[13px]">{summary}</p> : null}
                    <p className="text-muted-foreground mt-0.5 text-xs">
                        {timeOnly(order.created_at)} · <span className="font-mono">{order.order_reference}</span>
                    </p>
                </div>
                <div className="shrink-0 text-right">
                    <p className="tabular font-display text-base font-extrabold sm:text-lg">{money(order.total_amount)}</p>
                    <Badge variant={info.tone} dot className="mt-1">
                        {info.label}
                    </Badge>
                </div>
            </div>

            <div className="px-4 pb-4 sm:px-5">
                <PurchaseStage stage={purchase.stage} paid={payment?.amount} total={order.total_amount} />
            </div>

            {payment?.trans_id || invoice ? (
                <div className="bg-muted/60 flex flex-wrap items-center gap-x-4 gap-y-2 border-t px-4 py-2.5 sm:px-5">
                    <dl className="text-muted-foreground flex min-w-0 flex-wrap gap-x-4 gap-y-0.5 text-xs">
                        {payment?.trans_id ? (
                            <div className="flex gap-1">
                                <dt>M-Pesa</dt>
                                <dd className="text-foreground font-mono font-semibold">{payment.trans_id}</dd>
                            </div>
                        ) : null}
                        {invoice ? (
                            <div className="flex gap-1">
                                <dt>Invoice</dt>
                                <dd className="text-foreground font-mono font-semibold">{invoice.number}</dd>
                            </div>
                        ) : null}
                        {invoice?.kra_receipt_number ? (
                            <div className="flex gap-1">
                                <dt>KRA receipt</dt>
                                <dd className="text-foreground font-mono font-semibold">{invoice.kra_receipt_number}</dd>
                            </div>
                        ) : null}
                    </dl>
                    {ready && invoice ? (
                        <div className="ml-auto flex gap-2">
                            <Button size="sm" variant="ghost" onClick={() => onResend(invoice.id)}>
                                <MessageSquareIcon /> Text it to me
                            </Button>
                            {purchase.receipt_url ? (
                                <Button asChild size="sm">
                                    <a href={purchase.receipt_url} target="_blank" rel="noreferrer">
                                        <ExternalLinkIcon /> View receipt
                                    </a>
                                </Button>
                            ) : null}
                        </div>
                    ) : null}
                </div>
            ) : null}
        </Card>
    );
}

/** Two days of placeholder cards, shaped like the real ones. */
function PurchasesSkeleton() {
    return (
        <div className="grid gap-5" role="status" aria-label="Loading purchases">
            {[2, 1].map((cards, g) => (
                <div key={g} className="grid gap-3">
                    <Skeleton className="ml-1 h-3 w-20 rounded-full" />
                    {Array.from({ length: cards }).map((_, i) => (
                        <Card key={i} className="grid gap-4 p-4 sm:p-5">
                            <div className="flex items-start gap-3">
                                <Skeleton className="size-10 shrink-0 rounded-xl" />
                                <div className="grid flex-1 gap-2">
                                    <Skeleton className="h-4 w-40" />
                                    <Skeleton className="h-3 w-56 max-w-full rounded-full" />
                                    <Skeleton className="h-2.5 w-32 rounded-full" />
                                </div>
                                <div className="grid justify-items-end gap-2">
                                    <Skeleton className="h-5 w-24" />
                                    <Skeleton className="h-5 w-20 rounded-full" />
                                </div>
                            </div>
                            <div className="flex justify-between px-4">
                                {[0, 1, 2, 3].map((s) => (
                                    <Skeleton key={s} className="size-5 rounded-full" />
                                ))}
                            </div>
                        </Card>
                    ))}
                </div>
            ))}
        </div>
    );
}
