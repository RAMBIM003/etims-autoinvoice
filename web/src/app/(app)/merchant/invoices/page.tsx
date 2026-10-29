"use client";

import * as React from "react";
import { FileTextIcon, SearchIcon } from "lucide-react";

import { ANY_DATE, DateRangeFilter, type DateRange, inRange } from "@/components/date-range-filter";
import { ListCard } from "@/components/list-card";
import { TablePagination, usePagination } from "@/components/table-pagination";
import { PageHero } from "@/components/page-hero";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState, ErrorState, LoadingRows } from "@/components/states";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useApi } from "@/hooks/use-api";
import { api } from "@/lib/api";
import { dateTime, kes, statusLabel } from "@/lib/format";
import type { Invoice } from "@/lib/types";

const STATUSES = ["All statuses", "FISCALIZED", "PENDING", "FAILED"];

export default function InvoicesPage() {
    const [query, setQuery] = React.useState("");
    const [status, setStatus] = React.useState(STATUSES[0]);
    const [period, setPeriod] = React.useState<DateRange>(ANY_DATE);

    const invoices = useApi<{ invoices: Invoice[] }>(
        () => api.invoices() as unknown as Promise<{ invoices: Invoice[] }>
    );

    const all = invoices.data?.invoices ?? [];

    const visible = all.filter((invoice) => {
        const matchesStatus = status === STATUSES[0] || invoice.fiscalization_status === status;
        const haystack = `${invoice.invoice_number} ${invoice.buyer_name ?? ""} ${invoice.kra_invoice_number ?? ""}`.toLowerCase();

        return matchesStatus && inRange(invoice.created_at, period) && haystack.includes(query.toLowerCase().trim());
    });

    const paged = usePagination(visible, `${query}|${status}|${period.from}|${period.to}`);

    return (
        <>
            <PageHero
                crumb="Merchant / Invoices"
                title="Fiscal"
                accent="invoices"
                description="Invoices signed by the OSCU control unit and filed against your KRA PIN."
                icon={FileTextIcon}
            />

            {invoices.error ? <ErrorState message={invoices.error} onRetry={invoices.reload} /> : null}

            <ListCard
                icon={FileTextIcon}
                title="Invoices"
                count={visible.length}
                description="Newest first"
                tools={
                    <>
                        <div className="relative">
                            <SearchIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                            <Input
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="Search invoice or CU number"
                                aria-label="Search invoices"
                                className="h-9 pl-9 sm:w-60"
                            />
                        </div>
                        <Select value={status} onValueChange={setStatus}>
                            <SelectTrigger size="sm" className="sm:w-44" aria-label="Filter by status">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {STATUSES.map((s) => (
                                    <SelectItem key={s} value={s}>
                                        {s === STATUSES[0] ? s : statusLabel(s)}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <DateRangeFilter
                            value={period}
                            onChange={setPeriod}
                            hint="Invoices are filtered by the day they were issued, in Nairobi time."
                        />
                    </>
                }
                footer={<TablePagination pagination={paged} noun="invoices" unfiltered={all.length} />}
            >
                {invoices.loading ? (
                    <LoadingRows />
                ) : visible.length ? (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Invoice</TableHead>
                                <TableHead className="hidden sm:table-cell">Buyer</TableHead>
                                <TableHead className="hidden lg:table-cell">Buyer PIN</TableHead>
                                <TableHead>Tax</TableHead>
                                <TableHead>Total</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="hidden md:table-cell">CU number</TableHead>
                                <TableHead className="hidden xl:table-cell">Fiscalized</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {paged.rows.map((invoice) => (
                                <TableRow key={invoice.id}>
                                    <TableCell className="font-mono text-xs">{invoice.invoice_number}</TableCell>
                                    <TableCell className="hidden sm:table-cell">
                                        {invoice.buyer_name || "Walk-in buyer"}
                                    </TableCell>
                                    <TableCell className="text-muted-foreground hidden font-mono text-xs lg:table-cell">
                                        {invoice.buyer_pin || "—"}
                                    </TableCell>
                                    <TableCell className="tabular">{kes(invoice.tax_amount)}</TableCell>
                                    <TableCell className="tabular font-bold">{kes(invoice.total_amount)}</TableCell>
                                    <TableCell><StatusBadge status={invoice.fiscalization_status} /></TableCell>
                                    <TableCell className="text-muted-foreground hidden font-mono text-xs md:table-cell">
                                        {invoice.kra_invoice_number || invoice.kra_receipt_number || "—"}
                                    </TableCell>
                                    <TableCell className="text-muted-foreground hidden xl:table-cell">
                                        {invoice.fiscalized_at ? dateTime(invoice.fiscalized_at) : (
                                            <Badge variant="outline">Not yet</Badge>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                ) : all.length ? (
                    <EmptyState
                        icon={SearchIcon}
                        title="Nothing matches that filter"
                        description="Clear the search box, choose a different status or widen the dates to see your invoices again."
                    />
                ) : (
                    <EmptyState
                        icon={FileTextIcon}
                        title="No invoices yet"
                        description="An invoice is created automatically when a payment is matched to an order and the control unit signs it."
                    />
                )}
            </ListCard>
        </>
    );
}
