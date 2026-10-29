"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ReceiptIcon } from "lucide-react";

import { ErrorState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError, api, setToken } from "@/lib/api";

export default function BuyerSignUpPage() {
    const router = useRouter();
    const [error, setError] = React.useState<string | null>(null);
    const [consent, setConsent] = React.useState(false);
    const [mpesaConsent, setMpesaConsent] = React.useState(false);
    const [codeSent, setCodeSent] = React.useState(false);
    const [busy, setBusy] = React.useState(false);

    async function submit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError(null);

        if (!consent) {
            setError("Tick the box so we may send your receipts by SMS.");
            return;
        }

        const form = new FormData(event.currentTarget);
        const mpesaName = String(form.get("mpesaName") ?? "").trim();

        if (mpesaName.split(/\s+/).filter(Boolean).length < 2) {
            setError("Enter your first and last name exactly as it appears on M-Pesa.");
            return;
        }

        if (!mpesaConsent) {
            setError("Tick the box to link your M-Pesa payments to this account.");
            return;
        }

        const phone = String(form.get("phone") ?? "").trim();

        setBusy(true);

        if (!codeSent) {
            try {
                await api.sendOtp({ phone, purpose: "SIGNUP_BUYER" });
                setCodeSent(true);
            } catch (err) {
                setError(err instanceof ApiError ? err.message : "Could not send the code.");
            } finally {
                setBusy(false);
            }
            return;
        }

        try {
            await api.verifyOtp({ phone, code: String(form.get("code") ?? "").trim(), purpose: "SIGNUP_BUYER" });

            const result = (await api.registerBuyer({
                name: String(form.get("name") ?? "").trim(),
                email: String(form.get("email") ?? "").trim(),
                phone: String(form.get("phone") ?? "").trim(),
                pin: String(form.get("pin") ?? "").trim() || null,
                password: String(form.get("password") ?? ""),
                consent: true,
            })) as { token?: string };

            if (result.token) setToken(result.token);

            try {
                await api.saveMpesaIdentity({ mpesa_name: mpesaName, consent: true });
            } catch {
                /* the account exists; the profile page can finish the M-Pesa link */
                router.push("/buyer/profile");
                return;
            }

            router.push("/buyer");
        } catch (err) {
            setError(err instanceof ApiError ? err.message : "Registration failed.");
        } finally {
            setBusy(false);
        }
    }

    return (
        <Card className="w-full max-w-lg p-6">
            <span className="bg-primary-soft text-primary mb-3 grid size-11 place-items-center rounded-xl">
                <ReceiptIcon className="size-5" />
            </span>
            <h1 className="text-xl font-extrabold">Create a buyer account</h1>
            <p className="text-muted-foreground mt-1 mb-5 text-sm">
                Use the phone number you pay with, so receipts find you.
            </p>

            <form onSubmit={submit} className="grid gap-4">
                <div className="grid gap-1.5">
                    <Label htmlFor="name">Your name</Label>
                    <Input id="name" name="name" required autoComplete="name" />
                </div>
                <div className="grid gap-1.5">
                    <Label htmlFor="mpesaName">Name on your M-Pesa line</Label>
                    <Input id="mpesaName" name="mpesaName" required placeholder="As it appears on M-Pesa" />
                    <p className="text-muted-foreground text-xs">
                        First and last name, exactly as M-Pesa shows it. Your payments are matched on this.
                    </p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="grid gap-1.5">
                        <Label htmlFor="phone">Phone</Label>
                        <Input id="phone" name="phone" inputMode="tel" required placeholder="0712 345 678" />
                    </div>
                    <div className="grid gap-1.5">
                        <Label htmlFor="email">Email</Label>
                        <Input id="email" name="email" type="email" autoComplete="email" />
                    </div>
                </div>
                <div className="grid gap-1.5">
                    <Label htmlFor="pin">KRA PIN</Label>
                    <Input id="pin" name="pin" placeholder="P051234567M" />
                    <p className="text-muted-foreground text-xs">
                        Optional. Add it if you need your PIN printed on the receipt, for example to claim the VAT.
                    </p>
                </div>
                <div className="grid gap-1.5">
                    <Label htmlFor="password">Password</Label>
                    <Input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" />
                </div>

                <Label htmlFor="buyer-consent" className="items-start gap-2.5 text-[13px] leading-relaxed font-normal">
                    <Checkbox id="buyer-consent" checked={consent} onCheckedChange={(v) => setConsent(v === true)} className="mt-0.5" />
                    <span>I agree to receive my fiscal receipts by SMS at this number.</span>
                </Label>

                <Label htmlFor="mpesa-consent" className="items-start gap-2.5 text-[13px] leading-relaxed font-normal">
                    <Checkbox id="mpesa-consent" checked={mpesaConsent} onCheckedChange={(v) => setMpesaConsent(v === true)} className="mt-0.5" />
                    <span>I agree to link my M-Pesa payments to this account so my receipts can be matched.</span>
                </Label>

                {codeSent ? (
                    <div className="grid gap-1.5">
                        <Label htmlFor="code">Code sent to your phone</Label>
                        <Input id="code" name="code" inputMode="numeric" required autoComplete="one-time-code" placeholder="6-digit code" />
                    </div>
                ) : null}

                <Button type="submit" disabled={busy}>{busy ? "Working…" : codeSent ? "Create account" : "Send code"}</Button>
            </form>

            {error ? <div className="mt-4"><ErrorState message={error} /></div> : null}

            <p className="text-muted-foreground mt-5 text-center text-sm">
                Already registered? <Link href="/sign-in" className="text-primary font-semibold">Sign in</Link>
            </p>
        </Card>
    );
}
