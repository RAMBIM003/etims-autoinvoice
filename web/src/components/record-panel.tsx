"use client";

import * as React from "react";
import Link from "next/link";
import { XIcon } from "lucide-react";

import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { dateTime, kes, statusLabel } from "@/lib/format";
import type { Invoice, Payment, Sale } from "@/lib/types";

export type RecordField = { label: string; value: React.ReactNode };

export type PanelRecord = {
    id: string;
    title: string;
    description: string;
    fields: RecordField[];
    href?: string;
};

/*
 * A side panel that shows one record beside the table. The table stays usable:
 * clicking another row switches the panel to that record. It closes with the X
 * button or the Escape key.
 */
export function RecordPanel({
    title,
    description,
    fields,
    href,
    onClose,
}: {
    title: string;
    description: string;
    fields: RecordField[];
    href?: string;
    onClose: () => void;
}) {
    React.useEffect(() => {
        function onKey(event: KeyboardEvent) {
            if (event.key === "Escape") onClose();
        }

        window.addEventListener("keydown", onKey);

        return () => window.removeEventListener("keydown", onKey);
    }, [onClose]);

    return (
        <aside
            aria-label={`${description} details`}
            className="bg-card fixed inset-y-0 right-0 z-40 flex w-full flex-col border-l shadow-2xl sm:w-96"
        >
            <header className="flex items-start gap-3 border-b p-4">
                <div className="min-w-0 flex-1">
                    <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">{description}</p>
                    <h2 className="font-display truncate text-base font-bold">{title}</h2>
                </div>
                <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close details">
                    <XIcon />
                </Button>
            </header>

            <dl className="grid gap-4 overflow-y-auto p-4">
                {fields.map((field) => (
                    <div key={field.label} className="grid gap-0.5">
                        <dt className="text-muted-foreground text-xs font-semibold">{field.label}</dt>
                        <dd className="text-sm break-words">{field.value}</dd>
                    </div>
                ))}
            </dl>

            {href ? (
                <div className="mt-auto border-t p-4">
                    <Button asChild variant="outline" className="w-full">
                        <Link href={href}>Open full page</Link>
                    </Button>
                </div>
            ) : null}
        </aside>
    );
}

export function saleRecord(sale: Sale): PanelRecord {
    return {
        id: sale.id,
        title: sale.order_reference,
        description: "Order",
        fields: [
            { label: "Customer", value: sale.customer_name || "Walk-in customer" },
            { label: "Amount", value: kes(sale.total_amount) },
            { label: "Status", value: <StatusBadge status={sale.status} /> },
            { label: "Raised", value: dateTime(sale.created_at) },
        ],
    };
}

export function paymentRecord(payment: Payment): PanelRecord {
    return {
        id: payment.id,
        title: payment.trans_id || "M-Pesa payment",
        description: "Payment",
        fields: [
            { label: "Payer", value: payment.payer_name || "—" },
            { label: "Order reference", value: payment.bill_ref_number || "—" },
            { label: "Amount", value: kes(payment.amount) },
            { label: "Status", value: <StatusBadge status={payment.status} /> },
            { label: "Matched by", value: payment.match_method ? statusLabel(payment.match_method) : "Not matched" },
            { label: "Paid", value: dateTime(payment.paid_at ?? payment.created_at) },
        ],
    };
}

export function invoiceRecord(invoice: Invoice): PanelRecord {
    return {
        id: invoice.id,
        title: invoice.invoice_number,
        description: "Invoice",
        href: `/invoices/${invoice.id}`,
        fields: [
            { label: "Buyer", value: invoice.buyer_name || "Walk-in buyer" },
            { label: "Buyer PIN", value: invoice.buyer_pin || "—" },
            { label: "Tax", value: kes(invoice.tax_amount) },
            { label: "Total", value: kes(invoice.total_amount) },
            { label: "Status", value: <StatusBadge status={invoice.fiscalization_status} /> },
            { label: "KRA invoice no.", value: invoice.kra_invoice_number || "—" },
            { label: "KRA receipt no.", value: invoice.kra_receipt_number || "—" },
            { label: "CU number", value: invoice.cu_serial_number || "—" },
        ],
    };
}
