import * as React from "react";

import { cn } from "@/lib/utils";

function Card({ className, ...props }: React.ComponentProps<"div">) {
    return (
        <div
            data-slot="card"
            className={cn(
                "bg-card text-card-foreground rounded-xl border shadow-[0_4px_14px_rgba(15,23,42,0.04)] dark:shadow-[0_4px_14px_rgba(0,0,0,0.4)]",
                className
            )}
            {...props}
        />
    );
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
    return (
        <div
            data-slot="card-header"
            className={cn("flex items-center gap-3 p-4 sm:p-5", className)}
            {...props}
        />
    );
}

function CardTitle({ className, ...props }: React.ComponentProps<"h3">) {
    return (
        <h3
            data-slot="card-title"
            className={cn("font-display text-base font-bold leading-tight", className)}
            {...props}
        />
    );
}

function CardDescription({ className, ...props }: React.ComponentProps<"p">) {
    return (
        <p
            data-slot="card-description"
            className={cn("text-muted-foreground text-xs leading-relaxed", className)}
            {...props}
        />
    );
}

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
    return (
        <div
            data-slot="card-action"
            className={cn("ml-auto flex shrink-0 items-center gap-2", className)}
            {...props}
        />
    );
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
    return (
        <div
            data-slot="card-content"
            className={cn("p-4 pt-0 sm:p-5 sm:pt-0", className)}
            {...props}
        />
    );
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
    return (
        <div
            data-slot="card-footer"
            className={cn("flex items-center gap-3 p-4 pt-0 sm:p-5 sm:pt-0", className)}
            {...props}
        />
    );
}

export { Card, CardHeader, CardTitle, CardDescription, CardAction, CardContent, CardFooter };
