"use client";

import { MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";

/**
 * Follows the device until someone presses it, then the choice is remembered.
 *
 * Which glyph shows is decided by CSS from the `dark` class on <html>, not by
 * React state, so there is nothing to hydrate and no flash of the wrong icon.
 */
export function ThemeToggle({ className }: { className?: string }) {
    const { resolvedTheme, setTheme } = useTheme();

    return (
        <Button
            variant="outline"
            size="icon"
            className={className}
            aria-label="Switch between light and dark mode"
            title="Switch between light and dark mode"
            onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
        >
            <MoonIcon className="dark:hidden" />
            <SunIcon className="hidden dark:block" />
        </Button>
    );
}
