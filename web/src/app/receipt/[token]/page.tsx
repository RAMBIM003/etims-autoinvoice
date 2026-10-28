"use client";

import * as React from "react";
import { use } from "react";
import { CheckCircle2Icon, ReceiptIcon } from "lucide-react";

import { ReceiptQr } from "@/components/receipt-qr";
import { ErrorState, LoadingRows } from "@/components/states";
import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useApi } from "@/hooks/use-api";
import { api } from "@/lib/api";
import { dateTime, kes } from "@/lib/format";

type PublicReceipt = {
    merchant: { name: string; pin: string | null };
    buyer: { name: string | null; pin: string | null };
    invoice: {
        number: string;
        order_reference: string | null;
        currency: string;
        subtotal: string | number;
        tax_amount: string | number;
        total_amount: string | number;
        kra_receipt_number: string | null;
        kra_invoice_number: string | null;
        cu_serial_number: string | null;
        receipt_signature: string | null;
        kra_internal_data: string | null;
        sdc_date_time: string | null;
        fiscalized_at: string | null;
    };
    items: {
        item_name: string;
        sku: string | null;
        quantity: string | number;
        unit_code: string | null;
        unit_price: string | number;
        tax_rate: string | number | null;
        line_total: string | number;
    }[];
    payment: { payment_method: string | null; amount: string | number; paid_at: string | null; trans_id: string | null } | null;
};

function Field({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div className="flex items-start justify-between gap-3 text-[13px]">
            <span className="text-muted-foreground shrink-0">{label}</span>
            <span className="min-w-0 text-right font-mono font-semibold break-all">{value}</span>
        </div>
    );
}

export default function ReceiptPage({ params }: { params: Promise<{ token: string }> }) {
    const { token } = use(params);
    const receipt = useApi<PublicReceipt>(
        () => api.publicReceipt(token) as unknown as Promise<PublicReceipt>,
        token
    );

    const data = receipt.data;

    return (
        <div className="min-h-svh px-4 py-6 sm:px-6">
            <div className="mx-auto w-full max-w-xl">
                <div className="mb-4 flex items-center gap-2">
                    <span className="bg-primary text-primary-foreground font-display grid size-8 place-items-center rounded-lg font-extrabold">
                        e
                    </span>
                    <span className="font-display text-sm font-extrabold">eTIMS AutoInvoice</span>
                    <ThemeToggle className="ml-auto size-9" />
                </div>

                {receipt.loading ? <LoadingRows rows={5} /> : null}

                {receipt.error ? (
                    <ErrorState
                        message={`${receipt.error} This link may have expired, or the invoice is not fiscalized yet.`}
                        onRetry={receipt.reload}
                    />
                ) : null}

                {data ? (
                    <Card className="overflow-hidden p-0">
                        <div className="bg-band text-band-foreground flex items-center gap-3 px-5 py-4">
                            <span className="bg-primary grid size-10 shrink-0 place-items-center rounded-xl">
                                <ReceiptIcon className="size-5 text-white" />
                            </span>
                            <div className="min-w-0">
                                <p className="font-display truncate text-base font-extrabold">{data.merchant.name}</p>
                                <p className="text-band-muted font-mono text-xs">PIN {data.merchant.pin || "—"}</p>
                            </div>
                            <Badge variant="ok" dot className="ml-auto shrink-0">
                                Fiscalized
                            </Badge>
                        </div>

                        <div className="grid gap-4 p-5">
                            <div className="grid gap-1.5">
                                <Field label="Invoice" value={data.invoice.number} />
                                {data.invoice.order_reference ? (
                                    <Field label="Order" value={data.invoice.order_reference} />
                                ) : null}
                                <Field label="Fiscalized" value={dateTime(data.invoice.fiscalized_at)} />
                                {data.buyer.name ? <Field label="Buyer" value={data.buyer.name} /> : null}
                                {data.buyer.pin ? <Field label="Buyer PIN" value={data.buyer.pin} /> : null}
                            </div>

                            <Separator />

                            <ul className="grid gap-2.5">
                                {data.items.map((item, index) => (
                                    <li key={`${item.item_name}-${index}`} className="flex items-start gap-3 text-[13px]">
                                        <div className="min-w-0 flex-1">
                                            <p className="font-semibold">{item.item_name}</p>
                                            <p className="text-muted-foreground tabular text-xs">
                                                {item.quantity} {item.unit_code || "PCS"} × {kes(item.unit_price)}
                                                {item.tax_rate ? ` · VAT ${item.tax_rate}%` : ""}
                                            </p>
                                        </div>
                                        <span className="tabular shrink-0 font-bold">{kes(item.line_total)}</span>
                                    </li>
                                ))}
                            </ul>

                            <Separator />

                            <div className="grid gap-1.5">
                                <Field label="Subtotal" value={kes(data.invoice.subtotal)} />
                                <Field label="VAT" value={kes(data.invoice.tax_amount)} />
                                <div className="flex items-center justify-between gap-3 pt-1">
                                    <span className="font-bold">Total</span>
                                    <span className="tabular font-display text-lg font-extrabold">
                                        {kes(data.invoice.total_amount)}
                                    </span>
                                </div>
                            </div>

                            {data.payment ? (
                                <div className="bg-ok-soft text-ok flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-[13px]">
                                    <CheckCircle2Icon className="size-4 shrink-0" />
                                    <span className="min-w-0">
                                        Paid by {data.payment.payment_method || "M-Pesa"}
                                        {data.payment.trans_id ? ` · ${data.payment.trans_id}` : ""}
                                    </span>
                                </div>
                            ) : null}

                            <Separator />

                            {/* The fields KRA requires a fiscal receipt to carry. */}
                            <div className="flex flex-wrap items-start justify-between gap-4">
                                <div className="grid min-w-0 flex-1 gap-1.5">
                                    <Field label="KRA receipt no." value={data.invoice.kra_receipt_number || "—"} />
                                    <Field label="KRA invoice no." value={data.invoice.kra_invoice_number || "—"} />
                                    <Field label="Control unit" value={data.invoice.cu_serial_number || "—"} />
                                    {data.invoice.receipt_signature ? (
                                        <Field label="Signature" value={data.invoice.receipt_signature} />
                                    ) : null}
                                    {data.invoice.sdc_date_time ? (
                                        <Field label="SDC time" value={data.invoice.sdc_date_time} />
                                    ) : null}
                                </div>
                                <ReceiptQr />
                            </div>
                        </div>
                    </Card>
                ) : null}
            </div>
        </div>
    );
}
