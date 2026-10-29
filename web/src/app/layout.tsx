import type { Metadata, Viewport } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";

import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";

import "./globals.css";

const inter = Inter({
    variable: "--font-inter",
    subsets: ["latin"],
    display: "swap",
});

const jakarta = Plus_Jakarta_Sans({
    variable: "--font-jakarta",
    subsets: ["latin"],
    weight: ["600", "700", "800"],
    display: "swap",
});

export const metadata: Metadata = {
    title: {
        default: "eTIMS AutoInvoice",
        template: "%s · eTIMS AutoInvoice",
    },
    description:
        "M-Pesa payments matched to orders, fiscalized with KRA eTIMS, and delivered to the buyer as a digital receipt.",
};

export const viewport: Viewport = {
    /* Light is the default, so the browser chrome matches the light canvas.
       A viewer who switches to dark keeps this; it only tints the URL bar. */
    themeColor: "#f4f5f8",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en" suppressHydrationWarning>
            <body className={`${inter.variable} ${jakarta.variable} font-sans`}>
                <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} disableTransitionOnChange>
                    {children}
                    <Toaster />
                </ThemeProvider>
            </body>
        </html>
    );
}
