import type { LucideIcon } from "lucide-react";
import { TrendingDownIcon, TrendingUpIcon } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Sparkline } from "@/components/charts/sparkline";
import { cn } from "@/lib/utils";

export function StatCard({
    label,
    value,
    delta,
    series,
    icon: Icon,
    tone = "brand",
}: {
    label: string;
    value: string;
    delta?: { direction: "up" | "down"; text: string };
    series?: number[];
    icon: LucideIcon;
    tone?: "brand" | "ink";
}) {
    const Arrow = delta?.direction === "down" ? TrendingDownIcon : TrendingUpIcon;

    return (
        <Card className="flex items-center gap-3 p-4">
            <span
                className={cn(
                    "grid size-10 shrink-0 place-items-center rounded-full",
                    tone === "brand" ? "bg-primary-soft text-primary" : "bg-secondary text-foreground"
                )}
            >
                <Icon className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
                <p className="text-muted-foreground truncate text-xs font-semibold">{label}</p>
                <p className="tabular truncate text-xl font-extrabold tracking-tight">{value}</p>
                {delta ? (
                    <p
                        className={cn(
                            "mt-0.5 flex items-center gap-1 text-xs font-semibold",
                            delta.direction === "up" ? "text-ok" : "text-bad"
                        )}
                    >
                        <Arrow className="size-3.5" />
                        {delta.text}
                    </p>
                ) : null}
                {series?.length ? (
                    <Sparkline values={series} tone={tone} className="mt-1.5" />
                ) : null}
            </div>
        </Card>
    );
}
