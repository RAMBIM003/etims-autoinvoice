"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, StoreIcon } from "lucide-react";

import { ErrorState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError, api, setToken } from "@/lib/api";

const BUSINESS_TYPES = ["Retail shop", "Wholesale", "Restaurant or café", "Fuel station", "Services", "Other"];

type Connected = { pin: string; name: string | null };

const selectClass =
    "border-input bg-background h-10 w-full rounded-md border px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

export default function MerchantSignUpPage() {
    const router = useRouter();
    const [error, setError] = React.useState<string | null>(null);
    const [consent, setConsent] = React.useState(false);
    const [busy, setBusy] = React.useState(false);
    const [codeSent, setCodeSent] = React.useState(false);
    const [connected, setConnected] = React.useState<Connected | null>(null);
    const [pinInput, setPinInput] = React.useState("");

    async function connectBusiness() {
        setError(null);
        const pin = pinInput.trim().toUpperCase();

        setBusy(true);
        try {
            const result = (await api.checkMerchantPin({ pin })) as { pin: string; name: string | null };
            setConnected({ pin: result.pin, name: result.name });
        } catch (err) {
            setConnected(null);
            setError(err instanceof ApiError ? err.message : "Could not check the KRA PIN.");
        } finally {
            setBusy(false);
        }
    }

    async function submit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError(null);

        if (!consent) {
            setError("Tick the box to confirm you may register this business.");
            return;
        }

        if (!connected) {
            setError("Connect your business with its KRA PIN first.");
            return;
        }

        const form = new FormData(event.currentTarget);
        const phone = String(form.get("phone") ?? "").trim();

        setBusy(true);

        if (!codeSent) {
            try {
                await api.sendOtp({ phone, purpose: "SIGNUP_MERCHANT" });
                setCodeSent(true);
            } catch (err) {
                setError(err instanceof ApiError ? err.message : "Could not send the code.");
            } finally {
                setBusy(false);
            }
            return;
        }

        try {
            await api.verifyOtp({ phone, code: String(form.get("code") ?? "").trim(), purpose: "SIGNUP_MERCHANT" });

            const result = (await api.registerMerchant({
                fullName: String(form.get("fullName") ?? "").trim(),
                email: String(form.get("email") ?? "").trim(),
                phone,
                password: String(form.get("password") ?? ""),
                consent: true,
                business: String(form.get("business") ?? "").trim(),
                business_phone: String(form.get("business_phone") ?? "").trim(),
                business_type: String(form.get("business_type") ?? "").trim(),
                kra_pin: connected.pin,
                connection_type: String(form.get("connection_type") ?? "PAYBILL"),
                shortcode: String(form.get("shortcode") ?? "").trim(),
            })) as { token?: string; callbacks?: { registered?: boolean } };

            if (result.token) setToken(result.token);

            // If M-Pesa callbacks could not be registered, the onboarding page lets the merchant retry.
            router.push(result.callbacks?.registered === false ? "/onboarding" : "/merchant");
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
                Your account is created once your KRA PIN and M-Pesa shortcode are connected.
            </p>

            <form onSubmit={submit} className="grid gap-5">
                <fieldset className="grid gap-4">
                    <legend className="text-sm font-bold">Owner</legend>
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
                </fieldset>

                <fieldset className="grid gap-4">
                    <legend className="text-sm font-bold">Business</legend>
                    <div className="grid gap-1.5">
                        <Label htmlFor="business">Trading name</Label>
                        <Input id="business" name="business" required placeholder="Nairobits Supplies" />
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="grid gap-1.5">
                            <Label htmlFor="business_phone">Business phone</Label>
                            <Input id="business_phone" name="business_phone" inputMode="tel" required placeholder="0712 345 678" />
                        </div>
                        <div className="grid gap-1.5">
                            <Label htmlFor="business_type">Business type</Label>
                            <select id="business_type" name="business_type" required defaultValue="" className={selectClass}>
                                <option value="" disabled>Choose one</option>
                                {BUSINESS_TYPES.map((t) => (
                                    <option key={t} value={t}>{t}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </fieldset>

                <fieldset className="grid gap-4">
                    <legend className="text-sm font-bold">KRA and M-Pesa</legend>
                    <div className="grid gap-1.5">
                        <Label htmlFor="kra_pin">KRA PIN</Label>
                        <div className="flex gap-2">
                            <Input
                                id="kra_pin"
                                name="kra_pin"
                                placeholder="P051234567M"
                                value={pinInput}
                                onChange={(e) => {
                                    setPinInput(e.target.value);
                                    setConnected(null);
                                }}
                                className="uppercase"
                            />
                            <Button type="button" variant="outline" onClick={connectBusiness} disabled={busy || !pinInput.trim()}>
                                Connect business
                            </Button>
                        </div>
                        {connected ? (
                            <p className="flex items-center gap-1.5 text-xs text-emerald-700">
                                <CheckCircle2 className="size-3.5" />
                                Connected{connected.name ? `: ${connected.name}` : ""}
                            </p>
                        ) : (
                            <p className="text-muted-foreground text-xs">We check this against the KRA PIN checker.</p>
                        )}
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="grid gap-1.5">
                            <Label htmlFor="connection_type">Payment type</Label>
                            <select id="connection_type" name="connection_type" defaultValue="PAYBILL" className={selectClass}>
                                <option value="PAYBILL">Paybill</option>
                                <option value="TILL">Till</option>
                            </select>
                        </div>
                        <div className="grid gap-1.5">
                            <Label htmlFor="shortcode">M-Pesa shortcode</Label>
                            <Input id="shortcode" name="shortcode" inputMode="numeric" required placeholder="600987" />
                        </div>
                    </div>
                </fieldset>

                {codeSent ? (
                    <div className="grid gap-1.5">
                        <Label htmlFor="code">Code sent to your phone</Label>
                        <Input id="code" name="code" inputMode="numeric" required autoComplete="one-time-code" placeholder="6-digit code" />
                    </div>
                ) : null}

                <Label htmlFor="consent" className="items-start gap-2.5 text-[13px] leading-relaxed font-normal">
                    <Checkbox id="consent" checked={consent} onCheckedChange={(v) => setConsent(v === true)} className="mt-0.5" />
                    <span>
                        I am authorised to register this business and to connect its KRA eTIMS and M-Pesa channels.
                    </span>
                </Label>

                <Button type="submit" disabled={busy}>{busy ? "Working…" : codeSent ? "Create account" : "Send code"}</Button>
            </form>

            {error ? <div className="mt-4"><ErrorState message={error} /></div> : null}

            <p className="text-muted-foreground mt-5 text-center text-sm">
                Already registered? <Link href="/sign-in" className="text-primary font-semibold">Sign in</Link>
            </p>
        </Card>
    );
}
