"use client";

import * as React from "react";
import Link from "next/link";
import { MenuIcon } from "lucide-react";

import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const LINKS = [
    { href: "#how", label: "How it works" },
    { href: "#explore", label: "Explore" },
    { href: "#features", label: "Features" },
    { href: "#contact", label: "Contact" },
];

export function SiteNav() {
    return (
        <header className="sticky top-0 z-40 px-3 pt-3 sm:px-6">
            <div className="bg-card/90 mx-auto flex h-14 max-w-5xl items-center gap-4 rounded-2xl border px-3 shadow-sm backdrop-blur">
                <Link href="/" className="font-display flex items-center gap-2.5 text-base font-extrabold">
                    <span className="bg-primary text-primary-foreground grid size-8 place-items-center rounded-lg">e</span>
                    <span className="hidden sm:inline">eTIMS AutoInvoice</span>
                </Link>

                <nav className="mx-auto hidden items-center gap-1 lg:flex">
                    {LINKS.map((link) => (
                        <a
                            key={link.href}
                            href={link.href}
                            className="hover:bg-secondary rounded-md px-3 py-1.5 text-sm font-semibold transition-colors"
                        >
                            {link.label}
                        </a>
                    ))}
                </nav>

                <div className="ml-auto flex items-center gap-2 lg:ml-0">
                    <ThemeToggle />
                    <Button asChild variant="outline" size="sm" className="hidden sm:inline-flex">
                        <Link href="/sign-in">Sign in</Link>
                    </Button>
                    <Button asChild size="sm">
                        <Link href="/sign-up">Register</Link>
                    </Button>
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
        <footer id="contact" className="bg-band text-band-muted mt-16 px-4 py-12 sm:px-6">
            <div className="mx-auto grid max-w-5xl gap-8 sm:grid-cols-2 lg:grid-cols-4">
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
            <p className="border-sidebar-border mx-auto mt-8 max-w-5xl border-t pt-5 text-center text-sm">
                © {new Date().getFullYear()} eTIMS AutoInvoice. All rights reserved.
            </p>
        </footer>
    );
}
