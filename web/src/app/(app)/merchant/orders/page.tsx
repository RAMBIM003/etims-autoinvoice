"use client";

import * as React from "react";
import { PlusIcon, SearchIcon, ShoppingCartIcon } from "lucide-react";
import { toast } from "sonner";

import { ListCard } from "@/components/list-card";
import { PageHero } from "@/components/page-hero";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState, ErrorState, LoadingRows } from "@/components/states";
import { Button } from "@/components/ui/button";
import {
    Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useApi } from "@/hooks/use-api";
import { ApiError, api } from "@/lib/api";
import { dateTime, kes } from "@/lib/format";
import type { Item, Sale } from "@/lib/types";

const STATUSES = ["All statuses", "DRAFT", "AWAITING_PAYMENT", "PAID", "COMPLETED", "CANCELLED"];

export default function OrdersPage() {
    const [query, setQuery] = React.useState("");
    const [status, setStatus] = React.useState(STATUSES[0]);

    const orders = useApi<{ sales: Sale[] }>(() => api.sales() as unknown as Promise<{ sales: Sale[] }>);
    const items = useApi<{ items: Item[] }>(() => api.items() as unknown as Promise<{ items: Item[] }>);

    const all = orders.data?.sales ?? [];

    const visible = all.filter((sale) => {
        const matchesStatus = status === STATUSES[0] || sale.status === status;
        const haystack = `${sale.order_reference} ${sale.customer_name ?? ""}`.toLowerCase();

        return matchesStatus && haystack.includes(query.toLowerCase().trim());
    });

    return (
        <>
            <PageHero
                crumb="Merchant / Orders"
                title="Your"
                accent="orders"
                description="Every sale raised against your catalogue, and where its payment stands."
                icon={ShoppingCartIcon}
                action={<NewOrderDialog items={items.data?.items ?? []} onCreated={orders.reload} />}
            />

            {orders.error ? <ErrorState message={orders.error} onRetry={orders.reload} /> : null}

            <ListCard
                icon={ShoppingCartIcon}
                title="Orders"
                count={visible.length}
                description="Newest first"
                tools={
                    <>
                        <div className="relative">
                            <SearchIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                            <Input
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="Search reference or customer"
                                aria-label="Search orders"
                                className="h-9 pl-9 sm:w-56"
                            />
                        </div>
                        <Select value={status} onValueChange={setStatus}>
                            <SelectTrigger size="sm" className="sm:w-44" aria-label="Filter by status">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {STATUSES.map((s) => (
                                    <SelectItem key={s} value={s}>
                                        {s === STATUSES[0] ? s : s.replace(/_/g, " ").toLowerCase()}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </>
                }
                footer={<span>Showing {visible.length} of {all.length} orders</span>}
            >
                {orders.loading ? (
                    <LoadingRows />
                ) : visible.length ? (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Order</TableHead>
                                <TableHead className="hidden sm:table-cell">Customer</TableHead>
                                <TableHead>Amount</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="hidden md:table-cell">Raised</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {visible.map((sale) => (
                                <TableRow key={sale.id}>
                                    <TableCell className="font-mono text-xs">{sale.order_reference}</TableCell>
                                    <TableCell className="hidden sm:table-cell">{sale.customer_name}</TableCell>
                                    <TableCell className="tabular font-bold">{kes(sale.total_amount)}</TableCell>
                                    <TableCell><StatusBadge status={sale.status} /></TableCell>
                                    <TableCell className="text-muted-foreground hidden md:table-cell">
                                        {dateTime(sale.created_at)}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                ) : all.length ? (
                    <EmptyState
                        icon={SearchIcon}
                        title="Nothing matches that filter"
                        description="Clear the search box or choose a different status to see your orders again."
                    />
                ) : (
                    <EmptyState
                        icon={ShoppingCartIcon}
                        title="No orders yet"
                        description="Raise your first order against an item in your catalogue. Once the buyer pays, it fiscalizes itself."
                    />
                )}
            </ListCard>
        </>
    );
}

function NewOrderDialog({ items, onCreated }: { items: Item[]; onCreated: () => void }) {
    const [open, setOpen] = React.useState(false);
    const [itemId, setItemId] = React.useState("");
    const [quantity, setQuantity] = React.useState("1");
    const [saving, setSaving] = React.useState(false);

    const active = items.filter((item) => item.status === "ACTIVE");

    async function submit(event: React.FormEvent) {
        event.preventDefault();

        if (!itemId) {
            toast.error("Choose an item to put on the order.");
            return;
        }

        setSaving(true);

        try {
            await api.createSale({ items: [{ item_id: itemId, quantity: Number(quantity) }] });
            toast.success("Order raised. It is now awaiting payment.");
            setOpen(false);
            setItemId("");
            setQuantity("1");
            onCreated();
        } catch (error) {
            toast.error(error instanceof ApiError ? error.message : "The order could not be raised.");
        } finally {
            setSaving(false);
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button><PlusIcon /> New order</Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <ShoppingCartIcon className="size-4" />
                    <DialogTitle>Raise an order</DialogTitle>
                </DialogHeader>
                <form onSubmit={submit}>
                    <DialogBody>
                        <div className="grid gap-1.5">
                            <Label htmlFor="order-item">Item</Label>
                            <Select value={itemId} onValueChange={setItemId}>
                                <SelectTrigger id="order-item">
                                    <SelectValue placeholder={active.length ? "Choose an item" : "No active items"} />
                                </SelectTrigger>
                                <SelectContent>
                                    {active.map((item) => (
                                        <SelectItem key={item.id} value={item.id}>
                                            {item.name} · {kes(item.unit_price)}
                                            {item.tax_type_code ? ` · tax ${item.tax_type_code}` : ""}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid gap-1.5">
                            <Label htmlFor="order-qty">Quantity</Label>
                            <Input
                                id="order-qty"
                                type="number"
                                min="1"
                                step="1"
                                value={quantity}
                                onChange={(e) => setQuantity(e.target.value)}
                                required
                            />
                        </div>
                        <p className="text-muted-foreground text-xs leading-relaxed">
                            The order reference is generated for you. The buyer pays it on your paybill, and the
                            payment matches itself.
                        </p>
                    </DialogBody>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                        <Button type="submit" disabled={saving}>{saving ? "Raising…" : "Raise order"}</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
