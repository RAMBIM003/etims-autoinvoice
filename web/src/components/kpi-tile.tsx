import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

/**
 * A KPI tile in the frosted-glass style. The left border and icon take the
 * accent colour, which is chosen by what the figure means (see the dashboard).
 */
export function KpiTile({
    label,
    value,
    sub,
    icon: Icon,
    accent,
    footer,
    loading,
}: {
    label: string;
    value: ReactNode;
    sub?: ReactNode;
    icon: LucideIcon;
    accent: string;
    footer?: ReactNode;
    loading?: boolean;
}) {
    return (
        <div
            aria-busy={loading}
            className="bg-card/70 flex min-h-32 flex-col gap-2 rounded-xl border border-l-4 p-4 shadow-sm backdrop-blur-md"
            style={{ borderLeftColor: accent }}
        >
            <div className="flex items-center gap-2">
                <span className="bg-muted grid size-8 shrink-0 place-items-center rounded-lg" style={{ color: accent }}>
                    <Icon className="size-4" />
                </span>
                <p className="text-muted-foreground text-xs font-semibold">{label}</p>
            </div>
            <p className="tabular font-display text-2xl font-extrabold">{loading ? "—" : value}</p>
            {sub ? <p className="text-muted-foreground text-xs">{sub}</p> : null}
            {footer ? <div className="mt-auto pt-1">{footer}</div> : null}
        </div>
    );
}
