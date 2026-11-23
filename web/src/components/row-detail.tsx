"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronRightIcon, EyeIcon } from "lucide-react";

import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { TableCell, TableRow } from "@/components/ui/table";
import { useApi } from "@/hooks/use-api";
import { api } from "@/lib/api";
import { dateTime, kes, statusLabel } from "@/lib/format";
import type { Invoice, InvoiceDetail, InvoiceLine, Payment, Sale } from "@/lib/types";
import { cn } from "@/lib/utils";

type SaleDetail = { sale: Sale; items: InvoiceLine[]; payments: Payment[]; invoices: Invoice[] };

/** The chevron at the start of a row. It opens the row's details underneath; it does not open the side panel. */
export function ExpandToggle({ open, onToggle, label }: { open: boolean; onToggle: () => void; label: string }) {
    return (
        <Button
            variant="ghost"
            size="icon-sm"
            aria-expanded={open}
            aria-label={`${open ? "Hide" : "Show"} details for ${label}`}
            onClick={(event) => {
                event.stopPropagation();
                onToggle();
            }}
        >
            <ChevronRightIcon className={cn("transition-transform duration-200", open && "rotate-90")} />
        </Button>
    );
}

/** The strip of details that opens under a record, spanning the whole table. */
export function ExpandedRow({ colSpan, children }: { colSpan: number; children: React.ReactNode }) {
    return (
        <TableRow className="hover:bg-transparent">
            <TableCell
                colSpan={colSpan}
                className="bg-muted/40 group-hover/row:bg-muted/40 p-0 whitespace-normal group-hover/row:first:shadow-none"
            >
                <div className="animate-in fade-in grid gap-6 p-4 duration-300 sm:grid-cols-2 xl:grid-cols-4">
                    {children}
                </div>
            </TableCell>
        </TableRow>
    );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <section className="min-w-0">
            <h3 className="text-muted-foreground mb-2 text-[11px] font-bold tracking-wide uppercase">{title}</h3>
            <div className="grid gap-1.5 text-sm">{children}</div>
        </section>
    );
}

