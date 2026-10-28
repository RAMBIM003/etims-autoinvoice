import type { LucideIcon } from "lucide-react";

import { Card } from "@/components/ui/card";

/**
 * The card every list in the app sits in: an icon, a title with its count, a
 * line of tools, then the table. The table scrolls inside the card, so the page
 * itself never scrolls sideways.
 */
export function ListCard({
    icon: Icon,
    title,
    count,
    description,
    tools,
    children,
    footer,
}: {
    icon: LucideIcon;
    title: string;
    count?: number;
    description: string;
    tools?: React.ReactNode;
    children: React.ReactNode;
    footer?: React.ReactNode;
}) {
    return (
        <Card className="@container mb-4 min-w-0 p-4 sm:p-5">
            <div className="mb-3.5 flex flex-wrap items-center gap-3">
                <span className="bg-primary text-primary-foreground grid size-10 shrink-0 place-items-center rounded-xl">
                    <Icon className="size-5" />
                </span>
                <div className="min-w-0">
                    <h2 className="font-display text-[17px] leading-tight font-bold">
                        {title}{" "}
                        {typeof count === "number" ? (
                            <span className="text-muted-foreground tabular font-medium">({count})</span>
                        ) : null}
                    </h2>
                    <p className="text-muted-foreground text-xs">{description}</p>
                </div>
                {tools ? (
                    <div className="flex w-full flex-col gap-2 sm:ml-auto sm:w-auto sm:flex-row sm:items-center">
                        {tools}
                    </div>
                ) : null}
            </div>
            {children}
            {footer ? (
                <div className="text-muted-foreground mt-3 flex flex-wrap items-center justify-between gap-3 text-sm">
                    {footer}
                </div>
            ) : null}
        </Card>
    );
}
