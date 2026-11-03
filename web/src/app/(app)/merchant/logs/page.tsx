"use client";

import * as React from "react";
import { ChevronDownIcon, ScrollTextIcon, SearchIcon } from "lucide-react";

import { PageHero } from "@/components/page-hero";
import { EmptyState, ErrorState, LoadingRows } from "@/components/states";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useApi } from "@/hooks/use-api";
import { api } from "@/lib/api";
import { dateTime } from "@/lib/format";

type LogEvent = {
    id: number;
    created_at: string;
    stage: string;
    outcome: "OK" | "REJECTED" | "FAILED" | "STUCK";
    code: string | null;
    reference: string | null;
    sale_id: string | null;
    invoice_id: string | null;
    message: string;
    detail: string | null;
};

type LogsPayload = { events: LogEvent[]; stages: string[]; outcomes: string[] };

const ALL = "all";

const OUTCOME_STYLE: Record<LogEvent["outcome"], string> = {
    OK: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
    REJECTED: "bg-amber-50 text-amber-800 ring-amber-600/30",
    FAILED: "bg-red-50 text-red-700 ring-red-600/20",
    STUCK: "bg-violet-50 text-violet-700 ring-violet-600/20",
};

const label = (value: string) => value.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());

function prettyDetail(raw: string | null) {
    if (!raw) return null;
    try {
        return JSON.stringify(JSON.parse(raw), null, 2);
    } catch {
        return raw;
    }
}

export default function LogsPage() {
    const [stage, setStage] = React.useState(ALL);
    const [outcome, setOutcome] = React.useState(ALL);
    const [search, setSearch] = React.useState("");
    const [openId, setOpenId] = React.useState<number | null>(null);

    const query = React.useMemo(() => {
        const params = new URLSearchParams();
        if (stage !== ALL) params.set("stage", stage);
        if (outcome !== ALL) params.set("outcome", outcome);
        if (search.trim()) params.set("reference", search.trim());
        const text = params.toString();
        return text ? `?${text}` : "";
    }, [stage, outcome, search]);

    const logs = useApi<LogsPayload>(() => api.logs(query) as Promise<LogsPayload>, query);
    const problems = useApi<{ problems: { order_reference: string; problem: string }[] }>(
        () => api.logProblems() as Promise<{ problems: { order_reference: string; problem: string }[] }>
    );

    const events = logs.data?.events ?? [];
    const stages = logs.data?.stages ?? [];
    const outcomes = logs.data?.outcomes ?? [];

    return (
        <div className="grid gap-6">
            <PageHero
                crumb="Merchant / Logs"
                title="Your"
                accent="logs"
                description="Errors and events from the payment-to-KRA workflow, in plain words. Newest first."
                icon={ScrollTextIcon}
            />

            {problems.data && problems.data.problems.length > 0 ? (
                <div className="grid gap-2 rounded-xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/40">
                    <p className="text-sm font-bold text-amber-900 dark:text-amber-200">
                        Stuck right now ({problems.data.problems.length})
                    </p>
                    {problems.data.problems.map((p) => (
                        <p key={p.order_reference} className="text-sm">
                            <span className="font-mono text-xs">{p.order_reference}</span>
                            <span className="text-muted-foreground"> · {p.problem}</span>
                        </p>
                    ))}
                </div>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-[1fr_180px_180px]">
                <div className="relative">
                    <SearchIcon className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                    <Input
                        className="pl-9"
                        placeholder="Search by order reference"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>

                <Select value={stage} onValueChange={setStage}>
                    <SelectTrigger>
                        <SelectValue placeholder="All stages" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value={ALL}>All stages</SelectItem>
                        {stages.map((s) => (
                            <SelectItem key={s} value={s}>{label(s)}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <Select value={outcome} onValueChange={setOutcome}>
                    <SelectTrigger>
                        <SelectValue placeholder="All outcomes" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value={ALL}>All outcomes</SelectItem>
                        {outcomes.map((o) => (
                            <SelectItem key={o} value={o}>{label(o)}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {logs.error ? <ErrorState message={logs.error} onRetry={logs.reload} /> : null}

            <div className="border-border overflow-hidden rounded-xl border">
                {logs.loading ? (
                    <div className="p-4">
                        <LoadingRows />
                    </div>
                ) : events.length === 0 && !logs.error ? (
                    <EmptyState
                        icon={ScrollTextIcon}
                        title="No events yet"
                        description="Errors and workflow events appear here as payments and fiscalization run."
                    />
                ) : (
                    <ul className="divide-border divide-y">
                        {events.map((event) => {
                            const open = openId === event.id;
                            const detail = prettyDetail(event.detail);

                            return (
                                <li key={event.id}>
                                    <button
                                        type="button"
                                        onClick={() => setOpenId(open ? null : event.id)}
                                        className="hover:bg-muted/50 grid w-full gap-2 px-4 py-3 text-left sm:grid-cols-[150px_120px_1fr_auto] sm:items-center"
                                    >
                                        <span className="text-muted-foreground text-xs">{dateTime(event.created_at)}</span>
                                        <span className="text-xs font-semibold">{label(event.stage)}</span>
                                        <span className="text-sm">
                                            {event.message}
                                            {event.reference ? (
                                                <span className="text-muted-foreground ml-2 font-mono text-xs">{event.reference}</span>
                                            ) : null}
                                        </span>
                                        <span className="flex items-center gap-2">
                                            <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${OUTCOME_STYLE[event.outcome]}`}>
                                                {label(event.outcome)}
                                            </span>
                                            <ChevronDownIcon className={`text-muted-foreground size-4 transition ${open ? "rotate-180" : ""}`} />
                                        </span>
                                    </button>

                                    {open ? (
                                        <div className="bg-muted/30 grid gap-2 px-4 pb-4 text-xs">
                                            <p>
                                                <span className="text-muted-foreground">Code:</span> {event.code ?? "—"}
                                            </p>
                                            {event.sale_id ? <p><span className="text-muted-foreground">Sale ID:</span> <span className="font-mono">{event.sale_id}</span></p> : null}
                                            {event.invoice_id ? <p><span className="text-muted-foreground">Invoice ID:</span> <span className="font-mono">{event.invoice_id}</span></p> : null}
                                            {detail ? (
                                                <pre className="bg-background max-h-64 overflow-auto rounded-md border p-3 font-mono whitespace-pre-wrap">{detail}</pre>
                                            ) : null}
                                        </div>
                                    ) : null}
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>
        </div>
    );
}
