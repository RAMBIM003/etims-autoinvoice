import Link from "next/link";
import {
    ArrowRightIcon,
    BellRingIcon,
    CheckIcon,
    GaugeIcon,
    PlugZapIcon,
} from "lucide-react";

import { SiteFooter, SiteNav } from "@/components/site-chrome";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const STEPS = [
    { title: "Create and connect", body: "Register your business and connect your M-Pesa channel and KRA eTIMS/OSCU." },
    { title: "Order and pay", body: "A customer places an order and pays through your M-Pesa PayBill." },
    { title: "Match and fiscalize", body: "The payment is matched to its order and sent to KRA through your eTIMS integration." },
    { title: "Receipt delivered", body: "The customer gets an SMS with a link to their digital receipt." },
];

const FEATURES = [
    {
        icon: PlugZapIcon,
        title: "Connect and automate",
        points: ["M-Pesa payment integration", "KRA eTIMS / OSCU connection", "Business configuration"],
        end: "Everything connected, one workflow.",
    },
    {
        icon: GaugeIcon,
        title: "Track and fiscalize",
        points: ["Payment and order tracking", "eTIMS status per invoice", "Exception tracking"],
        end: "Full visibility, no surprises.",
    },
    {
        icon: BellRingIcon,
        title: "Pay and receive",
        points: ["M-Pesa payment confirmation", "Automated eTIMS invoicing", "SMS receipt delivery"],
        end: "From payment to receipt, automatically.",
    },
];

const WITHOUT = ["Customer pays", "Merchant checks M-Pesa", "Finds the order", "Creates the invoice", "Handles eTIMS", "Sends the receipt"];
const WITH = ["M-Pesa payment", "Order match", "KRA eTIMS", "Fiscal receipt", "SMS link to the buyer"];

