import * as React from "react";

import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
    return (
        <input
            type={type}
            data-slot="input"
            className={cn(
                "border-input bg-card text-foreground placeholder:text-muted-foreground flex h-10 w-full min-w-0 rounded-md border px-3 py-2 text-sm transition-colors",
                "focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:outline-none",
                "disabled:cursor-not-allowed disabled:opacity-50",
                "aria-invalid:border-bad aria-invalid:ring-bad/20",
                className
            )}
            {...props}
        />
    );
}

export { Input };
