"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { StoreIcon } from "lucide-react";

import { ErrorState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError, api, setToken } from "@/lib/api";

export default function MerchantSignUpPage() {
    const router = useRouter();
    const [error, setError] = React.useState<string | null>(null);
    const [consent, setConsent] = React.useState(false);
    const [busy, setBusy] = React.useState(false);

    async function submit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError(null);

        if (!consent) {
            setError("Tick the box to confirm you may register this business.");
            return;
        }

        setBusy(true);

        const form = new FormData(event.currentTarget);

        try {
            const result = (await api.registerMerchant({
                fullName: String(form.get("fullName") ?? "").trim(),
                business: String(form.get("business") ?? "").trim(),
                email: String(form.get("email") ?? "").trim(),
                phone: String(form.get("phone") ?? "").trim(),
                password: String(form.get("password") ?? ""),
                consent: true,
            })) as { token?: string };

            if (result.token) setToken(result.token);

            router.push("/onboarding");
        } catch (err) {
            setError(err instanceof ApiError ? err.message : "Registration failed.");
        } finally {
            setBusy(false);
        }
    }

    return (
        <Card className="w-full max-w-lg p-6">
            <span className="bg-primary-soft text-primary mb-3 grid size-11 place-items-center rounded-xl">
                <StoreIcon className="size-5" />
            </span>
            <h1 className="text-xl font-extrabold">Register your business</h1>
            <p className="text-muted-foreground mt-1 mb-5 text-sm">
                You connect your KRA PIN and M-Pesa shortcode in the next step.
            </p>

            <form onSubmit={submit} className="grid gap-4">
                <div className="grid gap-1.5">
                    <Label htmlFor="business">Trading name</Label>
                    <Input id="business" name="business" required placeholder="Nairobits Supplies" />
                </div>
                <div className="grid gap-1.5">
                    <Label htmlFor="fullName">Your name</Label>
                    <Input id="fullName" name="fullName" required autoComplete="name" />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="grid gap-1.5">
                        <Label htmlFor="email">Email</Label>
                        <Input id="email" name="email" type="email" required autoComplete="email" />
                    </div>
                    <div className="grid gap-1.5">
                        <Label htmlFor="phone">Phone</Label>
                        <Input id="phone" name="phone" inputMode="tel" required placeholder="0712 345 678" />
                    </div>
                </div>
                <div className="grid gap-1.5">
                    <Label htmlFor="password">Password</Label>
                    <Input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" />
                    <p className="text-muted-foreground text-xs">At least 8 characters.</p>
                </div>

                <Label htmlFor="consent" className="items-start gap-2.5 text-[13px] leading-relaxed font-normal">
                    <Checkbox id="consent" checked={consent} onCheckedChange={(v) => setConsent(v === true)} className="mt-0.5" />
                    <span>
                        I am authorised to register this business and to connect its KRA eTIMS and M-Pesa channels.
                    </span>
                </Label>

                <Button type="submit" disabled={busy}>{busy ? "Creating account…" : "Create account"}</Button>
            </form>

            {error ? <div className="mt-4"><ErrorState message={error} /></div> : null}

            <p className="text-muted-foreground mt-5 text-center text-sm">
                Already registered? <Link href="/sign-in" className="text-primary font-semibold">Sign in</Link>
            </p>
        </Card>
    );
}
