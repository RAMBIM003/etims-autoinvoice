"use client";

import * as React from "react";
import { ChevronDown, MessageCircle, Search, X } from "lucide-react";

import { cn } from "@/lib/utils";

type Audience = "Merchant" | "Buyer";
type Tab = "home" | "messages" | "help";

/* Answers are fixed text for now. The Messages tab is a placeholder until support
   conversations are connected to the backend. */
const FAQS: Record<Audience, { question: string; answer: string }[]> = {
    Merchant: [
        {
            question: "How do I connect my business?",
            answer: "Open Connections and enter your KRA PIN and branch. Once it shows as connected, you can issue receipts.",
        },
        {
            question: "How do I register an item with KRA?",
            answer: "Open Items and click Register on the item. Each item gets its own KRA code and tax rate.",
        },
        {
            question: "Why is an invoice still pending?",
            answer: "An invoice waits until the payment is confirmed and KRA accepts it. Open the invoice to see the reason.",
        },
        {
            question: "How do buyers get their receipt?",
            answer: "Once the invoice is issued, the buyer gets an SMS with a link to their receipt.",
        },
        {
            question: "How do I remove an item?",
            answer: "Click the trash icon on the item. It leaves your list, but past sales keep their details.",
        },
    ],
    Buyer: [
        {
            question: "Where is my receipt?",
            answer: "Open Receipts in the menu. Your receipt also arrives by SMS once the payment is processed.",
        },
        {
            question: "Why didn't I get an SMS?",
            answer: "The SMS goes to the number linked to your account. Check that your phone number is correct in your profile.",
        },
        {
            question: "How do I see my purchases?",
            answer: "Open My purchases to see every order and whether its receipt is ready.",
        },
    ],
};

export function SupportChat({ audience }: { audience: Audience }) {
    const [open, setOpen] = React.useState(false);
    const [tab, setTab] = React.useState<Tab>("home");
    const [query, setQuery] = React.useState("");
    const [openIndex, setOpenIndex] = React.useState<number | null>(null);

    const needle = query.trim().toLowerCase();
    const matches = FAQS[audience].filter((faq) =>
        `${faq.question} ${faq.answer}`.toLowerCase().includes(needle)
    );

    return (
        <div className="fixed right-4 bottom-4 z-50 flex flex-col items-end gap-3">
            {open ? (
                <div
                    role="dialog"
                    aria-label="Support"
                    className="bg-card text-card-foreground flex h-[480px] w-[min(340px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border shadow-xl"
                >
                    <div className="bg-primary text-primary-foreground flex items-start justify-between p-4">
                        <div>
                            <p className="text-base font-semibold">Hi there</p>
                            <p className="text-sm opacity-90">How can we help?</p>
                        </div>
                        <button
                            type="button"
                            aria-label="Close support"
                            onClick={() => setOpen(false)}
                            className="rounded-md p-1 hover:bg-white/10"
                        >
                            <X className="size-5" />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4">
                        {tab === "home" ? (
                            <div className="grid gap-3">
                                <button
                                    type="button"
                                    onClick={() => setTab("help")}
                                    className="hover:bg-muted rounded-xl border p-3 text-left"
                                >
                                    <p className="font-medium">Browse common questions</p>
                                    <p className="text-muted-foreground text-sm">Quick answers, searchable.</p>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setTab("messages")}
                                    className="hover:bg-muted rounded-xl border p-3 text-left"
                                >
                                    <p className="font-medium">Send us a message</p>
                                    <p className="text-muted-foreground text-sm">Our support team will reply here.</p>
                                </button>
                            </div>
                        ) : null}

                        {tab === "messages" ? (
                            <div className="text-muted-foreground grid place-items-center gap-2 py-10 text-center text-sm">
                                <MessageCircle className="size-8 opacity-50" />
                                <p>Messaging with support is coming soon.</p>
                                <p>For now, check the Help tab for quick answers.</p>
                            </div>
                        ) : null}

                        {tab === "help" ? (
                            <div className="grid gap-3">
                                <label className="relative block">
                                    <Search className="text-muted-foreground absolute top-2.5 left-3 size-4" />
                                    <input
                                        value={query}
                                        onChange={(event) => {
                                            setQuery(event.target.value);
                                            setOpenIndex(null);
                                        }}
                                        placeholder="Search questions"
                                        className="bg-background focus-visible:ring-ring w-full rounded-lg border py-2 pr-3 pl-9 text-sm outline-none focus-visible:ring-2"
                                    />
                                </label>

                                {matches.length === 0 ? (
                                    <p className="text-muted-foreground text-sm">No matching questions. Try different words.</p>
                                ) : null}

                                <ul className="grid gap-2">
                                    {matches.map((faq, index) => {
                                        const isOpen = openIndex === index;
                                        return (
                                            <li key={faq.question} className="rounded-lg border">
                                                <button
                                                    type="button"
                                                    aria-expanded={isOpen}
                                                    onClick={() => setOpenIndex(isOpen ? null : index)}
                                                    className="flex w-full items-center justify-between gap-2 p-3 text-left text-sm font-medium"
                                                >
                                                    {faq.question}
                                                    <ChevronDown
                                                        className={cn("text-muted-foreground size-4 shrink-0 transition-transform", isOpen && "rotate-180")}
                                                    />
                                                </button>
                                                {isOpen ? (
                                                    <p className="text-muted-foreground border-t px-3 py-2 text-sm leading-relaxed">
                                                        {faq.answer}
                                                    </p>
                                                ) : null}
                                            </li>
                                        );
                                    })}
                                </ul>
                            </div>
                        ) : null}
                    </div>

                    <nav className="grid grid-cols-3 border-t text-sm">
                        {(["home", "messages", "help"] as Tab[]).map((name) => (
                            <button
                                key={name}
                                type="button"
                                onClick={() => setTab(name)}
                                className={cn(
                                    "py-3 font-medium capitalize",
                                    tab === name ? "text-primary" : "text-muted-foreground hover:text-foreground"
                                )}
                            >
                                {name}
                            </button>
                        ))}
                    </nav>
                </div>
            ) : null}

            <button
                type="button"
                aria-label={open ? "Close support" : "Open support"}
                onClick={() => setOpen((value) => !value)}
                className="bg-primary text-primary-foreground grid size-14 place-items-center rounded-full shadow-lg"
            >
                {open ? <X className="size-6" /> : <MessageCircle className="size-6" />}
            </button>
        </div>
    );
}
