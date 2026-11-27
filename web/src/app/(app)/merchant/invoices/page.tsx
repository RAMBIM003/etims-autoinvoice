"use client";

import * as React from "react";
import Link from "next/link";
import {
    ChevronDownIcon,
    DownloadIcon,
    EyeIcon,
    FileTextIcon,
    MoreHorizontalIcon,
    PrinterIcon,
    RotateCwIcon,
    SearchIcon,
    SheetIcon,
} from "lucide-react";
import { toast } from "sonner";

import { ANY_DATE, DateRangeFilter, type DateRange, describeRange, inRange, isActive } from "@/components/date-range-filter";
import { ListCard } from "@/components/list-card";
import { riseStyle, useFreshRows } from "@/components/live-rows";
import { RecordPanel, invoiceRecord, type PanelRecord } from "@/components/record-panel";
import { ExpandToggle, ExpandedRow, InvoiceDetails } from "@/components/row-detail";
import { TablePagination, usePagination } from "@/components/table-pagination";
import { PageHero } from "@/components/page-hero";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState, ErrorState, LoadingRows } from "@/components/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useApi } from "@/hooks/use-api";
import { ApiError, api } from "@/lib/api";
import { type ExportColumn, csvDate, downloadCsv, printReport, today } from "@/lib/export";
import { dateTime, kes, statusLabel } from "@/lib/format";
import type { Invoice } from "@/lib/types";
import { cn } from "@/lib/utils";

const STATUSES = ["All statuses", "FISCALIZED", "PENDING", "FAILED"];

/* The left edge of a row shows what needs attention: amber while waiting, red when it failed. */
const TONE: Record<string, string> = {
    PENDING: "[&>td:first-child]:shadow-[inset_3px_0_0_var(--warn)]",
    FAILED: "[&>td:first-child]:shadow-[inset_3px_0_0_var(--primary)]",
};

const EXPORT_COLUMNS: ExportColumn<Invoice>[] = [
    { header: "Invoice", value: (i) => i.invoice_number, mono: true },
    { header: "Buyer", value: (i) => i.buyer_name || "Walk-in buyer", csv: (i) => i.buyer_name ?? "" },
    { header: "Buyer PIN", value: (i) => i.buyer_pin || "—", csv: (i) => i.buyer_pin ?? "", mono: true },
    { header: "Payment reference", value: (i) => i.payment_trans_id || "—", csv: (i) => i.payment_trans_id ?? "", mono: true },
    { header: "Status", value: (i) => statusLabel(i.fiscalization_status) },
    {
        header: "CU number",
        value: (i) => i.kra_invoice_number || i.kra_receipt_number || "—",
        csv: (i) => i.kra_invoice_number || i.kra_receipt_number || "",
        mono: true,
    },
    { header: "Issued", value: (i) => dateTime(i.created_at), csv: (i) => csvDate(i.created_at) },
    { header: "Tax", value: (i) => kes(i.tax_amount), csv: (i) => Number(i.tax_amount ?? 0), align: "right" },
    { header: "Total", value: (i) => kes(i.total_amount), csv: (i) => Number(i.total_amount), align: "right" },
];

const sum = (rows: Invoice[]) => rows.reduce((total, i) => total + Number(i.total_amount || 0), 0);

