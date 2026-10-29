import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
    "inline-flex w-fit shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[10.5px] font-bold tracking-wide [&>svg]:size-3",
    {
        variants: {
            variant: {
                default: "bg-secondary text-secondary-foreground",
                primary: "bg-primary text-primary-foreground",
                ok: "bg-ok-soft text-ok",
                warn: "bg-warn-soft text-warn",
                bad: "bg-bad-soft text-bad",
                info: "bg-info-soft text-info",
                outline: "border text-muted-foreground",
            },
        },
        defaultVariants: { variant: "default" },
    }
);

function Badge({
    className,
    variant,
    asChild = false,
    dot = false,
    children,
    ...props
}: React.ComponentProps<"span"> &
    VariantProps<typeof badgeVariants> & { asChild?: boolean; dot?: boolean }) {
    const Comp = asChild ? Slot : "span";

    return (
        <Comp data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props}>
            {dot ? <span aria-hidden className="size-1.5 rounded-full bg-current" /> : null}
            {children}
        </Comp>
    );
}

export { Badge, badgeVariants };
