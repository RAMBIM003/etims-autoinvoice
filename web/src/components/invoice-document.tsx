"use client";

import { ReceiptQr } from "@/components/receipt-qr";
import { dateTime, statusLabel } from "@/lib/format";
import type { InvoiceDetail } from "@/lib/types";
import { cn } from "@/lib/utils";

/* KRA tax types, as they read on a printed invoice. */
const TAX_TYPES: Record<string, string> = {
    A: "A · Exempt",
    B: "B · VAT 16%",
    C: "C · Zero-rated",
    D: "D · Non-VAT",
    E: "E · VAT 8%",
};

/** Invoices always show cents: 806.20, not 806.2. */
function amount(value: unknown) {
    const n = Number(value ?? 0);

    return (Number.isFinite(n) ? n : 0).toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function quantity(value: unknown) {
    return Number(value ?? 0).toLocaleString("en-KE", { maximumFractionDigits: 3 });
}

/* "20261029114951" from the control unit, as a readable time. */
function sdcTime(value?: string | null) {
    const m = value?.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/);

    return m ? `${m[3]}/${m[2]}/${m[1]} ${m[4]}:${m[5]}:${m[6]}` : value || "—";
}

const STAMP: Record<string, { label: string; className: string }> = {
    FISCALIZED: { label: "Fiscalized", className: "border-emerald-600 text-emerald-700 bg-emerald-50" },
    PENDING: { label: "Awaiting KRA", className: "border-amber-500 text-amber-700 bg-amber-50" },
    PROCESSING: { label: "Awaiting KRA", className: "border-amber-500 text-amber-700 bg-amber-50" },
    FAILED: { label: "Not fiscalized", className: "border-red-600 text-red-700 bg-red-50" },
    CANCELLED: { label: "Cancelled", className: "border-neutral-500 text-neutral-600 bg-neutral-100" },
};

function Label({ children }: { children: React.ReactNode }) {
    return <p className="mb-1.5 text-[9.5px] font-bold tracking-[0.14em] text-neutral-500 uppercase">{children}</p>;
}

