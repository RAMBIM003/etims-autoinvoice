"use client";

import * as React from "react";
import { ChevronLeftIcon, ChevronRightIcon, ChevronsLeftIcon, ChevronsRightIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

const PAGE_SIZES = [10, 25, 50, 100];

export type Pagination<T> = {
    rows: T[];
    page: number;
    pageCount: number;
    pageSize: number;
    total: number;
    setPage: (page: number) => void;
    setPageSize: (size: number) => void;
};

/**
 * Slices an already filtered list into pages. `resetKey` is whatever the
 * filters are made of: when it changes the list is a different list, so the
 * page goes back to the first one instead of landing past the end.
 */
export function usePagination<T>(all: T[], resetKey = "", initialSize = PAGE_SIZES[0]): Pagination<T> {
    const [pageSize, setSize] = React.useState(initialSize);
    const [state, setState] = React.useState({ page: 1, key: resetKey });

    const pageCount = Math.max(1, Math.ceil(all.length / pageSize));
    /* Clamped, so a reload that shrinks the list never leaves an empty page. */
    const page = Math.min(state.key === resetKey ? state.page : 1, pageCount);

    const setPage = React.useCallback(
        (next: number) => setState({ page: Math.max(1, next), key: resetKey }),
        [resetKey]
    );

    const setPageSize = React.useCallback(
        (size: number) => {
            /* Keep the first row on screen in view rather than jumping back to the top. */
            const firstRow = (page - 1) * pageSize;

            setSize(size);
            setState({ page: Math.floor(firstRow / size) + 1, key: resetKey });
        },
        [page, pageSize, resetKey]
    );

    return {
        rows: all.slice((page - 1) * pageSize, page * pageSize),
        page,
        pageCount,
        pageSize,
        total: all.length,
        setPage,
        setPageSize,
    };
}

/* Always seven slots once there are more than seven pages, so the buttons
   never shift under the pointer: 1 … 4 5 6 … 12. */
function pageSlots(page: number, count: number): (number | "gap")[] {
    if (count <= 7) return Array.from({ length: count }, (_, i) => i + 1);
    if (page <= 4) return [1, 2, 3, 4, 5, "gap", count];
    if (page >= count - 3) return [1, "gap", count - 4, count - 3, count - 2, count - 1, count];

    return [1, "gap", page - 1, page, page + 1, "gap", count];
}

/**
 * The footer under a paged table: where you are in the list on the left,
 * rows per page and page controls on the right. `unfiltered` is the size of
 * the list before search and filters, shown when they hide part of it.
 * `noun` is the plural; `one` is only needed when dropping an "s" is wrong.
 */
export function TablePagination<T>({
    pagination,
    noun,
    one = noun.replace(/s$/, ""),
    unfiltered,
}: {
    pagination: Pagination<T>;
    noun: string;
    one?: string;
    unfiltered?: number;
}) {
    const { page, pageCount, pageSize, total, setPage, setPageSize } = pagination;
    const navRef = React.useRef<HTMLElement>(null);

    const from = total ? (page - 1) * pageSize + 1 : 0;
    const to = Math.min(page * pageSize, total);

    function go(next: number) {
        if (next < 1 || next > pageCount || next === page) return;

        setPage(next);

        /* From the bottom of a long page, the new rows start above the fold. */
        const card = navRef.current?.closest<HTMLElement>("[data-slot=card]");

        if (card && card.getBoundingClientRect().top < 0) {
            card.scrollIntoView({ behavior: "smooth", block: "start" });
        }
    }

    return (
        <>
            <p className="tabular" aria-live="polite">
                {pageCount > 1 ? (
                    <>
                        <span className="text-foreground font-semibold">
                            {from}–{to}
                        </span>{" "}
                        of <span className="text-foreground font-semibold">{total}</span> {noun}
                    </>
                ) : (
                    /* Everything fits on one page, so a range would only be noise. */
                    <>
                        <span className="text-foreground font-semibold">{total || "No"}</span>{" "}
                        {total === 1 ? one : noun}
                    </>
                )}
                {unfiltered !== undefined && unfiltered !== total ? <> · filtered from {unfiltered}</> : null}
            </p>

            {total > PAGE_SIZES[0] ? (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                    <label className="flex items-center gap-2">
                        <span className="hidden sm:inline">Rows per page</span>
                        <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
                            <SelectTrigger size="sm" className="w-[72px]" aria-label="Rows per page">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {PAGE_SIZES.map((size) => (
                                    <SelectItem key={size} value={String(size)}>
                                        {size}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </label>

                    {pageCount > 1 ? (
                        <nav ref={navRef} aria-label={`${noun} pages`} className="flex items-center gap-1">
                            <Button
                                variant="outline"
                                size="icon-sm"
                                className="hidden sm:inline-flex"
                                onClick={() => go(1)}
                                disabled={page === 1}
                                aria-label="First page"
                            >
                                <ChevronsLeftIcon />
                            </Button>
                            <Button
                                variant="outline"
                                size="icon-sm"
                                onClick={() => go(page - 1)}
                                disabled={page === 1}
                                aria-label="Previous page"
                            >
                                <ChevronLeftIcon />
                            </Button>

                            {/* Numbered pages need room; a phone gets "2 / 5" between the arrows. */}
                            <span className="tabular text-foreground px-2 text-xs font-semibold sm:hidden">
                                {page} / {pageCount}
                            </span>
                            <span className="hidden items-center gap-1 sm:flex">
                                {pageSlots(page, pageCount).map((slot, i) =>
                                    slot === "gap" ? (
                                        <span key={`gap-${i}`} aria-hidden className="w-6 text-center">
                                            …
                                        </span>
                                    ) : (
                                        <Button
                                            key={slot}
                                            variant={slot === page ? "default" : "ghost"}
                                            size="icon-sm"
                                            className={cn("tabular text-xs", slot !== page && "text-muted-foreground")}
                                            onClick={() => go(slot)}
                                            aria-label={`Page ${slot}`}
                                            aria-current={slot === page ? "page" : undefined}
                                        >
                                            {slot}
                                        </Button>
                                    )
                                )}
                            </span>

                            <Button
                                variant="outline"
                                size="icon-sm"
                                onClick={() => go(page + 1)}
                                disabled={page === pageCount}
                                aria-label="Next page"
                            >
                                <ChevronRightIcon />
                            </Button>
                            <Button
                                variant="outline"
                                size="icon-sm"
                                className="hidden sm:inline-flex"
                                onClick={() => go(pageCount)}
                                disabled={page === pageCount}
                                aria-label="Last page"
                            >
                                <ChevronsRightIcon />
                            </Button>
                        </nav>
                    ) : null}
                </div>
            ) : null}
        </>
    );
}
