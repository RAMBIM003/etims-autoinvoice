"use client";

import * as React from "react";
import { use } from "react";
import Link from "next/link";
import { ArrowLeftIcon, PrinterIcon } from "lucide-react";

import { InvoiceDocument } from "@/components/invoice-document";
import { ErrorState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useApi } from "@/hooks/use-api";
import { api } from "@/lib/api";
import type { InvoiceDetail } from "@/lib/types";

/**
 * One invoice as a printable document. It sits outside the merchant layout so
 * neither the screen nor the printout carries the sidebar or header.
 * `?print=1` opens the print dialog as soon as the invoice (and its QR) is drawn.
 */
export default function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const detail = useApi<InvoiceDetail>(() => api.invoice(id) as Promise<InvoiceDetail>, id);
    const [qrDrawn, setQrDrawn] = React.useState(false);
    const printedRef = React.useRef(false);

    const data = detail.data;

    React.useEffect(() => {
        if (data) document.title = `${data.invoice.invoice_number} · eTIMS AutoInvoice`;
    }, [data]);

    /* Wait for the QR when there will be one, so it is on the paper. */
    const readyToPrint = Boolean(data && (!data.receipt_token || qrDrawn));

    React.useEffect(() => {
        if (!readyToPrint || printedRef.current) return;
        if (new URLSearchParams(window.location.search).get("print") !== "1") return;

        printedRef.current = true;
        window.print();
    }, [readyToPrint]);

    return (
        <div className="bg-muted min-h-svh print:bg-white">
            {/* Only this page prints as an A4 sheet; nothing else in the app is affected. */}
            <style>{"@page { size: A4; margin: 10mm; }"}</style>
            <div className="bg-card/85 sticky top-0 z-10 border-b backdrop-blur print:hidden">
                <div className="mx-auto flex max-w-[210mm] items-center gap-2 px-4 py-2.5 sm:px-0">
                    <Button asChild variant="ghost" size="sm">
                        <Link href="/merchant/invoices">
                            <ArrowLeftIcon /> Invoices
                        </Link>
                    </Button>
                    {data ? (
                        <span className="text-muted-foreground hidden truncate font-mono text-xs sm:inline">
                            {data.invoice.invoice_number}
                        </span>
                    ) : null}
                    <Button size="sm" className="ml-auto" onClick={() => window.print()} disabled={!data}>
                        <PrinterIcon /> Print or save as PDF
                    </Button>
                </div>
            </div>

            <main className="px-0 py-0 sm:px-6 sm:py-10 print:p-0">
                {detail.error ? (
                    <div className="mx-auto max-w-xl p-4">
                        <ErrorState message={detail.error} onRetry={detail.reload} />
                    </div>
                ) : data ? (
                    <div className="animate-in fade-in duration-500">
                        <InvoiceDocument data={data} onQrRendered={() => setQrDrawn(true)} />
                    </div>
                ) : (
                    <div
                        className="mx-auto w-full max-w-[210mm] bg-white p-6 shadow-sm sm:p-12"
                        role="status"
                        aria-label="Loading invoice"
                    >
                        <div className="flex justify-between">
                            <Skeleton className="h-10 w-44" />
                            <div className="grid justify-items-end gap-2">
                                <Skeleton className="h-8 w-40" />
                                <Skeleton className="h-4 w-28" />
                            </div>
                        </div>
                        <div className="mt-10 grid gap-6 sm:grid-cols-3">
                            {[0, 1, 2].map((i) => (
                                <div key={i} className="grid gap-2">
                                    <Skeleton className="h-2.5 w-14 rounded-full" />
                                    <Skeleton className="h-4 w-36" />
                                    <Skeleton className="h-3 w-28 rounded-full" />
                                </div>
                            ))}
                        </div>
                        <div className="mt-10 grid gap-3">
                            {[0, 1, 2, 3].map((i) => (
                                <Skeleton key={i} className="h-8 w-full" />
                            ))}
                        </div>
                        <Skeleton className="mt-8 ml-auto h-12 w-64" />
                    </div>
                )}
            </main>
        </div>
    );
}
