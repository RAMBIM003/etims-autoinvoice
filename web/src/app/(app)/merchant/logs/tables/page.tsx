"use client";

import * as React from "react";
import { DatabaseIcon, SearchIcon } from "lucide-react";

import { LogsTabs } from "@/components/logs-tabs";
import { PageHero } from "@/components/page-hero";
import { EmptyState, ErrorState, LoadingRows } from "@/components/states";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useApi } from "@/hooks/use-api";
import { api } from "@/lib/api";
import { dateTime } from "@/lib/format";

type TableView = { table: string; columns: string[]; rows: Record<string, unknown>[] };

const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

/* Plain text for each cell: dates readable, long values cut short. */
function show(value: unknown): string {
    if (value === null || value === undefined || value === "") return "—";
    if (typeof value === "boolean") return value ? "Yes" : "No";
    if (typeof value === "number") return value.toLocaleString();
    if (typeof value === "string") {
        if (ISO_DATE.test(value)) return dateTime(value);
        return value.length > 160 ? `${value.slice(0, 160)}…` : value;
    }

    const json = JSON.stringify(value);
    return json.length > 160 ? `${json.slice(0, 160)}…` : json;
}

const label = (column: string) => column.replace(/_/g, " ");

export default function LogsTablesPage() {
    const [table, setTable] = React.useState("payments");
    const [search, setSearch] = React.useState("");

    const names = useApi<{ tables: string[] }>(() => api.logTables() as Promise<{ tables: string[] }>);

    const query = search.trim() ? `?reference=${encodeURIComponent(search.trim())}` : "";
    const data = useApi<TableView>(() => api.logTable(table, query) as Promise<TableView>, `${table}|${query}`);

    const rows = data.data?.rows ?? [];
    const columns = data.data?.columns ?? [];

    return (
        <div className="grid gap-6">
            <PageHero
                crumb="Merchant / Logs"
                title="Workflow"
                accent="tables"
                description="Read-only rows from the tables behind each order. Search by order reference to follow one order across tables."
                icon={DatabaseIcon}
            />

            <LogsTabs />

            <div className="grid gap-3 sm:grid-cols-[220px_1fr]">
                <Select value={table} onValueChange={setTable}>
                    <SelectTrigger>
                        <SelectValue placeholder="Choose a table" />
                    </SelectTrigger>
                    <SelectContent>
                        {(names.data?.tables ?? []).map((name) => (
                            <SelectItem key={name} value={name}>{name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <div className="relative">
                    <SearchIcon className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                    <Input
                        className="pl-9"
                        placeholder="Order reference, e.g. ORD-1793696139972"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
            </div>

            {data.error ? <ErrorState message={data.error} onRetry={data.reload} /> : null}

            <div className="border-border overflow-x-auto rounded-xl border">
                {data.loading ? (
                    <div className="p-4">
                        <LoadingRows />
                    </div>
                ) : rows.length === 0 && !data.error ? (
                    <EmptyState
                        icon={DatabaseIcon}
                        title="No rows"
                        description={search ? "No rows in this table match that order reference." : "This table has no rows for your business yet."}
                    />
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                {columns.map((column) => (
                                    <TableHead key={column} className="text-xs whitespace-nowrap capitalize">
                                        {label(column)}
                                    </TableHead>
                                ))}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {rows.map((row, index) => (
                                <TableRow key={index}>
                                    {columns.map((column) => (
                                        <TableCell key={column} className="max-w-[260px] truncate font-mono text-xs">
                                            {show(row[column])}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                )}
            </div>

            {rows.length === 200 ? (
                <p className="text-muted-foreground text-xs">Showing the newest 200 rows. Search by order reference to narrow it down.</p>
            ) : null}
        </div>
    );
}
