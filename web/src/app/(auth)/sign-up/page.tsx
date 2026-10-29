import Link from "next/link";
import { ArrowRightIcon, ReceiptIcon, StoreIcon } from "lucide-react";

import { Card } from "@/components/ui/card";

export const metadata = { title: "Create an account" };

const ROLES = [
    {
        href: "/sign-up/merchant",
        icon: StoreIcon,
        title: "I sell",
        description:
            "Take M-Pesa payments, raise orders against your catalogue, and have every invoice fiscalized with KRA automatically.",
        detail: "You will need your KRA PIN and your M-Pesa shortcode.",
    },
    {
        href: "/sign-up/buyer",
        icon: ReceiptIcon,
        title: "I buy",
        description:
            "Keep every fiscal receipt from merchants on eTIMS AutoInvoice in one place, delivered by SMS as soon as KRA signs it.",
        detail: "You will need the phone number you pay with.",
    },
];

export default function SignUpPage() {
    return (
        <div className="w-full max-w-3xl py-6">
            <h1 className="text-center text-2xl font-extrabold sm:text-3xl">Create your account</h1>
            <p className="text-muted-foreground mt-2 text-center text-sm">
                Which side of the counter are you on?
            </p>

            <div className="mt-7 grid gap-4 sm:grid-cols-2">
                {ROLES.map((role) => (
                    <Link key={role.href} href={role.href} className="group rounded-xl outline-none focus-visible:ring-[3px] focus-visible:ring-ring">
                        <Card className="group-hover:border-primary flex h-full flex-col gap-3 p-6 transition-colors">
                            <span className="bg-primary-soft text-primary grid size-11 place-items-center rounded-xl">
                                <role.icon className="size-5" />
                            </span>
                            <h2 className="font-display text-lg font-bold">{role.title}</h2>
                            <p className="text-muted-foreground text-sm leading-relaxed">{role.description}</p>
                            <p className="text-muted-foreground bg-muted mt-auto rounded-md px-3 py-2 text-xs">
                                {role.detail}
                            </p>
                            <span className="text-primary flex items-center gap-1.5 text-sm font-semibold">
                                Continue <ArrowRightIcon className="size-4" />
                            </span>
                        </Card>
                    </Link>
                ))}
            </div>

            <p className="text-muted-foreground mt-6 text-center text-sm">
                Already registered? <Link href="/sign-in" className="text-primary font-semibold">Sign in</Link>
            </p>
        </div>
    );
}
