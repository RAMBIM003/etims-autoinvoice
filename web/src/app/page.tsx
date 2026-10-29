import Image from "next/image";
import Link from "next/link";
import {
    ArrowRightIcon,
    BadgeCheckIcon,
    BellRingIcon,
    CheckIcon,
    ClipboardListIcon,
    FileCheck2Icon,
    GaugeIcon,
    HandCoinsIcon,
    MessageSquareTextIcon,
    PlayIcon,
    PlugZapIcon,
    ReceiptTextIcon,
    SmartphoneIcon,
    StoreIcon,
    WorkflowIcon,
    XIcon,
} from "lucide-react";

import { SiteFooter, SiteNav } from "@/components/site-chrome";
import { cn } from "@/lib/utils";

const STEPS = [
    { icon: StoreIcon, title: "Create and connect", body: "Register your business and connect your M-Pesa channel and KRA eTIMS/OSCU." },
    { icon: SmartphoneIcon, title: "Order and pay", body: "A customer places an order and pays through your M-Pesa PayBill." },
    { icon: WorkflowIcon, title: "Match and fiscalize", body: "The payment is matched to its order and sent to KRA through your eTIMS integration." },
    { icon: MessageSquareTextIcon, title: "Receipt delivered", body: "The customer gets an SMS with a link to their digital receipt." },
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
const WITH = [
    { icon: HandCoinsIcon, label: "M-Pesa payment" },
    { icon: ClipboardListIcon, label: "Order match" },
    { icon: BadgeCheckIcon, label: "KRA eTIMS" },
    { icon: ReceiptTextIcon, label: "Fiscal receipt" },
    { icon: MessageSquareTextIcon, label: "SMS link to the buyer" },
];

/* Figures read straight off the content above, not marketing claims. */
const FIGURES = [
    { icon: WorkflowIcon, value: STEPS.length, label: "Steps from payment to receipt" },
    { icon: FileCheck2Icon, value: WITH.length, label: "Stages handled for you" },
    { icon: ClipboardListIcon, value: WITHOUT.length, label: "Manual tasks taken off your desk" },
    { icon: PlugZapIcon, value: 1, label: "Connected workflow" },
];

/* Organic shapes, drawn once and reused at different sizes and turns. */
const BLOB = "M421 63c58 41 92 116 85 186s-55 135-120 167-146 30-207 0S73 330 50 266 33 125 84 74 214 0 287 3s76 19 134 60Z";
const BLOB_SOFT = "M398 74c48 47 70 120 55 186s-67 126-139 142-155-12-200-62S54 222 74 156 154 34 226 21s124 6 172 53Z";
const CORNER = "M200 0v200H0c18-62 61-92 112-104S190 46 200 0Z";

function DotGrid({ className, rows = 5, cols = 6 }: { className?: string; rows?: number; cols?: number }) {
    return (
        <svg aria-hidden className={cn("pointer-events-none", className)} width={cols * 14} height={rows * 14}>
            {Array.from({ length: rows * cols }).map((_, i) => (
                <circle key={i} cx={(i % cols) * 14 + 3} cy={Math.floor(i / cols) * 14 + 3} r={2.2} fill="currentColor" />
            ))}
        </svg>
    );
}

/* Small floating marks, as scattered through the reference layout. */
function Sparkles() {
    return (
        <>
            <span aria-hidden className="landing-float absolute top-16 left-[18%] size-2.5 rounded-full bg-[var(--gold-500)]" />
            <span
                aria-hidden
                className="landing-float absolute top-32 left-[6%] size-0 border-x-[7px] border-t-[11px] border-x-transparent border-t-[var(--red-400)] [animation-delay:-2s]"
            />
            <span aria-hidden className="landing-float absolute right-[12%] bottom-10 size-2 rounded-full bg-[var(--teal-400)] [animation-delay:-4s]" />
        </>
    );
}

function Eyebrow({ children, className }: { children: React.ReactNode; className?: string }) {
    return <p className={cn("font-display text-sm font-bold text-[var(--red-500)] dark:text-[var(--red-400)]", className)}>{children}</p>;
}

/** The reference's pill button: a gradient capsule with its icon in a circle. */
function PillLink({ href, children, icon: Icon = ArrowRightIcon }: { href: string; children: React.ReactNode; icon?: typeof ArrowRightIcon }) {
    return (
        <Link
            href={href}
            className="font-display group inline-flex h-14 items-center gap-3 rounded-full bg-[linear-gradient(90deg,var(--red-600),var(--red-400))] py-1.5 pr-7 pl-1.5 text-[15px] font-bold text-white shadow-[0_16px_32px_-14px_var(--red-500)] transition-transform hover:-translate-y-0.5"
        >
            <span className="grid size-11 place-items-center rounded-full bg-white/20 transition-transform group-hover:translate-x-0.5">
                <Icon className="size-4.5" />
            </span>
            {children}
        </Link>
    );
}

export default function LandingPage() {
    return (
        <>
            <style>{`
                @keyframes landing-float { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-10px) } }
                .landing-float { animation: landing-float 6s ease-in-out infinite; }
                @media (prefers-reduced-motion: reduce) { .landing-float { animation: none; } }
            `}</style>

            <div className="bg-card relative overflow-x-clip">
                {/* The soft wash behind the top-left of the hero */}
                <svg aria-hidden viewBox="0 0 520 480" className="pointer-events-none absolute -top-40 -left-56 w-[640px] text-[var(--red-50)] dark:text-white/[0.03]">
                    <path d={BLOB_SOFT} fill="currentColor" />
                </svg>

                <SiteNav />

                <main>
                    {/* Hero */}
                    <section className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 pt-10 pb-20 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:pt-16 lg:pb-28">
                        <div className="relative">
                            <DotGrid className="mb-6 text-[var(--red-300)] dark:text-[var(--red-400)]/50" rows={4} cols={6} />
                            <Eyebrow>M-Pesa → eTIMS → Digital receipt</Eyebrow>
                            <h1 className="mt-4 text-[44px] leading-[1.02] font-extrabold tracking-[-0.03em] sm:text-6xl lg:text-[68px]">
                                Payments in. Invoices out.{" "}
                                <span className="bg-[linear-gradient(90deg,var(--red-600),var(--red-400))] bg-clip-text text-transparent">
                                    Automatically.
                                </span>
                            </h1>
                            <p className="text-muted-foreground mt-6 max-w-lg text-[17px] leading-relaxed">
                                Connect customer M-Pesa payments, orders and KRA eTIMS invoicing in one workflow, and send digital
                                receipts by SMS.
                            </p>
                            <div className="mt-9 flex flex-wrap items-center gap-5">
                                <a href="#how" className="font-display group flex items-center gap-3 text-[15px] font-bold">
                                    <span className="relative grid size-14 place-items-center rounded-full bg-[linear-gradient(135deg,var(--gold-500),var(--gold-400))] text-white shadow-[0_14px_28px_-12px_var(--gold-500)]">
                                        <span aria-hidden className="absolute inset-0 animate-ping rounded-full bg-[var(--gold-400)] opacity-25 motion-reduce:hidden" />
                                        <PlayIcon className="relative size-5 translate-x-px fill-current" />
                                    </span>
                                    <span className="group-hover:text-primary transition-colors">See how it works</span>
                                </a>
                                <PillLink href="/sign-up">Create your account</PillLink>
                            </div>
                        </div>

                        <HeroVisual />
                    </section>

                    {/* How it works */}
                    <section id="how" className="relative scroll-mt-24 px-4 py-20 sm:px-6 lg:py-28">
                        <div aria-hidden className="pointer-events-none absolute top-10 -left-40 size-[420px] rounded-full border-[48px] border-[var(--red-50)] dark:border-white/[0.03]" />
                        <Sparkles />
                        <div className="relative mx-auto max-w-6xl">
                            <div className="relative mx-auto max-w-2xl text-center">
                                <Eyebrow>How it works?</Eyebrow>
                                <h2 className="mt-3 text-3xl leading-tight font-extrabold tracking-[-0.02em] sm:text-[44px]">
                                    Four steps, from payment to receipt
                                </h2>
                                <p className="text-muted-foreground mt-4">Every payment follows the same connected path to a fiscal receipt.</p>
                                <DotGrid className="absolute top-6 -right-24 hidden text-[var(--red-300)]/70 lg:block" rows={4} cols={6} />
                            </div>

                            <ol className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                                {STEPS.map((step, index) => (
                                    <li
                                        key={step.title}
                                        className="group bg-card relative flex flex-col items-center overflow-hidden border px-6 pt-9 pb-20 text-center transition-[transform,box-shadow] duration-300 hover:-translate-y-1.5 hover:shadow-[0_24px_48px_-24px_rgba(15,23,42,0.25)]"
                                    >
                                        <h3 className="text-[19px] font-extrabold tracking-tight">{step.title}</h3>
                                        <span className="mt-6 grid size-16 place-items-center rounded-2xl bg-[var(--red-50)] text-[var(--red-500)] transition-colors duration-300 group-hover:bg-[var(--red-500)] group-hover:text-white dark:bg-white/5 dark:text-[var(--red-400)]">
                                            <step.icon className="size-7" strokeWidth={1.6} />
                                        </span>
                                        <p className="text-muted-foreground mt-6 text-sm leading-relaxed">{step.body}</p>
                                        {/* The corner blob carries the step number. */}
                                        <svg aria-hidden viewBox="0 0 200 200" className="absolute right-0 bottom-0 w-24 transition-transform duration-300 group-hover:scale-110">
                                            <defs>
                                                <linearGradient id={`corner-${index}`} x1="0" y1="1" x2="1" y2="0">
                                                    <stop offset="0" stopColor="var(--red-600)" />
                                                    <stop offset="1" stopColor="var(--red-400)" />
                                                </linearGradient>
                                            </defs>
                                            <path d={CORNER} fill={`url(#corner-${index})`} />
                                        </svg>
                                        <span className="font-display tabular absolute right-4 bottom-3 text-2xl font-extrabold text-white">
                                            0{index + 1}
                                        </span>
                                    </li>
                                ))}
                            </ol>
                        </div>
                    </section>

                    {/* Explore: the before and after */}
                    <section id="explore" className="relative scroll-mt-24">
                        <div className="bg-secondary/70 relative px-4 pt-20 pb-28 sm:px-6 lg:pt-28 lg:pb-36 dark:bg-white/[0.02]">
                            <div className="relative mx-auto grid max-w-6xl items-center gap-14 lg:grid-cols-2">
                                <FlowVisual />

                                <div>
                                    <DotGrid className="mb-5 text-[var(--red-300)]/80" rows={3} cols={6} />
                                    <Eyebrow>Explore</Eyebrow>
                                    <h2 className="mt-3 text-3xl leading-tight font-extrabold tracking-[-0.02em] sm:text-[42px]">
                                        From disconnected steps to one connected flow
                                    </h2>
                                    <p className="text-muted-foreground mt-4 leading-relaxed">
                                        Today merchants check M-Pesa by hand, find the order, and raise the invoice themselves.
                                    </p>

                                    <div className="mt-9 grid gap-8 sm:grid-cols-2 sm:gap-0">
                                        <div className="sm:pr-8">
                                            <span className="bg-card text-muted-foreground grid size-12 place-items-center rounded-2xl border shadow-sm">
                                                <XIcon className="size-5" />
                                            </span>
                                            <h3 className="mt-4 text-lg font-extrabold">Without automation</h3>
                                            <ol className="mt-3 grid gap-1.5">
                                                {WITHOUT.map((line, i) => (
                                                    <li key={line} className="text-muted-foreground flex gap-2.5 text-sm">
                                                        <span className="tabular w-4 shrink-0 text-xs leading-5 font-bold opacity-60">{i + 1}</span>
                                                        {line}
                                                    </li>
                                                ))}
                                            </ol>
                                        </div>
                                        <div className="sm:border-l sm:border-dashed sm:pl-8">
                                            <span className="grid size-12 place-items-center rounded-2xl bg-[linear-gradient(135deg,var(--red-600),var(--red-400))] text-white shadow-[0_12px_24px_-12px_var(--red-500)]">
                                                <CheckIcon className="size-5" strokeWidth={3} />
                                            </span>
                                            <h3 className="mt-4 text-lg font-extrabold">With eTIMS AutoInvoice</h3>
                                            <ol className="mt-3 grid gap-1.5">
                                                {WITH.map((step) => (
                                                    <li key={step.label} className="flex items-center gap-2.5 text-sm font-medium">
                                                        <CheckIcon className="size-3.5 shrink-0 text-[var(--teal-500)]" strokeWidth={3} />
                                                        {step.label}
                                                    </li>
                                                ))}
                                            </ol>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        {/* The band's curved lower edge */}
                        <svg aria-hidden viewBox="0 0 1440 80" preserveAspectRatio="none" className="text-card -mt-px block h-14 w-full sm:h-20">
                            <path d="M0 80V40C320 -10 640 -10 900 22s420 40 540 18v40Z" fill="currentColor" transform="translate(0 -1)" />
                        </svg>
                    </section>

                    {/* Figures */}
                    <section aria-label="At a glance" className="mx-auto -mt-6 max-w-6xl px-4 pb-20 sm:px-6">
                        <ul className="grid grid-cols-2 gap-y-10 lg:grid-cols-4">
                            {FIGURES.map((figure, i) => (
                                <li key={figure.label} className="relative flex flex-col items-center px-4 text-center">
                                    <figure.icon className="size-8 text-[var(--red-500)] dark:text-[var(--red-400)]" strokeWidth={1.7} />
                                    <p className="font-display tabular mt-3 text-[44px] leading-none font-extrabold tracking-tight">
                                        {figure.value}
                                    </p>
                                    <p className="font-display text-muted-foreground mt-2 max-w-[11rem] text-[15px] leading-snug font-bold">{figure.label}</p>
                                    {i < FIGURES.length - 1 ? (
                                        <span aria-hidden className="absolute top-1/2 -right-1 hidden size-2.5 rounded-full bg-[var(--gold-500)] lg:block" />
                                    ) : null}
                                </li>
                            ))}
                        </ul>
                    </section>

                    {/* Features */}
                    <section id="features" className="relative scroll-mt-24 px-4 py-20 sm:px-6 lg:py-24">
                        <div aria-hidden className="pointer-events-none absolute top-24 -right-48 size-[460px] rounded-full border-[48px] border-[var(--red-50)] dark:border-white/[0.03]" />
                        <div className="relative mx-auto max-w-6xl">
                            <div className="mx-auto max-w-2xl text-center">
                                <Eyebrow>Features</Eyebrow>
                                <h2 className="mt-3 text-3xl leading-tight font-extrabold tracking-[-0.02em] sm:text-[44px]">What you get</h2>
                                <p className="text-muted-foreground mt-4">Three capabilities that take a payment all the way to a receipt.</p>
                            </div>

                            <div className="mt-16 grid gap-10 md:grid-cols-3 md:gap-6 lg:gap-8">
                                {FEATURES.map((feature, i) => {
                                    const featured = i === 1;

                                    return (
                                        <article
                                            key={feature.title}
                                            className={cn(
                                                "bg-card relative flex flex-col items-center px-7 pt-16 pb-10 text-center shadow-[0_20px_50px_-28px_rgba(15,23,42,0.28)] transition-transform duration-300 hover:-translate-y-1.5",
                                                featured && "md:-translate-y-4 md:hover:-translate-y-6"
                                            )}
                                        >
                                            {/* Ribbon tab */}
                                            <div className="absolute -top-4 left-1/2 w-[62%] -translate-x-1/2">
                                                <span
                                                    aria-hidden
                                                    className="absolute top-0 -left-2 size-0 border-r-8 border-b-[16px] border-r-transparent border-b-[var(--red-800)] dark:border-b-black"
                                                />
                                                <p
                                                    className={cn(
                                                        "font-display py-3 text-[13px] font-extrabold tracking-[0.08em] text-white uppercase",
                                                        featured
                                                            ? "bg-[linear-gradient(90deg,var(--band),#2a2f3a)]"
                                                            : "bg-[linear-gradient(90deg,var(--red-600),var(--gold-500))]"
                                                    )}
                                                >
                                                    {feature.title}
                                                </p>
                                            </div>

                                            <span className="relative mt-4 grid size-20 place-items-center">
                                                <span
                                                    aria-hidden
                                                    className={cn(
                                                        "absolute top-0 left-0 size-9 rounded-full",
                                                        featured ? "bg-[var(--teal-400)]" : "bg-[var(--gold-400)]"
                                                    )}
                                                />
                                                <feature.icon className="text-foreground relative size-14" strokeWidth={1.25} />
                                            </span>

                                            <p className="font-display mt-6 text-xl leading-snug font-extrabold tracking-tight">{feature.end}</p>

                                            <ul className="mt-6 grid gap-3">
                                                {feature.points.map((point) => (
                                                    <li key={point} className="text-muted-foreground text-[15px]">
                                                        {point}
                                                    </li>
                                                ))}
                                            </ul>
                                        </article>
                                    );
                                })}
                            </div>
                        </div>
                    </section>

                    {/* Close */}
                    <section className="px-4 pt-6 pb-24 sm:px-6">
                        <div className="bg-band text-band-foreground relative mx-auto max-w-6xl overflow-hidden rounded-[28px] px-6 py-16 text-center sm:px-12">
                            <Image
                                src="/landing/kenya-market.jpg"
                                alt=""
                                fill
                                sizes="(min-width: 1152px) 1152px, 100vw"
                                className="object-cover"
                            />
                            {/* Dark wash in the band colour so the white text keeps its contrast. */}
                            <div aria-hidden className="absolute inset-0 bg-[linear-gradient(100deg,var(--band)_25%,color-mix(in_oklab,var(--band)_78%,transparent))]" />
                            <svg aria-hidden viewBox="0 0 520 480" className="landing-float absolute -top-28 -left-24 w-80 opacity-90">
                                <defs>
                                    <linearGradient id="close-blob" x1="0" y1="0" x2="1" y2="1">
                                        <stop offset="0" stopColor="var(--red-600)" />
                                        <stop offset="1" stopColor="var(--red-400)" />
                                    </linearGradient>
                                </defs>
                                <path d={BLOB} fill="url(#close-blob)" />
                            </svg>
                            <svg aria-hidden viewBox="0 0 520 480" className="landing-float absolute -right-20 -bottom-32 w-72 text-[var(--gold-500)] opacity-90 [animation-delay:-3s]">
                                <path d={BLOB_SOFT} fill="currentColor" />
                            </svg>
                            <DotGrid className="absolute top-8 right-10 text-white/25" rows={4} cols={5} />

                            <div className="relative mx-auto max-w-xl">
                                <h2 className="text-3xl leading-tight font-extrabold tracking-[-0.02em] sm:text-[42px]">Ready to simplify your invoicing?</h2>
                                <p className="text-band-muted mt-4">Connect payments, orders and eTIMS in one place.</p>
                                <div className="mt-9 flex justify-center">
                                    <PillLink href="/sign-up">Create your account</PillLink>
                                </div>
                            </div>
                        </div>
                    </section>
                </main>

                <SiteFooter />
            </div>
        </>
    );
}

/** The hero's right side: a merchant at her stall inside the brand blob, with the example payment as a receipt. */
function HeroVisual() {
    return (
        <div className="relative mx-auto aspect-[52/48] w-full max-w-[560px]">
            <svg viewBox="0 0 520 480" className="absolute inset-0 size-full overflow-visible" role="img" aria-label="A shop owner at her stall, smiling, with her phone in hand">
                <defs>
                    <clipPath id="hero-clip">
                        <path d={BLOB} />
                    </clipPath>
                </defs>
                {/* Outline echo, offset from the main shape */}
                <path d={BLOB} fill="none" stroke="var(--teal-400)" strokeWidth="2.5" transform="translate(-26 -14) rotate(-6 260 240)" />
                <path d={BLOB} fill="var(--red-500)" />
                {/* Framed on her face and phone; the stall's left edge, with phone numbers written on it, stays out of frame. */}
                <image href="/landing/merchant-phone.jpg" x="-237" y="-120" width="900" height="643" preserveAspectRatio="xMidYMid slice" clipPath="url(#hero-clip)" />
                {/* Gold wave over the lower left */}
                <path d="M30 330c40-60 120-80 170-48s70 92 30 140-130 52-180 18S-10 390 30 330Z" fill="var(--gold-500)" opacity="0.95" />
                {/* Teal drop on the lower right */}
                <path d="M430 330c40 6 70 40 60 82s-58 62-96 50-52-52-36-86 32-52 72-46Z" fill="var(--teal-400)" opacity="0.9" />
            </svg>
            <DotGrid className="absolute top-[4%] left-[4%] text-[var(--red-300)]" rows={4} cols={5} />

            {/* Receipt card, overlapping the photo's lower left edge */}
            <div aria-hidden className="landing-float absolute bottom-[0%] -left-[4%] w-[50%] -rotate-3 sm:-left-[16%] sm:w-[46%]">
                <div className="bg-card text-card-foreground rounded-2xl p-4 shadow-[0_30px_60px_-20px_rgba(15,23,42,0.45)] sm:p-5">
                    <div className="flex items-center justify-between">
                        <p className="text-muted-foreground text-[10px] font-bold tracking-[0.1em] uppercase sm:text-[11px]">Example payment</p>
                        <span className="grid size-6 place-items-center rounded-lg bg-[linear-gradient(135deg,var(--red-600),var(--red-400))] text-[11px] font-extrabold text-white">
                            e
                        </span>
                    </div>
                    <p className="tabular font-display mt-1 text-2xl font-extrabold tracking-tight sm:text-3xl">KSh 3,000</p>
                    <ul className="mt-3 grid gap-2 border-t border-dashed pt-3">
                        {["Payment received", "Order matched", "eTIMS invoice signed", "Receipt sent by SMS"].map((line) => (
                            <li key={line} className="flex items-center gap-2 text-[11px] font-medium sm:text-[13px]">
                                <span className="bg-ok-soft text-ok grid size-4.5 shrink-0 place-items-center rounded-full">
                                    <CheckIcon className="size-2.5" strokeWidth={3} />
                                </span>
                                {line}
                            </li>
                        ))}
                    </ul>
                </div>
            </div>

            {/* Floating chips */}
            <div aria-hidden className="landing-float bg-card absolute top-[8%] right-[0%] flex items-center gap-2 rounded-full py-1.5 pr-4 pl-1.5 shadow-[0_16px_32px_-14px_rgba(15,23,42,0.4)] [animation-delay:-2s]">
                <span className="grid size-8 place-items-center rounded-full bg-[var(--gold-500)] text-white">
                    <SmartphoneIcon className="size-4" />
                </span>
                <span className="font-display text-sm font-bold">M-Pesa</span>
            </div>
            <div aria-hidden className="landing-float bg-card absolute right-[2%] bottom-[24%] flex items-center gap-2 rounded-full py-1.5 pr-4 pl-1.5 shadow-[0_16px_32px_-14px_rgba(15,23,42,0.4)] [animation-delay:-4s]">
                <span className="grid size-8 place-items-center rounded-full bg-[var(--teal-500)] text-white">
                    <BadgeCheckIcon className="size-4" />
                </span>
                <span className="font-display text-sm font-bold">KRA eTIMS</span>
            </div>
        </div>
    );
}

/** A duka owner behind her counter inside a blob, with the automated path cascading over its edge. */
function FlowVisual() {
    return (
        <div className="relative mx-auto aspect-[52/48] w-full max-w-[540px]">
            <svg viewBox="0 0 520 480" className="absolute inset-0 size-full overflow-visible" role="img" aria-label="A shop owner behind the counter of her well-stocked shop">
                <defs>
                    <clipPath id="flow-clip">
                        <path d={BLOB_SOFT} transform="rotate(12 260 240)" />
                    </clipPath>
                </defs>
                <path d="M20 300c50-50 130-40 160 10s10 120-50 140S-30 350 20 300Z" fill="var(--teal-400)" opacity="0.85" />
                <path d={BLOB_SOFT} fill="var(--red-500)" transform="rotate(12 260 240)" />
                <image href="/landing/duka-counter.jpg" x="-140" y="-30" width="760" height="507" preserveAspectRatio="xMidYMid slice" clipPath="url(#flow-clip)" />
                <path d="M470 60c30 20 40 60 20 86s-60 30-84 8-20-62 4-84 30-30 60-10Z" fill="var(--gold-500)" />
            </svg>
            <DotGrid className="absolute bottom-[4%] left-[2%] text-[var(--red-300)]" rows={4} cols={5} />

            {/* The automated path, cascading over the photo's right edge */}
            <ol aria-hidden className="absolute top-1/2 -right-[2%] grid w-[56%] -translate-y-1/2 gap-2 sm:-right-[8%] sm:w-[50%]">
                {WITH.map((step, i) => (
                    <li
                        key={step.label}
                        className="bg-card text-card-foreground ml-[var(--stagger)] flex items-center gap-2.5 rounded-xl px-2.5 py-2 shadow-[0_14px_30px_-16px_rgba(15,23,42,0.55)]"
                        style={{ "--stagger": `${[0, 10, 20, 10, 0][i]}%` } as React.CSSProperties}
                    >
                        <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-[var(--red-50)] text-[var(--red-500)] dark:bg-white/5 dark:text-[var(--red-400)]">
                            <step.icon className="size-3.5" />
                        </span>
                        <span className="font-display truncate text-xs font-bold sm:text-[13px]">{step.label}</span>
                        <CheckIcon className="ml-auto size-3.5 shrink-0 text-[var(--teal-500)]" strokeWidth={3} />
                    </li>
                ))}
            </ol>
        </div>
    );
}
