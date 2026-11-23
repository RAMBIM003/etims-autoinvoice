"use client";

import * as React from "react";
import Link from "next/link";
import {
    ArrowRightIcon,
    ChevronLeftIcon,
    ChevronRightIcon,
    CreditCardIcon,
    FileTextIcon,
    ShoppingCartIcon,
} from "lucide-react";

import { ListCard } from "@/components/list-card";
import { riseStyle } from "@/components/live-rows";
import { invoiceRecord, paymentRecord, saleRecord, type PanelRecord } from "@/components/record-panel";
import { TableSkeleton } from "@/components/skeletons";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { dateTime, kes } from "@/lib/format";
import type { DashboardPayload } from "@/lib/types";
import { cn } from "@/lib/utils";

const TABS = [
    { id: "orders", label: "Orders", icon: ShoppingCartIcon, description: "The last eight orders raised", href: "/merchant/orders" },
    { id: "payments", label: "Payments", icon: CreditCardIcon, description: "The last eight M-Pesa payments", href: "/merchant/payments" },
    { id: "invoices", label: "Invoices", icon: FileTextIcon, description: "The last eight invoices issued", href: "/merchant/invoices" },
] as const;

const SKELETON_COLUMNS = [
    { kind: "mono" },
    { kind: "text", className: "@max-xl:hidden" },
    { kind: "amount" },
    { kind: "badge" },
    { kind: "time", className: "@max-md:hidden" },
] as const;

/** A list row that is clickable, with a highlight while its record is open in the side panel. */
function rowClass(selected: boolean) {
    return cn("row-rise cursor-pointer", selected && "bg-accent/60");
}

/**
 * One card for the latest orders, payments and invoices. The arrows (or the tabs)
 * move between them, so the dashboard shows one list at a time.
 */
export function RecentActivity({
    data,
    selectedId,
    onSelect,
}: {
    data?: DashboardPayload | null;
    selectedId?: string;
    onSelect: (record: PanelRecord) => void;
}) {
    const [index, setIndex] = React.useState(0);
    const tab = TABS[index]!;

    const move = (step: number) => setIndex((cur) => (cur + step + TABS.length) % TABS.length);

    const orders = data?.orders ?? [];
    const payments = data?.payments ?? [];
    const invoices = data?.invoices ?? [];

    return (
        <ListCard
            icon={tab.icon}
            title={tab.label}
            description={tab.description}
            tools={
                <>
                    <div role="tablist" aria-label="Recent activity" className="bg-muted inline-flex rounded-lg p-0.5">
                        {TABS.map((t, i) => (
                            <button
                                key={t.id}
                                type="button"
                                role="tab"
                                aria-selected={i === index}
                                onClick={() => setIndex(i)}
                                className={cn(
                                    "rounded-md px-2.5 py-1 text-xs font-semibold transition-colors",
                                    i === index ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
                                )}
                            >
                                {t.label}
                            </button>
                        ))}
                    </div>
                    <Button variant="outline" size="icon-sm" onClick={() => move(-1)} aria-label="Previous list">
                        <ChevronLeftIcon />
                    </Button>
                    <Button variant="outline" size="icon-sm" onClick={() => move(1)} aria-label="Next list">
                        <ChevronRightIcon />
                    </Button>
                    <Button asChild variant="ghost" size="sm">
                        <Link href={tab.href}>
                            View all <ArrowRightIcon />
                        </Link>
                    </Button>
                </>
            }
        >
            {/* Keyed by the tab, so the list slides in again each time it changes. */}
            <div key={tab.id} className="animate-in fade-in slide-in-from-right-2 duration-300" role="tabpanel">
                {!data ? (
                    <TableSkeleton rows={8} delay={4} columns={[...SKELETON_COLUMNS]} />
                ) : tab.id === "orders" ? (
                    orders.length ? (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Order</TableHead>
                                    <TableHead className="@max-xl:hidden">Customer</TableHead>
                                    <TableHead>Amount</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="@max-md:hidden">Raised</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {orders.map((order, i) => (
                                    <TableRow
                                        key={order.id}
                                        className={rowClass(selectedId === order.id)}
                                        style={riseStyle(i)}
                                        onClick={() => onSelect(saleRecord(order))}
                                    >
                                        <TableCell className="font-mono text-xs">{order.order_reference}</TableCell>
                                        <TableCell className="@max-xl:hidden">{order.customer_name}</TableCell>
                                        <TableCell className="tabular font-bold">{kes(order.total_amount)}</TableCell>
                                        <TableCell>
                                            <StatusBadge status={order.status} />
                                        </TableCell>
                                        <TableCell className="text-muted-foreground @max-md:hidden">
                                            {dateTime(order.created_at)}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    ) : (
                        <EmptyState
                            icon={ShoppingCartIcon}
                            title="No orders yet"
                            description="Raise an order from the Orders page, or let a buyer place one against your catalogue."
                        />
                    )
                ) : tab.id === "payments" ? (
                    payments.length ? (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>M-Pesa ref</TableHead>
                                    <TableHead className="@max-xl:hidden">Order reference</TableHead>
                                    <TableHead>Amount</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="@max-md:hidden">Paid</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {payments.map((payment, i) => (
                                    <TableRow
                                        key={payment.id}
                                        className={rowClass(selectedId === payment.id)}
                                        style={riseStyle(i)}
                                        onClick={() => onSelect(paymentRecord(payment))}
                                    >
                                        <TableCell className="font-mono text-xs">{payment.trans_id || "—"}</TableCell>
                                        <TableCell className="text-muted-foreground font-mono text-xs @max-xl:hidden">
                                            {payment.bill_ref_number || payment.payment_reference || "—"}
                                        </TableCell>
                                        <TableCell className="tabular font-bold">{kes(payment.amount)}</TableCell>
                                        <TableCell>
                                            <StatusBadge status={payment.status} />
                                        </TableCell>
                                        <TableCell className="text-muted-foreground @max-md:hidden">
                                            {dateTime(payment.paid_at ?? payment.created_at)}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    ) : (
                        <EmptyState
                            icon={CreditCardIcon}
                            title="No payments yet"
                            description="Register your M-Pesa callbacks under Connections so paybill payments reach this list."
                        />
                    )
                ) : invoices.length ? (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Invoice</TableHead>
                                <TableHead className="@max-xl:hidden">Buyer</TableHead>
                                <TableHead>Total</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="@max-md:hidden">Issued</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {invoices.map((invoice, i) => (
                                <TableRow
                                    key={invoice.id}
                                    className={rowClass(selectedId === invoice.id)}
                                    style={riseStyle(i)}
                                    onClick={() => onSelect(invoiceRecord(invoice))}
                                >
                                    <TableCell className="font-mono text-xs">{invoice.invoice_number}</TableCell>
                                    <TableCell className="@max-xl:hidden">{invoice.buyer_name || "Walk-in buyer"}</TableCell>
                                    <TableCell className="tabular font-bold">{kes(invoice.total_amount)}</TableCell>
                                    <TableCell>
                                        <StatusBadge status={invoice.fiscalization_status} />
                                    </TableCell>
                                    <TableCell className="text-muted-foreground @max-md:hidden">
                                        {dateTime(invoice.created_at)}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                ) : (
                    <EmptyState
                        icon={FileTextIcon}
                        title="No invoices yet"
                        description="An invoice is created automatically when a payment is matched to an order and the control unit signs it."
                    />
                )}
            </div>
        </ListCard>
    );
}
