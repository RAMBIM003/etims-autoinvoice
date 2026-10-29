"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ErrorState } from "@/components/states";
import { ApiError, api, setToken } from "@/lib/api";

export default function SignInPage() {
    const router = useRouter();
    const [error, setError] = React.useState<string | null>(null);
    const [busy, setBusy] = React.useState(false);

    /* Phone OTP is a two-step form: request a code, then verify it. */
    const [phone, setPhone] = React.useState("");
    const [codeSent, setCodeSent] = React.useState(false);
    const [code, setCode] = React.useState("");

    function land(role?: string) {
        router.push(role === "BUYER" ? "/buyer" : "/merchant");
    }

    async function signInWithPassword(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError(null);
        setBusy(true);

        const form = new FormData(event.currentTarget);

        try {
            const result = await api.login({
                identifier: String(form.get("identifier") ?? "").trim(),
                password: String(form.get("password") ?? ""),
            });

            setToken(result.token);
            land(result.role);
        } catch (err) {
            setError(err instanceof ApiError ? err.message : "Sign in failed.");
        } finally {
            setBusy(false);
        }
    }

    async function sendCode() {
        setError(null);
        setBusy(true);

        try {
            await api.sendOtp({ destination: phone.trim(), purpose: "LOGIN" });
            setCodeSent(true);
        } catch (err) {
            setError(err instanceof ApiError ? err.message : "The code could not be sent.");
        } finally {
            setBusy(false);
        }
    }

    async function verifyCode(event: React.FormEvent) {
        event.preventDefault();
        setError(null);
        setBusy(true);

        try {
            const result = await api.loginWithOtp({ destination: phone.trim(), code: code.trim() });

            setToken(result.token);
            land(result.role);
        } catch (err) {
            setError(err instanceof ApiError ? err.message : "That code was not accepted.");
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="grid w-full max-w-4xl gap-6 lg:grid-cols-2 lg:items-center">
            <section className="bg-band text-band-foreground relative hidden overflow-hidden rounded-2xl p-8 lg:block">
                <span
                    aria-hidden
                    className="pointer-events-none absolute inset-y-0 right-0 w-2/5 bg-[linear-gradient(115deg,transparent_50%,var(--primary)_50%,var(--primary)_56%,transparent_56%,transparent_72%,var(--primary)_72%,var(--primary)_76%,transparent_76%)] opacity-30"
                />
                <h2 className="relative text-2xl font-extrabold">Payments in. Invoices out.</h2>
                <p className="text-band-muted relative mt-2 text-sm leading-relaxed">
                    M-Pesa to KRA eTIMS to a digital receipt, automatically.
                </p>
            </section>

            <Card className="w-full p-6">
                <h1 className="text-xl font-extrabold">Sign in</h1>
                <p className="text-muted-foreground mt-1 mb-5 text-sm">Enter your credentials to continue.</p>

                <Tabs defaultValue="password">
                    <TabsList className="mb-4 w-full">
                        <TabsTrigger value="password">Password</TabsTrigger>
                        <TabsTrigger value="otp">Phone code</TabsTrigger>
                    </TabsList>

                    <TabsContent value="password">
                        <form onSubmit={signInWithPassword} className="grid gap-4">
                            <div className="grid gap-1.5">
                                <Label htmlFor="identifier">Email or phone</Label>
                                <Input id="identifier" name="identifier" required autoComplete="username" />
                            </div>
                            <div className="grid gap-1.5">
                                <Label htmlFor="password">Password</Label>
                                <Input id="password" name="password" type="password" required autoComplete="current-password" />
                            </div>
                            <Button type="submit" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</Button>
                        </form>
                    </TabsContent>

                    <TabsContent value="otp">
                        <form onSubmit={verifyCode} className="grid gap-4">
                            <div className="grid gap-1.5">
                                <Label htmlFor="phone">Phone number</Label>
                                <Input
                                    id="phone"
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                    placeholder="0712 345 678"
                                    inputMode="tel"
                                    required
                                />
                            </div>
                            {codeSent ? (
                                <>
                                    <div className="grid gap-1.5">
                                        <Label htmlFor="code">6-digit code</Label>
                                        <Input
                                            id="code"
                                            value={code}
                                            onChange={(e) => setCode(e.target.value)}
                                            maxLength={6}
                                            inputMode="numeric"
                                            required
                                        />
                                    </div>
                                    <Button type="submit" disabled={busy}>{busy ? "Checking…" : "Verify and sign in"}</Button>
                                </>
                            ) : (
                                <Button type="button" variant="outline" onClick={sendCode} disabled={busy || !phone.trim()}>
                                    {busy ? "Sending…" : "Send code"}
                                </Button>
                            )}
                        </form>
                    </TabsContent>
                </Tabs>

                {error ? <div className="mt-4"><ErrorState message={error} /></div> : null}

                <p className="text-muted-foreground mt-5 text-center text-sm">
                    No account yet? <Link href="/sign-up" className="text-primary font-semibold">Create one</Link>
                </p>
            </Card>
        </div>
    );
}
