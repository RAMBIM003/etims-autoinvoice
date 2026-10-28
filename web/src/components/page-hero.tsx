import type { LucideIcon } from "lucide-react";

/**
 * The dark band every view opens with. It carries the breadcrumb and the one
 * action the view exists for, so the summary reads before any table does.
 */
export function PageHero({
    crumb,
    title,
    accent,
    description,
    icon: Icon,
    action,
}: {
    crumb: string;
    title: string;
    accent?: string;
    description: string;
    icon: LucideIcon;
    action?: React.ReactNode;
}) {
    return (
        <section className="bg-band text-band-foreground relative isolate mb-4 flex flex-wrap items-center gap-4 overflow-hidden rounded-xl px-4 py-4 sm:rounded-2xl sm:px-6">
            <span
                aria-hidden
                className="pointer-events-none absolute inset-y-0 right-0 w-1/3 bg-[linear-gradient(115deg,transparent_55%,var(--primary)_55%,var(--primary)_60%,transparent_60%,transparent_74%,var(--primary)_74%,var(--primary)_78%,transparent_78%)] opacity-30"
            />
            <span className="bg-primary text-primary-foreground grid size-11 shrink-0 place-items-center rounded-xl shadow-[0_8px_18px_rgba(217,22,43,0.38)]">
                <Icon className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
                <p className="text-band-muted text-[11px] font-semibold tracking-[0.08em] uppercase">{crumb}</p>
                <h1 className="mt-0.5 text-xl font-extrabold sm:text-2xl">
                    {title} {accent ? <span className="text-primary">{accent}</span> : null}
                </h1>
                <p className="text-band-muted mt-0.5 text-sm">{description}</p>
            </div>
            {action ? <div className="relative shrink-0">{action}</div> : null}
        </section>
    );
}
