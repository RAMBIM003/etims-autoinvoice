"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
    { href: "/merchant/logs", label: "Errors" },
    { href: "/merchant/logs/tables", label: "Tables" },
];

/* Switches between the Errors list and the read-only table views. */
export function LogsTabs() {
    const path = usePathname();

    return (
        <div className="bg-muted flex w-fit gap-1 rounded-lg p-1">
            {TABS.map((tab) => {
                const active = path === tab.href;

                return (
                    <Link
                        key={tab.href}
                        href={tab.href}
                        className={`rounded-md px-4 py-1.5 text-sm font-semibold ${
                            active ? "bg-background shadow-sm" : "text-muted-foreground"
                        }`}
                    >
                        {tab.label}
                    </Link>
                );
            })}
        </div>
    );
}
