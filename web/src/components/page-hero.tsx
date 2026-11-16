import type { LucideIcon } from "lucide-react";

/**
 * The header every view opens with: a plain title, one line in everyday words,
 * an optional key figure, and the one action the view exists for. The `crumb`
 * prop is kept so existing pages still compile, but it is no longer shown.
 */
export function PageHero({
    title,
    accent,
    description,
    icon: Icon,
    action,
    figure,
}: {
    crumb?: string;
    title: string;
    accent?: string;
    description: string;
    icon: LucideIcon;
    action?: React.ReactNode;
    figure?: React.ReactNode;
}) {
    return (
        <header className="mb-5 flex flex-wrap items-end justify-between gap-4">
            <div className="flex min-w-0 items-start gap-3">
                <span className="bg-primary/10 text-primary grid size-10 shrink-0 place-items-center rounded-lg">
                    <Icon className="size-5" />
                </span>
                <div className="min-w-0">
                    <h1 className="text-foreground text-xl font-semibold tracking-tight sm:text-2xl">
                        {title} {accent ? <span className="text-primary">{accent}</span> : null}
                    </h1>
                    <p className="text-muted-foreground mt-0.5 text-sm">{description}</p>
                </div>
            </div>
            <div className="flex items-center gap-3">
                {figure ? <div className="text-right">{figure}</div> : null}
                {action ? <div className="relative shrink-0">{action}</div> : null}
            </div>
        </header>
    );
}