export default function LandingPage() {
    return (
        <>
            <SiteNav />

            <main>
                {/* Hero */}
                <section className="mx-auto grid max-w-5xl gap-8 px-4 pt-12 pb-10 sm:px-6 lg:grid-cols-[1.2fr_1fr] lg:items-center">
                    <div>
                        <span className="bg-primary-soft text-primary inline-block rounded-full px-3 py-1 text-xs font-bold">
                            M-Pesa → eTIMS → Digital receipt
                        </span>
                        <h1 className="mt-4 text-4xl leading-[1.05] font-extrabold sm:text-5xl">
                            Payments in. Invoices out. <span className="text-primary">Automatically.</span>
                        </h1>
                        <p className="text-muted-foreground mt-4 max-w-xl text-base leading-relaxed">
                            Connect customer M-Pesa payments, orders and KRA eTIMS invoicing in one workflow, and
                            send digital receipts by SMS.
                        </p>
                        <div className="mt-6 flex flex-wrap gap-3">
                            <Button asChild size="lg">
                                <Link href="/sign-up">Create your account <ArrowRightIcon /></Link>
                            </Button>
                            <Button asChild size="lg" variant="outline">
                                <a href="#how">See how it works</a>
                            </Button>
                        </div>
                    </div>

                    {/* A worked example, in the app's own vocabulary. */}
                    <Card className="bg-band text-band-foreground relative overflow-hidden border-0 p-6">
                        <span
                            aria-hidden
                            className="pointer-events-none absolute inset-y-0 right-0 w-1/3 bg-[linear-gradient(115deg,transparent_52%,var(--primary)_52%,var(--primary)_58%,transparent_58%,transparent_74%,var(--primary)_74%,var(--primary)_79%,transparent_79%)] opacity-30"
                        />
                        <p className="text-band-muted relative text-[11px] font-semibold tracking-[0.08em] uppercase">
                            Example payment
                        </p>
                        <p className="tabular font-display relative mt-1 text-3xl font-extrabold">KSh 3,000</p>
                        <ul className="relative mt-4 grid gap-2.5">
                            {["Payment received", "Order matched", "eTIMS invoice signed", "Receipt sent by SMS"].map((line) => (
                                <li key={line} className="flex items-center gap-2.5 text-sm">
                                    <span className="bg-ok-soft text-ok grid size-5 shrink-0 place-items-center rounded-full">
                                        <CheckIcon className="size-3" strokeWidth={3} />
                                    </span>
                                    {line}
                                </li>
                            ))}
                        </ul>
                    </Card>
                </section>

                {/* How it works. Numbered because the order is the point. */}
                <section id="how" className="mx-auto max-w-5xl scroll-mt-20 px-4 py-12 sm:px-6">
                    <h2 className="text-2xl font-extrabold sm:text-3xl">Four steps, from payment to receipt</h2>
                    <p className="text-muted-foreground mt-2">
                        Every payment follows the same connected path to a fiscal receipt.
                    </p>
                    <ol className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        {STEPS.map((step, index) => (
                            <li key={step.title}>
                                <Card className="h-full p-5">
                                    <span className="bg-primary text-primary-foreground tabular grid size-8 place-items-center rounded-lg text-sm font-extrabold">
                                        {index + 1}
                                    </span>
                                    <h3 className="mt-3 text-base font-bold">{step.title}</h3>
                                    <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed">{step.body}</p>
                                </Card>
                            </li>
                        ))}
                    </ol>
                </section>

                {/* Before and after */}
                <section id="explore" className="mx-auto max-w-5xl scroll-mt-20 px-4 py-12 sm:px-6">
                    <h2 className="text-2xl font-extrabold sm:text-3xl">
                        From disconnected steps to one connected flow
                    </h2>
                    <p className="text-muted-foreground mt-2">
                        Today merchants check M-Pesa by hand, find the order, and raise the invoice themselves.
                    </p>
                    <div className="mt-7 grid gap-4 lg:grid-cols-2">
                        <Card className="p-6">
                            <h3 className="text-muted-foreground text-sm font-bold tracking-wide uppercase">
                                Without automation
                            </h3>
                            <ol className="mt-4 grid gap-2">
                                {WITHOUT.map((line, i) => (
                                    <li key={line} className="text-muted-foreground flex items-center gap-3 text-sm">
                                        <span className="bg-secondary tabular grid size-6 shrink-0 place-items-center rounded-md text-xs font-bold">
                                            {i + 1}
                                        </span>
                                        {line}
                                    </li>
                                ))}
                            </ol>
                        </Card>
                        <Card className="border-primary/40 p-6">
                            <h3 className="text-primary text-sm font-bold tracking-wide uppercase">
                                With eTIMS AutoInvoice
                            </h3>
                            <ol className="mt-4 grid gap-2">
                                {WITH.map((line) => (
                                    <li key={line} className="flex items-center gap-3 text-sm font-medium">
                                        <span className="bg-primary-soft text-primary grid size-6 shrink-0 place-items-center rounded-md">
                                            <CheckIcon className="size-3.5" strokeWidth={3} />
                                        </span>
                                        {line}
                                    </li>
                                ))}
                            </ol>
                        </Card>
                    </div>
                </section>

                {/* Features */}
                <section id="features" className="mx-auto max-w-5xl scroll-mt-20 px-4 py-12 sm:px-6">
                    <h2 className="text-2xl font-extrabold sm:text-3xl">What you get</h2>
                    <p className="text-muted-foreground mt-2">
                        Three capabilities that take a payment all the way to a receipt.
                    </p>
                    <div className="mt-7 grid gap-4 lg:grid-cols-3">
                        {FEATURES.map((feature) => (
                            <Card key={feature.title} className="flex h-full flex-col p-6">
                                <span className="bg-primary-soft text-primary grid size-11 place-items-center rounded-xl">
                                    <feature.icon className="size-5" />
                                </span>
                                <h3 className="mt-3 text-base font-bold">{feature.title}</h3>
                                <ul className="mt-3 grid gap-2">
                                    {feature.points.map((point) => (
                                        <li key={point} className="text-muted-foreground flex items-center gap-2.5 text-sm">
                                            <span className="bg-primary size-1.5 shrink-0 rounded-full" aria-hidden />
                                            {point}
                                        </li>
                                    ))}
                                </ul>
                                <p className="mt-auto pt-4 text-sm font-semibold">{feature.end}</p>
                            </Card>
                        ))}
                    </div>
                </section>

                {/* Close */}
                <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
                    <Card className="bg-band text-band-foreground relative overflow-hidden border-0 px-6 py-10 text-center">
                        <span
                            aria-hidden
                            className="pointer-events-none absolute inset-y-0 right-0 w-1/4 bg-[linear-gradient(115deg,transparent_52%,var(--primary)_52%,var(--primary)_58%,transparent_58%)] opacity-40"
                        />
                        <h2 className="relative text-2xl font-extrabold sm:text-3xl">
                            Ready to simplify your invoicing?
                        </h2>
                        <p className="text-band-muted relative mt-2">
                            Connect payments, orders and eTIMS in one place.
                        </p>
                        <Button asChild size="lg" className="relative mt-6">
                            <Link href="/sign-up">Create your account <ArrowRightIcon /></Link>
                        </Button>
                    </Card>
                </section>
            </main>

            <SiteFooter />
        </>
    );
}
