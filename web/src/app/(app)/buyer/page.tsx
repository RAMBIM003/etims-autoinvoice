"use client";

import * as React from "react";
import { ExternalLinkIcon, MessageSquareIcon, ShoppingCartIcon } from "lucide-react";
import { toast } from "sonner";

import { PageHero } from "@/components/page-hero";
import { PurchaseStage } from "@/components/purchase-stage";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState, ErrorState, LoadingRows } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useApi } from "@/hooks/use-api";
import { ApiError, api } from "@/lib/api";
import { dateTime, kes } from "@/lib/format";
import type { BuyerPurchase } from "@/lib/types";

export default function BuyerPurchasesPage() {
    const purchases = useApi<{ orders: BuyerPurchase[] }>(
        () => api.buyerOrders() as unknown as Promise<{ orders: BuyerPurchase[] }>
    );

    const orders = purchases.data?.orders ?? [];

    async function resend(invoiceId: string) {
        try {
            await api.sendReceiptSms(invoiceId);
            toast.success("Receipt link sent to your phone.");
        } catch (error) {
            toast.error(error instanceof ApiError ? error.message : "The receipt could not be sent.");
        }
    }

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

            {purchases.loading ? (
                <LoadingRows rows={4} />
            ) : orders.length ? (
                <div className="grid gap-3">
                    {orders.map((purchase) => (
                        <Card key={purchase.order.id} className="p-4 sm:p-5">
                            <div className="mb-3 flex flex-wrap items-start gap-3">
                                <div className="min-w-0 flex-1">
                                    <p className="font-display text-base font-bold">
                                        {purchase.order.merchant_name || "Merchant"}
                                    </p>
                                    <p className="text-muted-foreground font-mono text-xs">
                                        {purchase.order.order_reference} · {dateTime(purchase.order.created_at)}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="tabular font-display text-lg font-extrabold">
                                        {kes(purchase.order.total_amount)}
                                    </p>
                                    <StatusBadge status={purchase.order.status} />
                                </div>
                            </div>

                            <PurchaseStage stage={purchase.stage} />

                            {purchase.invoice ? (
                                <div className="mt-3 flex flex-wrap items-center gap-2">
                                    <span className="text-muted-foreground font-mono text-xs">
                                        {purchase.invoice.kra_receipt_number || purchase.invoice.number}
                                    </span>
                                    <div className="ml-auto flex gap-2">
                                        {purchase.receipt_url ? (
                                            <Button asChild size="sm" variant="outline">
                                                <a href={purchase.receipt_url} target="_blank" rel="noreferrer">
                                                    <ExternalLinkIcon /> View receipt
                                                </a>
                                            </Button>
                                        ) : null}
                                        {purchase.invoice.status === "FISCALIZED" ? (
                                            <Button size="sm" variant="soft" onClick={() => resend(purchase.invoice!.id)}>
                                                <MessageSquareIcon /> Resend SMS
                                            </Button>
                                        ) : null}
                                    </div>
                                </div>
                            ) : null}
                        </Card>
                    ))}
                </div>
            ) : (
                <EmptyState
                    icon={ShoppingCartIcon}
                    title="No purchases yet"
                    description="When you pay a merchant who uses eTIMS AutoInvoice, the order and its fiscal receipt appear here."
                />
            )}
        </>
    );
}
