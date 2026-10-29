"use client";

import * as React from "react";
import { ChevronDownIcon, CreditCardIcon, DownloadIcon, PrinterIcon, SearchIcon, SheetIcon } from "lucide-react";

import { ListCard } from "@/components/list-card";
import { TablePagination, usePagination } from "@/components/table-pagination";
import { PageHero } from "@/components/page-hero";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState, ErrorState, LoadingRows } from "@/components/states";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useApi } from "@/hooks/use-api";
import { api } from "@/lib/api";
import { type ExportColumn, csvDate, downloadCsv, printReport, today } from "@/lib/export";
import { dateTime, kes, statusLabel } from "@/lib/format";
import type { ConnectionsPayload, Payment } from "@/lib/types";

const STATUSES = ["All statuses", "MATCHED", "UNMATCHED", "AMOUNT_MISMATCH"];

/* Everything the API knows about a payment, not just what fits on screen. */
const EXPORT_COLUMNS: ExportColumn<Payment>[] = [
    { header: "M-Pesa ref", value: (p) => p.trans_id || "—", csv: (p) => p.trans_id ?? "", mono: true },
    { header: "Payer", value: (p) => p.payer_name || "—", csv: (p) => p.payer_name ?? "" },
    { header: "Order reference", value: (p) => p.bill_ref_number || "—", csv: (p) => p.bill_ref_number ?? "", mono: true },
    { header: "Shortcode", value: (p) => p.business_shortcode || "—", csv: (p) => p.business_shortcode ?? "", mono: true },
    { header: "Status", value: (p) => statusLabel(p.status) },
    { header: "Match", value: (p) => (p.match_method ? statusLabel(p.match_method) : "—"), csv: (p) => p.match_method ?? "" },
    { header: "Paid", value: (p) => dateTime(p.paid_at ?? p.created_at), csv: (p) => csvDate(p.paid_at ?? p.created_at) },
    { header: "Amount", value: (p) => kes(p.amount), csv: (p) => Number(p.amount), align: "right" },
];

const sum = (rows: Payment[]) => rows.reduce((total, p) => total + Number(p.amount || 0), 0);

export default function PaymentsPage() {
    const [query, setQuery] = React.useState("");
    const [status, setStatus] = React.useState(STATUSES[0]);

    const payments = useApi<{ payments: Payment[] }>(
        () => api.payments() as unknown as Promise<{ payments: Payment[] }>
    );

    const all = payments.data?.payments ?? [];

    const visible = all.filter((payment) => {
        const matchesStatus = status === STATUSES[0] || payment.status === status;
        const haystack = `${payment.trans_id ?? ""} ${payment.bill_ref_number ?? ""} ${payment.payer_name ?? ""}`.toLowerCase();

        return matchesStatus && haystack.includes(query.toLowerCase().trim());
    });

    const paged = usePagination(visible, `${query}|${status}`);

    /* Only for the report heading; a failure just leaves the heading shorter. */
    const merchant = useApi<ConnectionsPayload>(() => api.connections() as Promise<ConnectionsPayload>).data?.merchant;

    function exportPrint() {
        const matched = visible.filter((p) => p.status === "MATCHED");
        const facts: [string, string][] = [
            ["Status", status],
            ...(query.trim() ? [["Search", `"${query.trim()}"`] as [string, string]] : []),
            ["Payments", String(visible.length)],
            ["Total received", kes(sum(visible))],
            ["Matched", `${matched.length} · ${kes(sum(matched))}`],
            ["Not matched", `${visible.length - matched.length} · ${kes(sum(visible) - sum(matched))}`],
        ];

        printReport(visible, EXPORT_COLUMNS, {
            title: "M-Pesa payments",
            subtitle: merchant ? [merchant.trading_name, merchant.kra_pin && `PIN ${merchant.kra_pin}`].filter(Boolean).join(" · ") : undefined,
            facts,
            totals: EXPORT_COLUMNS.map((c, i) => (i === 0 ? "Total" : i === EXPORT_COLUMNS.length - 1 ? kes(sum(visible)) : "")),
            fileName: `payments-${today()}`,
        });
    }

    return (
        <>
            <PageHero
                crumb="Merchant / Payments"
                title="M-Pesa"
                accent="payments"
                description="Every paybill payment received, and which order it was matched to."
                icon={CreditCardIcon}
            />

            {payments.error ? <ErrorState message={payments.error} onRetry={payments.reload} /> : null}

            <ListCard
                icon={CreditCardIcon}
                title="Payments"
                count={visible.length}
                description="Newest first, by time paid"
                tools={
                    <>
                        <div className="relative">
                            <SearchIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                            <Input
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="Search M-Pesa ref or payer"
                                aria-label="Search payments"
                                className="h-9 pl-9 sm:w-56"
                            />
                        </div>
                        <Select value={status} onValueChange={setStatus}>
                            <SelectTrigger size="sm" className="sm:w-48" aria-label="Filter by status">
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
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm" className="h-9" disabled={!visible.length}>
                                    <DownloadIcon /> Export <ChevronDownIcon className="text-muted-foreground" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-60">
                                <DropdownMenuLabel className="text-muted-foreground text-xs font-normal">
                                    {visible.length === all.length
                                        ? `All ${visible.length} payments`
                                        : `${visible.length} payments matching your filters`}
                                </DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onSelect={exportPrint}>
                                    <PrinterIcon />
                                    <span>
                                        <span className="block">Print or save as PDF</span>
                                        <span className="text-muted-foreground block text-xs">A4 report with totals</span>
                                    </span>
                                </DropdownMenuItem>
                                <DropdownMenuItem onSelect={() => downloadCsv(visible, EXPORT_COLUMNS, `payments-${today()}`)}>
                                    <SheetIcon />
                                    <span>
                                        <span className="block">Download CSV</span>
                                        <span className="text-muted-foreground block text-xs">Opens in Excel or Sheets</span>
                                    </span>
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </>
                }
                footer={<TablePagination pagination={paged} noun="payments" unfiltered={all.length} />}
            >
                {payments.loading ? (
                    <LoadingRows />
                ) : visible.length ? (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>M-Pesa ref</TableHead>
                                <TableHead className="hidden sm:table-cell">Payer</TableHead>
                                <TableHead className="hidden lg:table-cell">Order reference</TableHead>
                                <TableHead>Amount</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="hidden md:table-cell">Paid</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {paged.rows.map((payment) => (
                                <TableRow key={payment.id}>
                                    <TableCell className="font-mono text-xs">{payment.trans_id || "—"}</TableCell>
                                    <TableCell className="hidden sm:table-cell">{payment.payer_name || "—"}</TableCell>
                                    <TableCell className="text-muted-foreground hidden font-mono text-xs lg:table-cell">
                                        {payment.bill_ref_number || "—"}
                                    </TableCell>
                                    <TableCell className="tabular font-bold">{kes(payment.amount)}</TableCell>
                                    <TableCell><StatusBadge status={payment.status} /></TableCell>
                                    <TableCell className="text-muted-foreground hidden md:table-cell">
                                        {dateTime(payment.paid_at ?? payment.created_at)}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                ) : all.length ? (
                    <EmptyState
                        icon={SearchIcon}
                        title="Nothing matches that filter"
                        description="Clear the search box or choose a different status to see your payments again."
                    />
                ) : (
                    <EmptyState
                        icon={CreditCardIcon}
                        title="No payments received yet"
                        description="Register your paybill validation and confirmation URLs under Connections, then a test payment will land here."
                    />
                )}
            </ListCard>
        </>
    );
}
