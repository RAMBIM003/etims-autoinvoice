import * as React from "react";

import { cn } from "@/lib/utils";

/* The container scrolls sideways so the page itself never does. */
function Table({ className, ...props }: React.ComponentProps<"table">) {
    return (
        <div data-slot="table-container" className="w-full overflow-x-auto">
            <table
                data-slot="table"
                className={cn("w-full border-separate border-spacing-0 text-sm", className)}
                {...props}
            />
        </div>
    );
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
    return <thead data-slot="table-header" className={cn(className)} {...props} />;
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
    return <tbody data-slot="table-body" className={cn(className)} {...props} />;
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
    return (
        <tr
            data-slot="table-row"
            className={cn("group/row transition-colors", className)}
            {...props}
        />
    );
}

function TableHead({ className, ...props }: React.ComponentProps<"th">) {
    return (
        <th
            data-slot="table-head"
            className={cn(
                "bg-band text-band-foreground px-3 py-2.5 text-left text-[11px] font-bold tracking-[0.07em] whitespace-nowrap uppercase",
                "first:rounded-l-md last:rounded-r-md",
                className
            )}
            {...props}
        />
    );
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
    return (
        <td
            data-slot="table-cell"
            className={cn(
                "border-border border-b px-3 py-2.5 align-middle whitespace-nowrap",
                "group-hover/row:bg-accent/40 group-last/row:border-b-0",
                "group-hover/row:first:shadow-[inset_3px_0_0_var(--primary)]",
                className
            )}
            {...props}
        />
    );
}

function TableCaption({ className, ...props }: React.ComponentProps<"caption">) {
    return (
        <caption
            data-slot="table-caption"
            className={cn("text-muted-foreground mt-3 text-sm", className)}
            {...props}
        />
    );
}

export { Table, TableHeader, TableBody, TableHead, TableRow, TableCell, TableCaption };
