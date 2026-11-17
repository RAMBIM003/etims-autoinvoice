"use client";

import * as React from "react";

import { ApiError } from "@/lib/api";

type State<T> = { data: T | null; error: string | null; loading: boolean; key: string };

function message(error: unknown) {
    return error instanceof ApiError ? error.message : "Something went wrong loading this page.";
}

/**
 * Loads once on mount, reloads when `key` changes or `reload()` is called.
 *
 * With `refreshMs`, it also re-reads the data on that interval while the tab is
 * visible. A background refresh keeps the rows already on screen until the new
 * ones arrive, so the table does not flash to a loading state every time.
 *
 * `key` identifies the request rather than the loader function, because the
 * loader is an inline arrow that is a new value on every render. Nothing is
 * cached between pages: every list here is a fresh read of live payment state.
 */
export function useApi<T>(loader: () => Promise<T>, key = "", options: { refreshMs?: number } = {}) {
    const { refreshMs } = options;
    const [nonce, setNonce] = React.useState(0);
    const [tick, setTick] = React.useState(0);
    const [state, setState] = React.useState<State<T>>({ data: null, error: null, loading: true, key });

    const loaderRef = React.useRef(loader);
    const quietRef = React.useRef(false);

    React.useEffect(() => {
        loaderRef.current = loader;
    });

    React.useEffect(() => {
        if (!refreshMs) return;

        const id = window.setInterval(() => {
            if (document.visibilityState !== "visible") return;

            quietRef.current = true;
            setTick((t) => t + 1);
        }, refreshMs);

        return () => window.clearInterval(id);
    }, [refreshMs]);

    React.useEffect(() => {
        let cancelled = false;
        const quiet = quietRef.current;

        quietRef.current = false;

        loaderRef
            .current()
            .then((data) => {
                if (!cancelled) setState({ data, error: null, loading: false, key });
            })
            .catch((error: unknown) => {
                if (cancelled) return;

                /* A failed background refresh keeps the last good rows on screen. */
                setState((s) =>
                    quiet && s.data ? s : { data: null, error: message(error), loading: false, key }
                );
            });

        return () => {
            cancelled = true;
        };
    }, [key, nonce, tick]);

    const reload = React.useCallback(() => {
        setState((s) => ({ ...s, loading: true, error: null }));
        setNonce((n) => n + 1);
    }, []);

    /* A key change starts a new request, so report loading until it settles. */
    const loading = state.loading || state.key !== key;

    return {
        data: loading ? null : state.data,
        error: loading ? null : state.error,
        loading,
        reload,
    };
}
