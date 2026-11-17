import type { KeyboardEvent, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * A KPI tile in the frosted-glass style. The whole border takes the accent colour,
 * which is chosen by what the figure means (see the dashboard).
 *
 * With `onOpen`, the tile can be clicked or opened with the keyboard. `expanded`
 * is the larger version shown in the overlay, with the border glowing.
 */
export function KpiTile({
    label,
    value,
    sub,
    icon: Icon,
    accent,
    footer,
    loading,
    onOpen,
    expanded = false,
}: {
    label: string;
    value: ReactNode;
    sub?: ReactNode;
    icon: LucideIcon;
    accent: string;
    footer?: ReactNode;
    loading?: boolean;
    onOpen?: () => void;
    expanded?: boolean;
}) {
    const interactive = Boolean(onOpen) && !expanded;

    function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onOpen?.();
        }
    }

    return (
        <div
            role={interactive ? "button" : undefined}
            tabIndex={interactive ? 0 : undefined}
            aria-label={interactive ? `Open ${label}` : undefined}
            aria-busy={loading}
            onClick={interactive ? onOpen : undefined}
            onKeyDown={interactive ? onKeyDown : undefined}
            className={cn(
                "bg-card/70 flex min-h-32 flex-col gap-2 rounded-xl border-2 p-4 shadow-sm backdrop-blur-md transition-shadow duration-300",
                interactive && "hover:shadow-md focus-visible:ring-ring cursor-pointer focus-visible:ring-2 focus-visible:outline-none",
                expanded && "min-h-56 gap-4 p-6"
            )}
            style={{
                borderColor: accent,
                boxShadow: expanded ? `0 0 0 1px ${accent}, 0 0 48px -6px ${accent}` : undefined,
            }}
        >
            <div className="flex items-center gap-2">
                <span className="bg-muted grid size-8 shrink-0 place-items-center rounded-lg" style={{ color: accent }}>
                    <Icon className="size-4" />
                </span>
                <p className={cn("text-muted-foreground font-semibold", expanded ? "text-sm" : "text-xs")}>{label}</p>
            </div>
            <p className={cn("tabular font-display font-extrabold", expanded ? "text-4xl" : "text-2xl")}>
                {loading ? "—" : value}
            </p>
            {sub ? <p className={cn("text-muted-foreground", expanded ? "text-sm" : "text-xs")}>{sub}</p> : null}
            {footer ? (
                /* A link inside the tile should go where it says, not open the tile. */
                <div className="mt-auto pt-1" onClick={(event) => event.stopPropagation()}>
                    {footer}
                </div>
            ) : null}
        </div>
    );
}
