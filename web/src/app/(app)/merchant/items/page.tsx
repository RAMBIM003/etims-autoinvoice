"use client";

import * as React from "react";
import { BoxesIcon, CheckCircle2Icon, PlusIcon, SearchIcon } from "lucide-react";
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

/* Litre units cannot be registered with KRA yet (main blocks them until the code is confirmed). */
const LITRE_UNITS = ["LTR", "L"];

type KraRow = { id: string; item_code: string | null; mapped: boolean | null };
type KraClass = { code: string; name: string };

export default function ItemsPage() {
    const [query, setQuery] = React.useState("");
    const items = useApi<{ items: Item[] }>(() => api.items() as unknown as Promise<{ items: Item[] }>);
    const kra = useApi<{ items: KraRow[] }>(() => api.kraItems() as unknown as Promise<{ items: KraRow[] }>);

    const all = items.data?.items ?? [];
    const kraById = new Map((kra.data?.items ?? []).map((row) => [row.id, row]));
    const visible = all.filter((item) =>
        `${item.name} ${item.sku ?? ""}`.toLowerCase().includes(query.toLowerCase().trim())
    );
    const paged = usePagination(visible, query);
    const unclassified = all.filter((item) => !item.tax_type_code).length;
    const unregistered = all.filter((item) => !kraById.get(item.id)?.mapped).length;

    function reload() {
        items.reload();
        kra.reload();
    }

    return (
        <>
            <PageHero
                crumb="Merchant / Items"
                title="Your"
                accent="catalogue"
                description="What you sell, and how each line is classified for KRA."
                icon={BoxesIcon}
                action={<NewItemDialog onCreated={reload} />}
            />

            {items.error ? <ErrorState message={items.error} onRetry={reload} /> : null}

            {unclassified ? (
                <div className="border-warn-border bg-warn-soft text-warn mb-4 flex flex-wrap items-center gap-3 rounded-lg border px-4 py-3 text-sm">
                    <span className="min-w-0 flex-1">
                        <b>{unclassified} {unclassified === 1 ? "item has" : "items have"} no KRA tax type.</b>{" "}
                        Classify them before their next sale, or fiscalization will reject the invoice.
                    </span>
                </div>
            ) : null}

            {!unclassified && unregistered ? (
                <div className="border-warn-border bg-warn-soft text-warn mb-4 flex flex-wrap items-center gap-3 rounded-lg border px-4 py-3 text-sm">
                    <span className="min-w-0 flex-1">
                        <b>{unregistered} {unregistered === 1 ? "item is" : "items are"} not registered with KRA.</b>{" "}
                        Use Set up to register {unregistered === 1 ? "it" : "them"} before sales are fiscalized.
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
                {items.loading || kra.loading ? (
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
                                <TableHead>KRA</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead />
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {paged.rows.map((item) => {
                                const row = kraById.get(item.id);

                                return (
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
                                        <TableCell>
                                            {row?.mapped ? (
                                                <span className="flex items-center gap-1.5 font-mono text-xs text-emerald-700">
                                                    <CheckCircle2Icon className="size-3.5" />
                                                    {row.item_code}
                                                </span>
                                            ) : (
                                                <Badge variant="warn" dot>Not registered</Badge>
                                            )}
                                        </TableCell>
                                        <TableCell><StatusBadge status={item.status} /></TableCell>
                                        <TableCell className="text-right">
                                            {row?.mapped ? null : (
                                                <RegisterDialog item={item} onDone={reload} />
                                            )}
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
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

/* Search KRA's classification list, pick the class, and register in one step. */
function RegisterDialog({ item, onDone }: { item: Item; onDone: () => void }) {
    const [open, setOpen] = React.useState(false);
    const [busy, setBusy] = React.useState(false);
    const [term, setTerm] = React.useState("");
    const [results, setResults] = React.useState<KraClass[]>([]);
    const [searching, setSearching] = React.useState(false);
    const [chosen, setChosen] = React.useState<KraClass | null>(null);
    const [taxType, setTaxType] = React.useState(item.tax_type_code || "B");

    const isLitre = LITRE_UNITS.includes(String(item.unit_code || "").toUpperCase());
    const classified = Boolean(item.tax_type_code);

    async function search() {
        setSearching(true);

        try {
            const response = (await api.kraItemClasses(term.trim())) as { classes?: KraClass[] };
            setResults(Array.isArray(response.classes) ? response.classes : []);
        } catch (error) {
            toast.error(error instanceof ApiError ? error.message : "KRA's classification list could not be searched.");
        } finally {
            setSearching(false);
        }
    }

    async function register() {
        if (!chosen) return;
        setBusy(true);

        try {
            let tax = item.tax_type_code;

            if (!classified) {
                const rate = TAX_TYPES.find((t) => t.code === taxType)?.rate ?? 0;
                await api.updateItem(item.id, { tax_type_code: taxType, tax_rate: rate });
                tax = taxType;
            }

            const out = (await api.registerKraItem(item.id, {
                item_cls_code: chosen.code,
                tax_type_code: tax,
                item_type_code: "2",
            })) as { item_code?: string };

            toast.success(`${item.name} registered with KRA${out.item_code ? ` as ${out.item_code}` : ""}.`);
            setOpen(false);
            onDone();
        } catch (error) {
            toast.error(error instanceof ApiError ? error.message : "KRA did not register the item.");
        } finally {
            setBusy(false);
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm">Register with KRA</Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <BoxesIcon className="size-4" />
                    <DialogTitle>Register {item.name}</DialogTitle>
                </DialogHeader>
                <DialogBody>
                    {isLitre ? (
                        <p className="text-sm">
                            Items sold by the litre ({item.unit_code}) can&apos;t be registered with KRA yet. Their unit code
                            still needs to be confirmed with KRA.
                        </p>
                    ) : (
                        <div className="grid gap-4">
                            {!classified ? (
                                <div className="grid gap-1.5">
                                    <Label htmlFor="reg-tax">KRA tax type</Label>
                                    <Select value={taxType} onValueChange={setTaxType}>
                                        <SelectTrigger id="reg-tax"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            {TAX_TYPES.map((t) => (
                                                <SelectItem key={t.code} value={t.code}>{t.label}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            ) : (
                                <p className="text-muted-foreground text-sm">Tax type {item.tax_type_code}.</p>
                            )}

                            <div className="grid gap-1.5">
                                <Label htmlFor="reg-search">Search KRA&apos;s class list</Label>
                                <div className="flex gap-2">
                                    <Input
                                        id="reg-search"
                                        placeholder="e.g. mining, wash, oil"
                                        value={term}
                                        onChange={(e) => setTerm(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter") search();
                                        }}
                                    />
                                    <Button variant="outline" onClick={search} disabled={searching}>
                                        {searching ? "Searching…" : "Search"}
                                    </Button>
                                </div>
                            </div>

                            <div className="max-h-56 overflow-auto rounded-md border">
                                {results.map((c) => (
                                    <button
                                        key={c.code}
                                        type="button"
                                        onClick={() => setChosen(c)}
                                        className={`hover:bg-muted/50 block w-full px-3 py-2 text-left text-sm ${
                                            chosen?.code === c.code ? "bg-muted font-semibold" : ""
                                        }`}
                                    >
                                        <span className="font-mono text-xs">{c.code}</span> {c.name}
                                    </button>
                                ))}
                                {!results.length ? (
                                    <p className="text-muted-foreground px-3 py-2 text-sm">Search to see matching classes.</p>
                                ) : null}
                            </div>

                            {chosen ? (
                                <p className="text-sm">
                                    Selected: <span className="font-mono">{chosen.code}</span> {chosen.name}
                                </p>
                            ) : null}
                        </div>
                    )}
                </DialogBody>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                    {isLitre ? null : (
                        <Button onClick={register} disabled={busy || !chosen}>
                            {busy ? "Registering…" : "Register"}
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
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