export default function InvoicesPage() {
    const [query, setQuery] = React.useState("");
    const [status, setStatus] = React.useState(STATUSES[0]);
    const [period, setPeriod] = React.useState<DateRange>(ANY_DATE);
    const [panel, setPanel] = React.useState<PanelRecord | null>(null);
    const [expanded, setExpanded] = React.useState<string | null>(null);
    const closePanel = React.useCallback(() => setPanel(null), []);

    const invoices = useApi<{ invoices: Invoice[] }>(
        () => api.invoices() as unknown as Promise<{ invoices: Invoice[] }>,
        "",
        { refreshMs: 15000 }
    );

    const all = invoices.data?.invoices ?? [];
    const fresh = useFreshRows(all, (i) => i.id, (i) => i.fiscalization_status);

    const visible = all.filter((invoice) => {
        const matchesStatus = status === STATUSES[0] || invoice.fiscalization_status === status;
        const haystack = [
            invoice.invoice_number,
            invoice.buyer_name,
            invoice.buyer_pin,
            invoice.kra_invoice_number,
            invoice.cu_serial_number,
            invoice.payment_trans_id,
        ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();

        return matchesStatus && inRange(invoice.created_at, period) && haystack.includes(query.toLowerCase().trim());
    });

    const paged = usePagination(visible, `${query}|${status}|${period.from}|${period.to}`);

    /* "invoices-2026-10-01-to-2026-10-29" when a period is set, else today's date. */
    const exportName = `invoices-${isActive(period) ? `${period.from || "start"}-to-${period.to || today()}` : today()}`;

    function exportPrint() {
        const facts: [string, string][] = [
            ["Period", describeRange(period)],
            ["Status", status],
            ...(query.trim() ? [["Search", `"${query.trim()}"`] as [string, string]] : []),
            ["Invoices", String(visible.length)],
            ["Total invoiced", kes(sum(visible))],
        ];

        printReport(visible, EXPORT_COLUMNS, {
            title: "Fiscal invoices",
            facts,
            totals: EXPORT_COLUMNS.map((c, i) => (i === 0 ? "Total" : i === EXPORT_COLUMNS.length - 1 ? kes(sum(visible)) : "")),
            fileName: exportName,
        });
    }

    return (
        <>
            <PageHero
                title="Fiscal"
                accent="invoices"
                description="Every invoice sent to KRA, and whether it was accepted."
                icon={FileTextIcon}
            />

            {invoices.error ? <ErrorState message={invoices.error} onRetry={invoices.reload} /> : null}

            <ListCard
                icon={FileTextIcon}
                title="Invoices"
                count={visible.length}
                description="Newest first. Updates every 15 seconds."
                tools={
                    <>
                        <div className="relative">
                            <SearchIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                            <Input
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="Search invoice, buyer or CU number"
                                aria-label="Search invoices"
                                className="h-9 pl-9 sm:w-64"
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
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm" className="h-9" disabled={!visible.length}>
                                    <DownloadIcon /> Export <ChevronDownIcon className="text-muted-foreground" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-60">
                                <DropdownMenuLabel className="text-muted-foreground text-xs font-normal">
                                    {visible.length === all.length
                                        ? `All ${visible.length} invoices`
                                        : `${visible.length} invoices matching your filters`}
                                </DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onSelect={exportPrint}>
                                    <PrinterIcon />
                                    <span>
                                        <span className="block">Print or save as PDF</span>
                                        <span className="text-muted-foreground block text-xs">A4 report with totals</span>
                                    </span>
                                </DropdownMenuItem>
                                <DropdownMenuItem onSelect={() => downloadCsv(visible, EXPORT_COLUMNS, exportName)}>
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
                footer={<TablePagination pagination={paged} noun="invoices" unfiltered={all.length} />}
            >
                {invoices.loading ? (
                    <LoadingRows />
                ) : visible.length ? (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-10">
                                    <span className="sr-only">Details</span>
                                </TableHead>
                                <TableHead>Invoice</TableHead>
                                <TableHead className="hidden sm:table-cell">Buyer</TableHead>
                                <TableHead className="hidden lg:table-cell">Payment reference</TableHead>
                                <TableHead>Total</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="hidden md:table-cell">CU number</TableHead>
                                <TableHead className="hidden xl:table-cell">Fiscalized</TableHead>
                                <TableHead className="w-10">
                                    <span className="sr-only">Actions</span>
                                </TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {paged.rows.map((invoice, index) => (
                                <React.Fragment key={invoice.id}>
                                    <TableRow
                                        className={cn(
                                            "row-rise cursor-pointer",
                                            TONE[invoice.fiscalization_status],
                                            panel?.id === invoice.id &&
                                                "bg-accent/60 [&>td:first-child]:shadow-[inset_3px_0_0_var(--primary)]",
                                            fresh.has(invoice.id) && "row-fresh"
                                        )}
                                        style={riseStyle(index)}
                                        onClick={() => setPanel(invoiceRecord(invoice))}
                                    >
                                        <TableCell className="w-10 pr-0">
                                            <ExpandToggle
                                                open={expanded === invoice.id}
                                                onToggle={() => setExpanded((cur) => (cur === invoice.id ? null : invoice.id))}
                                                label={invoice.invoice_number}
                                            />
                                        </TableCell>
                                        <TableCell className="font-mono text-xs">
                                            <Link
                                                href={`/invoices/${invoice.id}`}
                                                className="text-primary font-semibold underline-offset-4 hover:underline focus-visible:underline"
                                                title="Open invoice"
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                {invoice.invoice_number}
                                            </Link>
                                        </TableCell>
                                        <TableCell className="hidden sm:table-cell">
                                            {invoice.buyer_name || "Walk-in buyer"}
                                        </TableCell>
                                        <TableCell className="text-muted-foreground hidden font-mono text-xs lg:table-cell">
                                            {invoice.payment_trans_id || "—"}
                                        </TableCell>
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
                                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                                            <InvoiceActions
                                                id={invoice.id}
                                                number={invoice.invoice_number}
                                                saleId={invoice.sale_id}
                                                status={invoice.fiscalization_status}
                                                onChanged={invoices.reload}
                                            />
                                        </TableCell>
                                    </TableRow>

                                    {expanded === invoice.id ? (
                                        <ExpandedRow colSpan={9}>
                                            <InvoiceDetails invoice={invoice} />
                                        </ExpandedRow>
                                    ) : null}
                                </React.Fragment>
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

            {panel ? (
                <RecordPanel
                    title={panel.title}
                    description={panel.description}
                    fields={panel.fields}
                    href={panel.href}
                    onClose={closePanel}
                />
            ) : null}
        </>
    );
}

/** View, print and (when it is not signed yet) retry fiscalization, behind the row's "⋯" button. */
function InvoiceActions({
    id, number, saleId, status, onChanged,
}: { id: string; number: string; saleId: string; status: string; onChanged: () => void }) {
    const [retrying, setRetrying] = React.useState(false);
    const canRetry = status === "PENDING" || status === "FAILED";

    /* Only for an invoice KRA refused as already existing; the server checks this and says why if not. */
    const canRelease = status === "FAILED" || status === "NEEDS_CHECK";

    async function release() {
        try {
            const out = await api.releaseKraNumber(id);
            toast.success(`${number} released KRA number ${out.released_number}. Retry it to send it again.`);
        } catch (error) {
            toast.error(error instanceof ApiError ? error.message : "This invoice's number could not be released.");
        } finally {
            onChanged();
        }
    }

    async function retry() {
        setRetrying(true);

        try {
            await api.fiscalize(saleId);
            toast.success(`${number} was sent to KRA.`);
        } catch (error) {
            toast.error(error instanceof ApiError ? error.message : "KRA did not fiscalize this invoice.");
        } finally {
            setRetrying(false);
            onChanged();
        }
    }

    return (
        <div className="flex items-center justify-end gap-2">
        {canRetry ? (
            <Button
                size="icon-sm"
                disabled={retrying}
                onClick={retry}
                aria-label={`Retry fiscalization for ${number}`}
                title="Retry fiscalization"
                className="rounded-full bg-amber-500 text-white hover:bg-amber-600"
            >
                <RotateCwIcon className={retrying ? "animate-spin" : undefined} />
            </Button>
        ) : null}
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${number}`}>
                    <MoreHorizontalIcon />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel className="text-muted-foreground font-mono text-xs font-normal">{number}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                    <Link href={`/invoices/${id}`}>
                        <EyeIcon /> View invoice
                    </Link>
                </DropdownMenuItem>
                {/* A new tab keeps the list where it was; that tab prints itself once the invoice is drawn. */}
                <DropdownMenuItem onSelect={() => window.open(`/invoices/${id}?print=1`, "_blank", "noopener")}>
                    <PrinterIcon /> Print invoice
                </DropdownMenuItem>
                {canRelease ? (
                    <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onSelect={release}>
                            <RotateCwIcon /> Release KRA number
                        </DropdownMenuItem>
                    </>
                ) : null}
            </DropdownMenuContent>
        </DropdownMenu>
        </div>
    );
}
