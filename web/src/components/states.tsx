import { AlertTriangleIcon, type LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export function LoadingRows({ rows = 5 }: { rows?: number }) {
    return (
        <div className="flex flex-col gap-2 py-2" aria-busy="true" aria-live="polite">
            <span className="sr-only">Loading</span>
            {Array.from({ length: rows }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
            ))}
        </div>
    );
}

/** Says what is missing and what to do about it, never just "No data". */
export function EmptyState({
    icon: Icon,
    title,
    description,
    action,
}: {
    icon: LucideIcon;
    title: string;
    description: string;
    action?: React.ReactNode;
}) {
    return (
        <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
            <span className="bg-secondary text-muted-foreground grid size-11 place-items-center rounded-full">
                <Icon className="size-5" />
            </span>
            <p className="font-display text-base font-bold">{title}</p>
            <p className="text-muted-foreground max-w-sm text-sm leading-relaxed">{description}</p>
            {action ? <div className="mt-2">{action}</div> : null}
        </div>
    );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
    return (
        <div
            role="alert"
            className="border-bad-border bg-bad-soft text-bad flex flex-wrap items-center gap-3 rounded-lg border px-4 py-3 text-sm"
        >
            <AlertTriangleIcon className="size-4 shrink-0" />
            <span className="min-w-0 flex-1">{message}</span>
            {onRetry ? (
                <Button variant="outline" size="sm" onClick={onRetry}>
                    Try again
                </Button>
            ) : null}
        </div>
    );
}
