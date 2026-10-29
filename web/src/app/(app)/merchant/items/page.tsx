"use client";

import * as React from "react";
import { BoxesIcon, PlusIcon, SearchIcon } from "lucide-react";
import { toast } from "sonner";

import { ListCard } from "@/components/list-card";
import { TablePagination, usePagination } from "@/components/table-pagination";
import { PageHero } from "@/components/page-hero";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState, ErrorState, LoadingRows } from "@/components/states";
import { Badge } from "@/components/ui/badge";
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
import { kes } from "@/lib/format";
import type { Item } from "@/lib/types";

/* KRA tax types, as the control unit expects them. */
const TAX_TYPES = [
    { code: "A", label: "A · Exempt", rate: 0 },
    { code: "B", label: "B · VAT 16%", rate: 16 },
    { code: "C", label: "C · Zero-rated", rate: 0 },
    { code: "D", label: "D · Non-VAT", rate: 0 },
    { code: "E", label: "E · VAT 8%", rate: 8 },
];

export default function ItemsPage() {
    const [query, setQuery] = React.useState("");
    const items = useApi<{ items: Item[] }>(() => api.items() as unknown as Promise<{ items: Item[] }>);

    const all = items.data?.items ?? [];
    const visible = all.filter((item) =>
        `${item.name} ${item.sku ?? ""}`.toLowerCase().includes(query.toLowerCase().trim())
    );
    const paged = usePagination(visible, query);
    const unclassified = all.filter((item) => !item.tax_type_code).length;

    return (
        <>
            <PageHero
                crumb="Merchant / Items"
                title="Your"
                accent="catalogue"
                description="What you sell, and how each line is classified for KRA."
                icon={BoxesIcon}
                action={<NewItemDialog onCreated={items.reload} />}
            />

            {items.error ? <ErrorState message={items.error} onRetry={items.reload} /> : null}

            {unclassified ? (
                <div className="border-warn-border bg-warn-soft text-warn mb-4 flex flex-wrap items-center gap-3 rounded-lg border px-4 py-3 text-sm">
                    <span className="min-w-0 flex-1">
                        <b>{unclassified} {unclassified === 1 ? "item has" : "items have"} no KRA tax type.</b>{" "}
                        Classify them before their next sale, or fiscalization will reject the invoice.
                    </span>
                </div>
            ) : null}

            <ListCard
                icon={BoxesIcon}
                title="Items"
                count={visible.length}
                description="Newest first"
                tools={
                    <div className="relative">
                        <SearchIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                        <Input
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Search name or SKU"
                            aria-label="Search items"
                            className="h-9 pl-9 sm:w-56"
                        />
                    </div>
                }
                footer={<TablePagination pagination={paged} noun="items" unfiltered={all.length} />}
            >
                {items.loading ? (
                    <LoadingRows />
                ) : visible.length ? (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Item</TableHead>
                                <TableHead className="hidden sm:table-cell">SKU</TableHead>
                                <TableHead>Unit price</TableHead>
                                <TableHead>Tax type</TableHead>
                                <TableHead className="hidden md:table-cell">Unit</TableHead>
                                <TableHead>Status</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {paged.rows.map((item) => (
                                <TableRow key={item.id}>
                                    <TableCell className="font-medium">{item.name}</TableCell>
                                    <TableCell className="text-muted-foreground hidden font-mono text-xs sm:table-cell">
                                        {item.sku || "—"}
                                    </TableCell>
                                    <TableCell className="tabular font-bold">{kes(item.unit_price)}</TableCell>
                                    <TableCell>
                                        {item.tax_type_code ? (
                                            <Badge variant="default">
                                                {item.tax_type_code}
                                                {item.tax_rate ? ` · ${item.tax_rate}%` : ""}
                                            </Badge>
                                        ) : (
                                            <Badge variant="warn" dot>Not classified</Badge>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-muted-foreground hidden md:table-cell">
                                        {item.unit_code || "PCS"}
                                    </TableCell>
                                    <TableCell><StatusBadge status={item.status} /></TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                ) : all.length ? (
                    <EmptyState
                        icon={SearchIcon}
                        title="Nothing matches that search"
                        description="Clear the search box to see your full catalogue again."
                    />
                ) : (
                    <EmptyState
                        icon={BoxesIcon}
                        title="Your catalogue is empty"
                        description="Add the items you sell, with their price and KRA tax type, so orders can be raised against them."
                    />
                )}
            </ListCard>
        </>
    );
}

function NewItemDialog({ onCreated }: { onCreated: () => void }) {
    const [open, setOpen] = React.useState(false);
    const [saving, setSaving] = React.useState(false);
    const [taxType, setTaxType] = React.useState("B");

    async function submit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();

        const form = new FormData(event.currentTarget);
        const rate = TAX_TYPES.find((t) => t.code === taxType)?.rate ?? 0;

        setSaving(true);

        try {
            await api.createItem({
                name: String(form.get("name") ?? "").trim(),
                sku: String(form.get("sku") ?? "").trim() || null,
                unit_price: Number(form.get("price")),
                unit_code: String(form.get("unit") ?? "PCS"),
                tax_type_code: taxType,
                tax_rate: rate,
            });

            toast.success("Item added to your catalogue.");
            setOpen(false);
            onCreated();
        } catch (error) {
            toast.error(error instanceof ApiError ? error.message : "The item could not be saved.");
        } finally {
            setSaving(false);
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button><PlusIcon /> Add item</Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <BoxesIcon className="size-4" />
                    <DialogTitle>Add an item</DialogTitle>
                </DialogHeader>
                <form onSubmit={submit}>
                    <DialogBody>
                        <div className="grid gap-1.5">
                            <Label htmlFor="item-name">Name</Label>
                            <Input id="item-name" name="name" required placeholder="Maize flour 2kg" />
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="grid gap-1.5">
                                <Label htmlFor="item-price">Unit price (KES)</Label>
                                <Input id="item-price" name="price" type="number" min="0" step="1" required placeholder="180" />
                            </div>
                            <div className="grid gap-1.5">
                                <Label htmlFor="item-sku">SKU</Label>
                                <Input id="item-sku" name="sku" placeholder="Optional" />
                            </div>
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="grid gap-1.5">
                                <Label htmlFor="item-tax">KRA tax type</Label>
                                <Select value={taxType} onValueChange={setTaxType}>
                                    <SelectTrigger id="item-tax"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {TAX_TYPES.map((t) => (
                                            <SelectItem key={t.code} value={t.code}>{t.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="grid gap-1.5">
                                <Label htmlFor="item-unit">Unit</Label>
                                <Input id="item-unit" name="unit" defaultValue="PCS" />
                            </div>
                        </div>
                    </DialogBody>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                        <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Add item"}</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
