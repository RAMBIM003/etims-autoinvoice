"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BellIcon, LogOutIcon, SearchIcon } from "lucide-react";

import { ThemeToggle } from "@/components/theme-toggle";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { clearToken } from "@/lib/api";
import type { NavItem } from "@/lib/nav";

export type Notice = { id: string; title: string; detail: string; tone: "ok" | "warn" | "bad" };

/* "Otieno Logistics Ltd" -> "OL"; one word gives its first two letters. */
function initials(name: string) {
    const words = name.trim().split(/\s+/).filter(Boolean);
    const letters = words.length > 1 ? words[0][0] + words[1][0] : (words[0] ?? "").slice(0, 2);

    return letters.toUpperCase() || "?";
}

export function SiteHeader({
    searchPlaceholder,
    notices = [],
    accountName,
    accountItems,
}: {
    searchPlaceholder: string;
    notices?: Notice[];
    accountName: string;
    accountItems: NavItem[];
}) {
    const [query, setQuery] = React.useState("");
    const router = useRouter();

    function signOut() {
        clearToken();
        router.push("/sign-in");
    }

    return (
        <header className="bg-card sticky top-0 z-30 flex items-center gap-2 border-b px-3 py-2.5 sm:gap-3 sm:px-6">
            <SidebarTrigger />

            <form
                role="search"
                className="relative hidden min-w-0 flex-1 sm:block sm:max-w-md"
                onSubmit={(e) => e.preventDefault()}
            >
                <SearchIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={searchPlaceholder}
                    aria-label={searchPlaceholder}
                    className="bg-muted pl-9"
                />
            </form>

            <div className="ml-auto flex shrink-0 items-center gap-2">
                <ThemeToggle />

                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="icon" className="relative" aria-label="Notifications">
                            <BellIcon />
                            {notices.length ? (
                                <span className="bg-primary text-primary-foreground border-card absolute -top-1 -right-1 grid size-[18px] place-items-center rounded-full border-2 text-[10px] font-bold">
                                    {notices.length}
                                </span>
                            ) : null}
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-80 max-w-[calc(100vw-1.5rem)]">
                        <DropdownMenuLabel>Notifications</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {notices.length ? (
                            notices.map((notice) => (
                                <DropdownMenuItem key={notice.id} className="items-start gap-2.5">
                                    <Badge variant={notice.tone} dot className="mt-0.5 shrink-0" />
                                    <span className="min-w-0">
                                        <span className="block text-[13px] font-bold">{notice.title}</span>
                                        <span className="text-muted-foreground block text-xs leading-snug text-wrap">
                                            {notice.detail}
                                        </span>
                                    </span>
                                </DropdownMenuItem>
                            ))
                        ) : (
                            <p className="text-muted-foreground px-2.5 py-6 text-center text-sm">
                                Nothing needs your attention.
                            </p>
                        )}
                    </DropdownMenuContent>
                </DropdownMenu>

                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="icon" className="p-0" aria-label="Account menu">
                            <Avatar className="size-full rounded-[inherit]">
                                <AvatarFallback className="rounded-[inherit]">{initials(accountName)}</AvatarFallback>
                            </Avatar>
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                        <DropdownMenuLabel className="truncate">{accountName}</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {accountItems.map((item) => (
                            <DropdownMenuItem key={item.href} asChild>
                                <Link href={item.href}>
                                    <item.icon />
                                    {item.label}
                                </Link>
                            </DropdownMenuItem>
                        ))}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem variant="destructive" onSelect={signOut}>
                            <LogOutIcon />
                            Sign out
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </header>
    );
}