function Row({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
    return (
        <div className="flex justify-between gap-4 py-[3px]">
            <span className="shrink-0 text-neutral-500">{label}</span>
            <span className={cn("min-w-0 text-right font-medium break-all text-neutral-900", mono && "font-mono text-[11px]")}>
                {value}
            </span>
        </div>
    );
}

/**
 * The tax invoice as a sheet of A4 paper. It is always dark ink on white,
 * whatever the app theme, because that is what it prints as.
 */
export function InvoiceDocument({ data, onQrRendered }: { data: InvoiceDetail; onQrRendered?: () => void }) {
    const { invoice, items, sale, merchant, branch, payment, receipt_token } = data;
    const fiscalized = invoice.fiscalization_status === "FISCALIZED";
    const stamp = STAMP[invoice.fiscalization_status] ?? {
        label: statusLabel(invoice.fiscalization_status),
        className: "border-neutral-500 text-neutral-600 bg-neutral-100",
    };
    const currency = invoice.currency || "KES";
    const seller = merchant?.trading_name || invoice.seller_name || "—";

    /* VAT summary per tax type, the way KRA prints it. */
    const byTax = Object.entries(
        items.reduce<Record<string, { taxable: number; tax: number }>>((acc, line) => {
            const code = line.tax_type_code || "—";
            const entry = (acc[code] ??= { taxable: 0, tax: 0 });

            entry.taxable += Number(line.line_subtotal || 0);
            entry.tax += Number(line.tax_amount || 0);

            return acc;
        }, {})
    ).sort(([a], [b]) => a.localeCompare(b));

    return (
        <article
            className="relative mx-auto w-full max-w-[210mm] overflow-hidden bg-white text-[12px] leading-relaxed text-neutral-800 shadow-[0_1px_3px_rgba(15,23,42,.08),0_20px_48px_-16px_rgba(15,23,42,.25)] ring-1 ring-black/5 sm:rounded-sm print:max-w-none print:shadow-none print:ring-0 [-webkit-print-color-adjust:exact] [print-color-adjust:exact]"
            aria-label={`Tax invoice ${invoice.invoice_number}`}
        >
            {/* Brand stripe */}
            <div className="flex h-1.5">
                <div className="flex-1 bg-[var(--red-500)]" />
                <div className="w-24 bg-neutral-900" />
            </div>

            {!fiscalized ? (
                <div
                    aria-hidden
                    className="pointer-events-none absolute inset-0 grid place-items-center overflow-hidden select-none"
                >
                    <span className="-rotate-[28deg] text-[88px] font-black tracking-[0.12em] whitespace-nowrap text-neutral-900/[0.045] uppercase sm:text-[120px]">
                        {invoice.fiscalization_status === "FAILED" ? "Not valid" : "Draft"}
                    </span>
                </div>
            ) : null}

            <div className="relative px-6 pt-7 pb-8 sm:px-12 sm:pt-10 sm:pb-10">
                {/* Header: brand and title */}
                <header className="flex flex-wrap items-start justify-between gap-6">
                    <div>
                        <div className="flex items-center gap-2.5">
                            <span className="font-display grid size-10 place-items-center rounded-xl bg-[var(--red-500)] text-xl font-extrabold text-white">
                                e
                            </span>
                            <div className="leading-tight">
                                <p className="font-display text-[15px] font-extrabold tracking-tight text-neutral-900">
                                    eTIMS AutoInvoice
                                </p>
                                <p className="text-[10.5px] text-neutral-500">M-Pesa to KRA eTIMS, automatically</p>
                            </div>
                        </div>
                    </div>

                    <div className="sm:text-right print:text-right">
                        <h1 className="font-display text-[26px] leading-none font-extrabold tracking-tight text-neutral-900 sm:text-[30px]">
                            Tax <span className="text-[var(--red-500)]">Invoice</span>
                        </h1>
                        <p className="mt-2 font-mono text-[13px] font-semibold text-neutral-900">{invoice.invoice_number}</p>
                        <span
                            className={cn(
                                "mt-2 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-bold tracking-wider uppercase",
                                stamp.className
                            )}
                        >
                            <span className="size-1.5 rounded-full bg-current" />
                            {stamp.label}
                        </span>
                    </div>
                </header>

                {/* Parties and invoice facts */}
                <section className="mt-9 grid gap-6 border-y border-neutral-200 py-6 sm:grid-cols-3 sm:gap-8">
                    <div>
                        <Label>From</Label>
                        <p className="font-display text-[14px] font-bold text-neutral-900">{seller}</p>
                        {merchant?.taxpayer_name && merchant.taxpayer_name !== seller ? (
                            <p className="text-neutral-600">{merchant.taxpayer_name}</p>
                        ) : null}
                        <p className="mt-1 text-neutral-600">
                            KRA PIN <span className="font-mono font-semibold text-neutral-900">{invoice.seller_pin || merchant?.kra_pin}</span>
                        </p>
                        {branch ? (
                            <p className="text-neutral-600">
                                {branch.branch_name} · Branch {branch.kra_bhf_id}
                            </p>
                        ) : null}
                        {merchant?.business_phone ? <p className="text-neutral-600">+{merchant.business_phone.replace(/^\+/, "")}</p> : null}
                    </div>

                    <div>
                        <Label>Bill to</Label>
                        <p className="font-display text-[14px] font-bold text-neutral-900">{invoice.buyer_name || "Walk-in customer"}</p>
                        <p className="mt-1 text-neutral-600">
                            {invoice.buyer_pin ? (
                                <>
                                    KRA PIN <span className="font-mono font-semibold text-neutral-900">{invoice.buyer_pin}</span>
                                </>
                            ) : (
                                "No buyer PIN on this invoice"
                            )}
                        </p>
                    </div>

                    <div className="text-[11.5px]">
                        <Label>Details</Label>
                        <Row label="Issued" value={dateTime(invoice.created_at)} />
                        {sale?.order_reference ? <Row label="Order" value={sale.order_reference} mono /> : null}
                        <Row label="Currency" value={currency} />
                        <Row label="Fiscalized" value={invoice.fiscalized_at ? dateTime(invoice.fiscalized_at) : "Not yet"} />
                    </div>
                </section>

                {/* Line items */}
                <section className="mt-7">
                    <table className="w-full border-collapse text-[11.5px]">
                        <thead>
                            <tr className="border-b-2 border-neutral-900 text-left text-[9.5px] font-bold tracking-[0.12em] text-neutral-500 uppercase">
                                <th className="w-7 pb-2 font-bold">#</th>
                                <th className="pb-2 font-bold">Description</th>
                                <th className="pb-2 text-right font-bold">Qty</th>
                                <th className="hidden pb-2 text-right font-bold sm:table-cell print:table-cell">Unit price</th>
                                <th className="hidden pb-2 pl-3 text-center font-bold sm:table-cell print:table-cell">Tax</th>
                                <th className="pb-2 text-right font-bold">Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.map((line, i) => (
                                <tr key={line.id} className="border-b border-neutral-200 align-top break-inside-avoid">
                                    <td className="py-2.5 text-neutral-400 tabular-nums">{i + 1}</td>
                                    <td className="py-2.5 pr-3">
                                        <p className="font-semibold text-neutral-900">{line.item_name}</p>
                                        <p className="text-[10.5px] text-neutral-500">
                                            {line.sku ? <span className="font-mono">{line.sku}</span> : null}
                                            <span className="sm:hidden print:hidden">
                                                {line.sku ? " · " : ""}
                                                {amount(line.unit_price)} each · Tax {line.tax_type_code || "—"}
                                            </span>
                                        </p>
                                    </td>
                                    <td className="py-2.5 text-right tabular-nums whitespace-nowrap">
                                        {quantity(line.quantity)} <span className="text-[10px] text-neutral-500">{line.unit_code || "PCS"}</span>
                                    </td>
                                    <td className="hidden py-2.5 text-right tabular-nums sm:table-cell print:table-cell">{amount(line.unit_price)}</td>
                                    <td className="hidden py-2.5 pl-3 text-center sm:table-cell print:table-cell">
                                        <span className="rounded bg-neutral-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-neutral-700">
                                            {line.tax_type_code || "—"}
                                            {line.tax_rate != null && Number(line.tax_rate) > 0 ? ` ${Number(line.tax_rate)}%` : ""}
                                        </span>
                                    </td>
                                    <td className="py-2.5 text-right font-semibold text-neutral-900 tabular-nums">{amount(line.line_total)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </section>

                {/* Tax summary and totals */}
                <section className="mt-6 grid gap-6 sm:grid-cols-[1fr_minmax(0,17rem)] sm:gap-10 print:grid-cols-[1fr_17rem]">
                    <div>
                        <Label>Tax summary</Label>
                        <table className="w-full max-w-sm text-[11px]">
                            <thead>
                                <tr className="border-b border-neutral-200 text-left text-neutral-500">
                                    <th className="pb-1 font-medium">Tax type</th>
                                    <th className="pb-1 text-right font-medium">Taxable</th>
                                    <th className="pb-1 text-right font-medium">Tax</th>
                                </tr>
                            </thead>
                            <tbody>
                                {byTax.map(([code, t]) => (
                                    <tr key={code}>
                                        <td className="py-1 text-neutral-700">{TAX_TYPES[code] ?? code}</td>
                                        <td className="py-1 text-right tabular-nums">{amount(t.taxable)}</td>
                                        <td className="py-1 text-right tabular-nums">{amount(t.tax)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="text-[12px]">
                        <Row label="Subtotal" value={<span className="tabular-nums">{amount(invoice.subtotal)}</span>} />
                        <Row label="VAT" value={<span className="tabular-nums">{amount(invoice.tax_amount)}</span>} />
                        <div className="mt-2 flex items-baseline justify-between gap-4 rounded-lg bg-neutral-900 px-4 py-3 text-white">
                            <span className="text-[10px] font-bold tracking-[0.14em] uppercase">Total {currency}</span>
                            <span className="font-display text-[20px] font-extrabold tabular-nums">{amount(invoice.total_amount)}</span>
                        </div>
                        {payment ? (
                            <p className="mt-2.5 text-right text-[11px] text-emerald-700">
                                <span className="mr-1.5 inline-block size-1.5 rounded-full bg-current align-middle" />
                                Paid by M-Pesa
                                {payment.trans_id ? <span className="font-mono font-semibold"> {payment.trans_id}</span> : null}
                                {payment.paid_at ? (
                                    <span className="block text-neutral-500">{dateTime(payment.paid_at)}</span>
                                ) : null}
                            </p>
                        ) : null}
                    </div>
                </section>

                {/* Control unit signature */}
                <section className="mt-9 break-inside-avoid rounded-xl border border-neutral-200 bg-neutral-50/70 p-5">
                    {fiscalized ? (
                        <div className="flex flex-col gap-5 sm:flex-row sm:items-center print:flex-row print:items-center">
                            <div className="min-w-0 flex-1 text-[11px]">
                                <p className="mb-2 flex items-center gap-2 text-[9.5px] font-bold tracking-[0.14em] text-neutral-500 uppercase">
                                    KRA eTIMS · Control unit information
                                </p>
                                <div className="grid gap-x-8 sm:grid-cols-2 print:grid-cols-2">
                                    <Row label="CU serial no." value={invoice.cu_serial_number || "—"} mono />
                                    <Row label="CU invoice no." value={invoice.kra_invoice_number || "—"} mono />
                                    <Row label="Receipt no." value={invoice.kra_receipt_number || "—"} mono />
                                    <Row label="CU date & time" value={sdcTime(invoice.sdc_date_time)} mono />
                                    {invoice.kra_internal_data ? <Row label="Internal data" value={invoice.kra_internal_data} mono /> : null}
                                    {invoice.receipt_signature ? <Row label="Signature" value={invoice.receipt_signature} mono /> : null}
                                </div>
                            </div>
                            {receipt_token ? (
                                <div className="shrink-0 self-center [&_span]:text-neutral-500">
                                    <ReceiptQr
                                        text={`${typeof window === "undefined" ? "" : window.location.origin}/receipt/${receipt_token}`}
                                        caption="Scan for the digital receipt"
                                        size={104}
                                        onRendered={onQrRendered}
                                    />
                                </div>
                            ) : null}
                        </div>
                    ) : (
                        <div className="text-[11.5px]">
                            <p className="font-bold text-neutral-900">
                                {invoice.fiscalization_status === "FAILED"
                                    ? "KRA did not sign this invoice."
                                    : "This invoice is waiting for KRA to sign it."}
                            </p>
                            <p className="mt-1 text-neutral-600">
                                It is not a valid tax invoice until the control unit returns a CU invoice number and signature.
                            </p>
                        </div>
                    )}
                </section>

                {/* Footer */}
                <footer className="mt-9 flex flex-wrap items-end justify-between gap-3 border-t border-neutral-200 pt-4 text-[10px] text-neutral-500">
                    <p>
                        Thank you for your business.
                        <br />
                        Issued electronically through KRA eTIMS (OSCU) by eTIMS AutoInvoice.
                    </p>
                    <p className="flex items-center gap-1.5">
                        <span className="font-display grid size-4 place-items-center rounded bg-[var(--red-500)] text-[9px] font-extrabold text-white">
                            e
                        </span>
                        <span className="font-display font-bold text-neutral-700">eTIMS AutoInvoice</span>
                    </p>
                </footer>
            </div>
        </article>
    );
}
