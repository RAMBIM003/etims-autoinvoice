"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LifeBuoyIcon, StoreIcon, UserRoundIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupLabel,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarRail,
    SidebarSeparator,
    useSidebar,
} from "@/components/ui/sidebar";
import type { NavItem } from "@/lib/nav";
import { cn } from "@/lib/utils";

/** Splits nav items into sections, keeping their order. Items with no group sit under the audience heading. */
function sectionsOf(items: NavItem[], audience: string) {
    const sections: { label: string; items: NavItem[] }[] = [];

    for (const item of items) {
        const label = item.group ?? audience;
        const existing = sections.find((s) => s.label === label);

        if (existing) existing.items.push(item);
        else sections.push({ label, items: [item] });
    }

    return sections;
}

export function AppSidebar({
    items,
    audience,
    accountName,
    accountStatus,
}: {
    items: NavItem[];
    audience: "Merchant" | "Buyer";
    accountName: string;
    accountStatus: { label: string; connected: boolean };
    systemNote?: string;
}) {
    const pathname = usePathname();
    const { state, isMobile, setOpenMobile } = useSidebar();
    const collapsed = state === "collapsed";

    const AudienceIcon = audience === "Merchant" ? StoreIcon : UserRoundIcon;
    const sections = sectionsOf(items, audience);

    return (
        <Sidebar collapsible="icon">
            <SidebarHeader>
                <Link
                    href={items[0]?.href ?? "/"}
                    className="flex items-center gap-2.5 rounded-lg px-1 py-1 text-white outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
                >
                    <span className="bg-primary grid size-8 shrink-0 place-items-center rounded-lg font-display text-base font-extrabold text-white">
                        e
                    </span>
                    <span
                        className={cn(
                            "font-display truncate text-sm font-extrabold tracking-tight transition-opacity",
                            collapsed && "md:hidden"
                        )}
                    >
                        eTIMS AutoInvoice
                    </span>
                </Link>

                {/* Whose account this is, and whether KRA will accept an invoice from it. */}
                <div
                    className={cn(
                        "bg-sidebar-accent border-sidebar-border flex items-center gap-2.5 rounded-xl border p-2.5",
                        collapsed && "md:justify-center md:p-1.5"
                    )}
                >
                    <span className="bg-sidebar-accent grid size-8 shrink-0 place-items-center rounded-lg text-white">
                        <AudienceIcon className="size-4" />
                    </span>
                    <div className={cn("min-w-0", collapsed && "md:hidden")}>
                        <p className="truncate text-[13px] font-bold text-white">{accountName}</p>
                        <Badge
                            variant={accountStatus.connected ? "ok" : "bad"}
                            className="mt-0.5 px-2 py-0 text-[10px]"
                        >
                            {accountStatus.label}
                        </Badge>
                    </div>
                </div>
            </SidebarHeader>

            <SidebarContent>
                {sections.map((section) => (
                    <SidebarGroup key={section.label}>
                        <SidebarGroupLabel>{section.label}</SidebarGroupLabel>
                        <SidebarMenu>
                            {section.items.map((item) => {
                                const active =
                                    pathname === item.href ||
                                    (item.href !== items[0]?.href && pathname.startsWith(`${item.href}/`));

                                return (
                                    <SidebarMenuItem key={item.href}>
                                        <SidebarMenuButton asChild isActive={active} tooltip={item.label}>
                                            <Link
                                                href={item.href}
                                                onClick={() => {
                                                    if (isMobile) setOpenMobile(false);
                                                }}
                                            >
                                                <item.icon />
                                                <span>{item.label}</span>
                                            </Link>
                                        </SidebarMenuButton>
                                    </SidebarMenuItem>
                                );
                            })}
                        </SidebarMenu>
                    </SidebarGroup>
                ))}
            </SidebarContent>

            <SidebarFooter>
                <SidebarSeparator />

                {/* Support is an icon only; the label is kept for screen readers and the tooltip. */}
                <div className={cn("flex", collapsed ? "justify-center" : "justify-end")}>
                    <Button asChild variant="ghost" size="icon" aria-label="Contact support" title="Contact support">
                        <a href="mailto:support@example.com">
                            <LifeBuoyIcon />
                        </a>
                    </Button>
                </div>
            </SidebarFooter>

            <SidebarRail />
        </Sidebar>
    );
}
