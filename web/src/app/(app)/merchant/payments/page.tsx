"use client";

import * as React from "react";
import { CreditCardIcon, SearchIcon } from "lucide-react";

import { ListCard } from "@/components/list-card";
import { PageHero } from "@/components/page-hero";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState, ErrorState, LoadingRows } from "@/components/states";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useApi } from "@/hooks/use-api";
import { api } from "@/lib/api";
import { dateTime, kes, statusLabel } from "@/lib/format";
import type { Payment } from "@/lib/types";

const STATUSES = ["All statuses", "MATCHED", "UNMATCHED", "AMOUNT_MISMATCH"];

export default function PaymentsPage() {
    const [query, setQuery] = React.useState("");
    const [status, setStatus] = React.useState(STATUSES[0]);

    const payments = useApi<{ payments: Payment[] }>(
        () => api.payments() as unknown as Promise<{ payments: Payment[] }>
    );

    const all = payments.data?.payments ?? [];

    const visible = all.filter((payment) => {
        const matchesStatus = status === STATUSES[0] || payment.status === status;
        const haystack = `${payment.trans_id ?? ""} ${payment.payment_reference ?? ""} ${payment.payer_name ?? ""}`.toLowerCase();

        return matchesStatus && haystack.includes(query.toLowerCase().trim());
    });

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
                    </>
                }
                footer={<span>Showing {visible.length} of {all.length} payments</span>}
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
                            {visible.map((payment) => (
                                <TableRow key={payment.id}>
                                    <TableCell className="font-mono text-xs">{payment.trans_id || "—"}</TableCell>
                                    <TableCell className="hidden sm:table-cell">{payment.payer_name || "—"}</TableCell>
                                    <TableCell className="text-muted-foreground hidden font-mono text-xs lg:table-cell">
                                        {payment.payment_reference || "—"}
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
