"use client";

import * as React from "react";
import Link from "next/link";
import { MenuIcon, UserPlusIcon } from "lucide-react";

import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const LINKS = [
    { href: "#how", label: "How it works" },
    { href: "#explore", label: "Explore" },
    { href: "#features", label: "Features" },
    { href: "#contact", label: "Contact" },
];

export function SiteNav() {
    const [scrolled, setScrolled] = React.useState(false);

    /* Flat over the hero, lifted onto a card once the page moves under it. */
    React.useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 8);

        onScroll();
        window.addEventListener("scroll", onScroll, { passive: true });

        return () => window.removeEventListener("scroll", onScroll);
    }, []);

    return (
        <header
            className={cn(
                "sticky top-0 z-40 transition-[background-color,box-shadow,border-color] duration-300",
                scrolled ? "bg-card/90 border-b shadow-[0_8px_30px_rgba(15,23,42,0.06)] backdrop-blur" : "border-b border-transparent"
            )}
        >
            <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 sm:h-20 sm:px-6">
                <Link href="/" className="font-display flex items-center gap-2.5 text-lg font-extrabold tracking-tight">
                    <span className="grid size-9 place-items-center rounded-xl bg-[linear-gradient(135deg,var(--red-600),var(--red-400))] text-lg text-white shadow-[0_6px_16px_-4px_var(--red-400)]">
                        e
                    </span>
                    <span className="hidden sm:inline">eTIMS AutoInvoice</span>
                </Link>

                <nav className="mx-auto hidden items-center gap-8 lg:flex">
                    {LINKS.map((link) => (
                        <a
                            key={link.href}
                            href={link.href}
                            className="font-display hover:text-primary relative py-2 text-[15px] font-bold transition-colors after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:origin-left after:scale-x-0 after:rounded-full after:bg-current after:transition-transform hover:after:scale-x-100"
                        >
                            {link.label}
                        </a>
                    ))}
                </nav>

                <div className="ml-auto flex items-center gap-2 lg:ml-0">
                    <ThemeToggle />
                    <Link
                        href="/sign-in"
                        className="font-display hover:text-primary hidden px-2 text-sm font-bold transition-colors sm:inline"
                    >
                        Sign in
                    </Link>
                    <Link
                        href="/sign-up"
                        className="font-display group flex h-11 items-center gap-2 rounded-full bg-[linear-gradient(90deg,var(--red-600),var(--red-400))] py-1 pr-5 pl-1 text-sm font-bold text-white shadow-[0_10px_24px_-10px_var(--red-500)] transition-transform hover:-translate-y-0.5"
                    >
                        <span className="grid size-9 place-items-center rounded-full bg-white/20">
                            <UserPlusIcon className="size-4" />
                        </span>
                        Register
                    </Link>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="icon-sm" className="lg:hidden" aria-label="Open menu">
                                <MenuIcon />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            {LINKS.map((link) => (
                                <DropdownMenuItem key={link.href} asChild>
                                    <a href={link.href}>{link.label}</a>
                                </DropdownMenuItem>
                            ))}
                            <DropdownMenuItem asChild>
                                <Link href="/sign-in">Sign in</Link>
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>
        </header>
    );
}

export function SiteFooter() {
    return (
        <footer id="contact" className="bg-band text-band-muted relative overflow-hidden px-4 pt-16 pb-10 sm:px-6">
            <div aria-hidden className="pointer-events-none absolute -top-24 -right-24 size-72 rounded-full border-[28px] border-white/[0.04]" />
            <div className="relative mx-auto grid max-w-6xl gap-8 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                    <p className="text-band-foreground font-display font-extrabold">eTIMS AutoInvoice</p>
                    <p className="mt-2 text-sm leading-relaxed">
                        M-Pesa payments to KRA eTIMS invoices, automatically.
                    </p>
                </div>
                <div>
                    <p className="text-band-foreground mb-2 font-bold">Product</p>
                    <ul className="grid gap-1.5 text-sm">
                        <li><a href="#how" className="hover:text-band-foreground">How it works</a></li>
                        <li><a href="#explore" className="hover:text-band-foreground">Explore</a></li>
                        <li><a href="#features" className="hover:text-band-foreground">Features</a></li>
                    </ul>
                </div>
                <div>
                    <p className="text-band-foreground mb-2 font-bold">Support</p>
                    <ul className="grid gap-1.5 text-sm">
                        <li><Link href="/sign-in" className="hover:text-band-foreground">Sign in</Link></li>
                        <li><Link href="/simulator" className="hover:text-band-foreground">Payment simulator</Link></li>
                    </ul>
                </div>
                <div>
                    <p className="text-band-foreground mb-2 font-bold">Contact</p>
                    <p className="text-sm leading-relaxed">
                        support@example.com
                        <br />
                        +254 700 000 000
                        <br />
                        Nairobi, Kenya
                    </p>
                </div>
            </div>
            <p className="border-sidebar-border relative mx-auto mt-10 max-w-6xl border-t pt-6 text-center text-sm">
                © {new Date().getFullYear()} eTIMS AutoInvoice. All rights reserved.
                <span className="mt-1 block text-xs opacity-70">
                    Photos by{" "}
                    <a href="https://unsplash.com/photos/5dFuO02OHh0" className="hover:text-band-foreground underline-offset-2 hover:underline">
                        Ali Mkumbwa
                    </a>{" "}
                    and{" "}
                    <a href="https://unsplash.com/photos/uZYZOBH-sK8" className="hover:text-band-foreground underline-offset-2 hover:underline">
                        Photos By Beks
                    </a>{" "}
                    on Unsplash
                </span>
            </p>
        </footer>
    );
}