function Line({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
    return (
        <div className="flex items-baseline justify-between gap-3">
            <span className="text-muted-foreground">{label}</span>
            <span className={cn("text-right font-medium break-all", mono && "font-mono text-xs")}>{value}</span>
        </div>
    );
}

function Note({ children }: { children: React.ReactNode }) {
    return <p className="text-muted-foreground text-xs">{children}</p>;
}

/** Items, tax, the M-Pesa payment and what KRA said, for one invoice. */
export function InvoiceDetails({ invoice }: { invoice: Invoice }) {
    const detail = useApi<InvoiceDetail>(
        () => api.invoice(invoice.id) as unknown as Promise<InvoiceDetail>,
        invoice.id
    );

    const items = detail.data?.items ?? [];
    const payment = detail.data?.payment;
    const wait = detail.loading ? <Note>Loading…</Note> : detail.error ? <Note>Could not load these details.</Note> : null;

    const taxByCode = new Map<string, number>();

    for (const line of items) {
        const code = line.tax_type_code || "—";

        taxByCode.set(code, (taxByCode.get(code) ?? 0) + Number(line.tax_amount || 0));
    }

    return (
        <>
            <Block title="Invoice items">
                {wait ??
                    (items.length ? (
                        items.map((line) => (
                            <Line
                                key={line.id}
                                label={`${line.item_name} × ${Number(line.quantity)}`}
                                value={kes(line.line_total)}
                            />
                        ))
                    ) : (
                        <Note>No items on this invoice.</Note>
                    ))}
            </Block>

            <Block title="Tax breakdown">
                {wait ??
                    [...taxByCode].map(([code, amount]) => (
                        <Line key={code} label={`Tax ${code}`} value={kes(amount)} />
                    ))}
                <Line label="Total tax" value={kes(invoice.tax_amount)} />
                <Line label="Total" value={<b>{kes(invoice.total_amount)}</b>} />
            </Block>

            <Block title="M-Pesa transaction">
                {wait ??
                    (payment ? (
                        <>
                            <Line label="Transaction ID" value={payment.trans_id || "—"} mono />
                            <Line label="Payer" value={payment.payer_name || "—"} />
                            <Line label="Paid" value={payment.paid_at ? dateTime(payment.paid_at) : "—"} />
                        </>
                    ) : (
                        <Note>No matched payment on this invoice.</Note>
                    ))}
            </Block>

            <Block title="KRA response">
                <Line label="Status" value={<StatusBadge status={invoice.fiscalization_status} />} />
                <Line label="CU number" value={invoice.kra_invoice_number || invoice.kra_receipt_number || "—"} mono />
                <Line label="Fiscalized" value={invoice.fiscalized_at ? dateTime(invoice.fiscalized_at) : "Not yet"} />
                <Button asChild variant="outline" size="sm" className="mt-1 justify-self-start">
                    <Link href={`/invoices/${invoice.id}`}>
                        <EyeIcon /> View invoice
                    </Link>
                </Button>
            </Block>
        </>
    );
}

/** Items, payments and invoices for one order. */
export function OrderDetails({ sale }: { sale: Sale }) {
    const detail = useApi<SaleDetail>(() => api.sale(sale.id) as unknown as Promise<SaleDetail>, sale.id);

    const items = detail.data?.items ?? [];
    const payments = detail.data?.payments ?? [];
    const invoices = detail.data?.invoices ?? [];
    const wait = detail.loading ? <Note>Loading…</Note> : detail.error ? <Note>Could not load these details.</Note> : null;

    return (
        <>
            <Block title="Order items">
                {wait ??
                    (items.length ? (
                        items.map((line) => (
                            <Line
                                key={line.id}
                                label={`${line.item_name} × ${Number(line.quantity)}`}
                                value={kes(line.line_total)}
                            />
                        ))
                    ) : (
                        <Note>No items on this order.</Note>
                    ))}
            </Block>

            <Block title="Totals">
                <Line label="Tax" value={kes(sale.tax_amount)} />
                <Line label="Total" value={<b>{kes(sale.total_amount)}</b>} />
                <Line label="Raised" value={dateTime(sale.created_at)} />
            </Block>

            <Block title="Payments">
                {wait ??
                    (payments.length ? (
                        payments.map((payment) => (
                            <Line
                                key={payment.id}
                                label={statusLabel(payment.status)}
                                value={kes(payment.amount)}
                            />
                        ))
                    ) : (
                        <Note>No payment received yet.</Note>
                    ))}
            </Block>

            <Block title="Invoice">
                {wait ??
                    (invoices.length ? (
                        invoices.map((invoice) => (
                            <Line
                                key={invoice.id}
                                label={invoice.invoice_number}
                                value={<StatusBadge status={invoice.fiscalization_status} />}
                                mono
                            />
                        ))
                    ) : (
                        <Note>Not invoiced yet. An invoice is created once the order is paid.</Note>
                    ))}
            </Block>
        </>
    );
}

/** What the M-Pesa callback and the match recorded for one payment. */
export function PaymentDetails({ payment }: { payment: Payment }) {
    return (
        <>
            <Block title="M-Pesa transaction">
                <Line label="Transaction ID" value={payment.trans_id || "—"} mono />
                <Line label="Payer" value={payment.payer_name || "—"} />
                <Line label="Paybill" value={payment.business_shortcode || "—"} mono />
            </Block>

            <Block title="Payment">
                <Line label="Amount" value={<b>{kes(payment.amount)}</b>} />
                <Line label="Status" value={<StatusBadge status={payment.status} />} />
                <Line label="Paid" value={dateTime(payment.paid_at ?? payment.created_at)} />
            </Block>

            <Block title="Matched to">
                <Line label="Order reference" value={payment.bill_ref_number || "—"} mono />
                <Line
                    label="Matched by"
                    value={payment.match_method ? statusLabel(payment.match_method) : "Not matched"}
                />
            </Block>
        </>
    );
}
