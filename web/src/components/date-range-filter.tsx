"use client";

import * as React from "react";
import { FilterIcon, XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/** Inclusive calendar days as "YYYY-MM-DD"; an empty end is open. */
export type DateRange = { from: string; to: string };

export const ANY_DATE: DateRange = { from: "", to: "" };

const EAT = "Africa/Nairobi";

/** The Nairobi calendar day a timestamp falls on, as "YYYY-MM-DD". */
export function dayKey(value: unknown): string {
    const d = value instanceof Date ? value : new Date(String(value ?? ""));

    return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-CA", { timeZone: EAT });
}

/* Day arithmetic on "YYYY-MM-DD" strings, at noon UTC so no offset can tip it into another day. */
function addDays(key: string, days: number) {
    const d = new Date(`${key}T12:00:00Z`);

    d.setUTCDate(d.getUTCDate() + days);

    return d.toISOString().slice(0, 10);
}

export function inRange(value: unknown, range: DateRange): boolean {
    if (!range.from && !range.to) return true;

    const key = dayKey(value);

    if (!key) return false;

    return (!range.from || key >= range.from) && (!range.to || key <= range.to);
}

export function isActive(range: DateRange) {
    return Boolean(range.from || range.to);
}

function shortDay(key: string, withYear: boolean) {
    return new Date(`${key}T12:00:00Z`).toLocaleDateString("en-KE", {
        timeZone: "UTC",
        day: "numeric",
        month: "short",
        year: withYear ? "numeric" : undefined,
    });
}

/** "1 Oct – 29 Oct", "From 1 Oct", "Until 29 Oct", with the year only when it is not this one. */
export function describeRange(range: DateRange): string {
    const thisYear = dayKey(new Date()).slice(0, 4);
    const withYear = [range.from, range.to].some((k) => k && k.slice(0, 4) !== thisYear);

    if (range.from && range.to) {
        return range.from === range.to
            ? shortDay(range.from, withYear)
            : `${shortDay(range.from, withYear)} – ${shortDay(range.to, withYear)}`;
    }

    if (range.from) return `From ${shortDay(range.from, withYear)}`;
    if (range.to) return `Until ${shortDay(range.to, withYear)}`;

    return "Any date";
}

function presets(): { label: string; range: DateRange }[] {
    const today = dayKey(new Date());
    const monthStart = `${today.slice(0, 8)}01`;
    const lastMonthEnd = addDays(monthStart, -1);

    return [
        { label: "Today", range: { from: today, to: today } },
        { label: "Yesterday", range: { from: addDays(today, -1), to: addDays(today, -1) } },
        { label: "Last 7 days", range: { from: addDays(today, -6), to: today } },
        { label: "Last 30 days", range: { from: addDays(today, -29), to: today } },
        { label: "This month", range: { from: monthStart, to: today } },
        { label: "Last month", range: { from: `${lastMonthEnd.slice(0, 8)}01`, to: lastMonthEnd } },
    ];
}

/**
 * A filter button that opens From/To date pickers. While a range is applied
 * the button spells it out, with a clear button beside it, so a filtered list
 * never looks like the whole list.
 */
export function DateRangeFilter({
    value,
    onChange,
    hint,
}: {
    value: DateRange;
    onChange: (range: DateRange) => void;
    /** Which date the list is filtered on, e.g. "Payments are filtered by the day they were paid." */
    hint: string;
}) {
    const [open, setOpen] = React.useState(false);
    const [draft, setDraft] = React.useState(value);
    const rootRef = React.useRef<HTMLDivElement>(null);
    const triggerRef = React.useRef<HTMLButtonElement>(null);
    const fromRef = React.useRef<HTMLInputElement>(null);
    const panelId = React.useId();

    const active = isActive(value);
    const today = dayKey(new Date());
    const backwards = Boolean(draft.from && draft.to && draft.from > draft.to);

    function toggle() {
        if (!open) setDraft(value);
        setOpen(!open);
    }

    function close(restoreFocus = true) {
        setOpen(false);
        if (restoreFocus) triggerRef.current?.focus();
    }

    function apply(range: DateRange) {
        onChange(range);
        close();
    }

    React.useEffect(() => {
        if (!open) return;

        fromRef.current?.focus();

        const outside = (event: PointerEvent) => {
            if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
        };
        const escape = (event: KeyboardEvent) => {
            if (event.key !== "Escape") return;
            setOpen(false);
            triggerRef.current?.focus();
        };

        document.addEventListener("pointerdown", outside);
        document.addEventListener("keydown", escape);

        return () => {
            document.removeEventListener("pointerdown", outside);
            document.removeEventListener("keydown", escape);
        };
    }, [open]);

    return (
        <div ref={rootRef} className="relative flex items-center gap-1">
            <Button
                ref={triggerRef}
                type="button"
                variant="outline"
                size={active ? "sm" : "icon-sm"}
                className={cn("h-9", active ? "border-primary/40 bg-primary-soft text-primary hover:bg-primary-soft" : "size-9")}
                onClick={toggle}
                aria-expanded={open}
                aria-controls={panelId}
                aria-label={active ? `Date filter: ${describeRange(value)}. Change` : "Filter by date"}
            >
                <FilterIcon />
                {active ? <span className="tabular whitespace-nowrap">{describeRange(value)}</span> : null}
            </Button>

            {active ? (
                <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="text-muted-foreground size-7"
                    onClick={() => onChange(ANY_DATE)}
                    aria-label="Clear date filter"
                >
                    <XIcon />
                </Button>
            ) : null}

            {open ? (
                <div
                    id={panelId}
                    role="dialog"
                    aria-label="Filter by date"
                    className="bg-popover text-popover-foreground animate-in fade-in zoom-in-95 absolute top-full right-0 z-50 mt-2 w-[min(20rem,calc(100vw-2rem))] origin-top-right rounded-xl border p-4 shadow-lg"
                >
                    <p className="font-display text-sm font-bold">Filter by date</p>
                    <p className="text-muted-foreground mb-3 text-xs">{hint}</p>

                    <div className="mb-4 grid grid-cols-2 gap-1.5">
                        {presets().map((preset) => {
                            const chosen = preset.range.from === draft.from && preset.range.to === draft.to;

                            return (
                                <Button
                                    key={preset.label}
                                    type="button"
                                    variant={chosen ? "default" : "outline"}
                                    size="sm"
                                    className="justify-start"
                                    onClick={() => apply(preset.range)}
                                >
                                    {preset.label}
                                </Button>
                            );
                        })}
                    </div>

                    <form
                        onSubmit={(event) => {
                            event.preventDefault();
                            if (!backwards) apply(draft);
                        }}
                    >
                        <div className="grid grid-cols-2 gap-2.5">
                            <div className="grid gap-1.5">
                                <Label htmlFor={`${panelId}-from`} className="text-xs">From</Label>
                                <Input
                                    ref={fromRef}
                                    id={`${panelId}-from`}
                                    type="date"
                                    value={draft.from}
                                    max={draft.to || today}
                                    onChange={(e) => setDraft({ ...draft, from: e.target.value })}
                                    className="h-9 px-2 text-sm"
                                />
                            </div>
                            <div className="grid gap-1.5">
                                <Label htmlFor={`${panelId}-to`} className="text-xs">To</Label>
                                <Input
                                    id={`${panelId}-to`}
                                    type="date"
                                    value={draft.to}
                                    min={draft.from || undefined}
                                    max={today}
                                    onChange={(e) => setDraft({ ...draft, to: e.target.value })}
                                    className="h-9 px-2 text-sm"
                                />
                            </div>
                        </div>

                        <p className={cn("mt-2 min-h-4 text-xs", backwards ? "text-bad" : "text-muted-foreground")} aria-live="polite">
                            {backwards ? "The From date must be on or before the To date." : "Leave either end empty to keep it open."}
                        </p>

                        <div className="mt-3 flex justify-between gap-2">
                            <Button type="button" variant="ghost" size="sm" onClick={() => apply(ANY_DATE)} disabled={!active && !isActive(draft)}>
                                Clear
                            </Button>
                            <Button type="submit" size="sm" disabled={backwards}>
                                Apply
                            </Button>
                        </div>
                    </form>
                </div>
            ) : null}
        </div>
    );
}
