import Link from "next/link";

import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex min-h-svh flex-col">
            <header className="flex items-center gap-3 px-4 py-3 sm:px-6">
                <Link href="/" className="flex items-center gap-2.5 font-display text-sm font-extrabold">
                    <span className="bg-primary text-primary-foreground grid size-8 place-items-center rounded-lg text-base">
                        e
                    </span>
                    eTIMS AutoInvoice
                </Link>
                <div className="ml-auto flex items-center gap-2">
                    <ThemeToggle />
                    <Button asChild variant="outline" size="sm">
                        <Link href="/">Back to site</Link>
                    </Button>
                </div>
            </header>
            <main className="flex flex-1 items-start justify-center px-4 pb-12 sm:items-center sm:px-6">
                {children}
            </main>
        </div>
    );
}
