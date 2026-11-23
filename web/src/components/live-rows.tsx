"use client";

import * as React from "react";

/** Style for a row that rises in; later rows start a little after earlier ones. */
export function riseStyle(index: number): React.CSSProperties {
    return { "--row-i": Math.min(index, 12) } as React.CSSProperties;
}

/**
 * Tells which rows are new, or whose status changed, since the last refresh, so
 * they can be flagged for a few seconds. The first load flags nothing.
 */
export function useFreshRows<T>(rows: T[], idOf: (row: T) => string, signatureOf: (row: T) => string) {
    const [fresh, setFresh] = React.useState<ReadonlySet<string>>(() => new Set());
    const seen = React.useRef<Map<string, string> | null>(null);
    const timer = React.useRef<number | undefined>(undefined);
    const idRef = React.useRef(idOf);
    const signatureRef = React.useRef(signatureOf);

    React.useEffect(() => {
        idRef.current = idOf;
        signatureRef.current = signatureOf;
    });

    React.useEffect(() => {
        if (!rows.length) return;

        const current = new Map(rows.map((row) => [idRef.current(row), signatureRef.current(row)]));
        const before = seen.current;

        seen.current = current;

        if (!before) return;

        const changed = rows.map((row) => idRef.current(row)).filter((id) => before.get(id) !== current.get(id));

        if (!changed.length) return;

        window.clearTimeout(timer.current);
        setFresh(new Set(changed));
        timer.current = window.setTimeout(() => setFresh(new Set()), 4000);
    }, [rows]);

    React.useEffect(() => () => window.clearTimeout(timer.current), []);

    return fresh;
}
