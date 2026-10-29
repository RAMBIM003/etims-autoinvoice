"use client";

import * as React from "react";
import { CalendarSearchIcon, ExternalLinkIcon, ReceiptIcon } from "lucide-react";

import { ANY_DATE, DateRangeFilter, type DateRange, inRange } from "@/components/date-range-filter";
import { ListCard } from "@/components/list-card";
import { TablePagination, usePagination } from "@/components/table-pagination";
import { PageHero } from "@/components/page-hero";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState, ErrorState, LoadingRows } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useApi } from "@/hooks/use-api";
import { api } from "@/lib/api";
import { dateTime, kes } from "@/lib/format";
import type { BuyerPurchase } from "@/lib/types";

export default function BuyerReceiptsPage() {
    const purchases = useApi<{ orders: BuyerPurchase[] }>(
        () => api.buyerOrders() as unknown as Promise<{ orders: BuyerPurchase[] }>
    );

    const [period, setPeriod] = React.useState<DateRange>(ANY_DATE);

    const all = (purchases.data?.orders ?? []).filter((p) => p.invoice);
    const receipts = all.filter((p) => inRange(p.order.created_at, period));
    const paged = usePagination(receipts, `${period.from}|${period.to}`);

    return (
        <>
            <PageHero
                crumb="Buyer / Receipts"
                title="Fiscal"
                accent="receipts"
                description="Receipts signed by KRA. Each one carries the control unit number your invoice was filed under."
                icon={ReceiptIcon}
            />

            {purchases.error ? <ErrorState message={purchases.error} onRetry={purchases.reload} /> : null}

            <ListCard
                icon={ReceiptIcon}
                title="Receipts"
                count={receipts.length}
                description="Newest first"
                tools={
                    <DateRangeFilter
                        value={period}
                        onChange={setPeriod}
                        hint="Receipts are filtered by the day you made the purchase, in Nairobi time."
                    />
                }
                footer={<TablePagination pagination={paged} noun="receipts" unfiltered={all.length} />}
            >
                {purchases.loading ? (
                    <LoadingRows />
                ) : receipts.length ? (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Invoice</TableHead>
                                <TableHead className="hidden sm:table-cell">Merchant</TableHead>
                                <TableHead>Amount</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="hidden md:table-cell">CU number</TableHead>
                                <TableHead className="hidden lg:table-cell">Date</TableHead>
                                <TableHead />
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {paged.rows.map((purchase) => (
                                <TableRow key={purchase.invoice!.id}>
                                    <TableCell className="font-mono text-xs">{purchase.invoice!.number}</TableCell>
                                    <TableCell className="hidden sm:table-cell">
                                        {purchase.order.merchant_name || "—"}
                                    </TableCell>
                                    <TableCell className="tabular font-bold">{kes(purchase.order.total_amount)}</TableCell>
                                    <TableCell><StatusBadge status={purchase.invoice!.status} /></TableCell>
                                    <TableCell className="text-muted-foreground hidden font-mono text-xs md:table-cell">
                                        {purchase.invoice!.kra_receipt_number || "—"}
                                    </TableCell>
                                    <TableCell className="text-muted-foreground hidden lg:table-cell">
                                        {dateTime(purchase.order.created_at)}
                                    </TableCell>
                                    <TableCell>
                                        {purchase.receipt_url ? (
                                            <Button asChild size="icon-sm" variant="outline" aria-label="Open receipt">
                                                <a href={purchase.receipt_url} target="_blank" rel="noreferrer">
                                                    <ExternalLinkIcon />
                                                </a>
                                            </Button>
                                        ) : null}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                ) : all.length ? (
                    <EmptyState
                        icon={CalendarSearchIcon}
                        title="No receipts in these dates"
                        description="Widen the date range or clear the filter to see all your receipts."
                    />
                ) : (
                    <EmptyState
                        icon={ReceiptIcon}
                        title="No receipts yet"
                        description="A receipt appears once a merchant's invoice for your purchase has been signed by the control unit."
                    />
                )}
            </ListCard>
        </>
    );
}
