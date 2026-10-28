"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CheckIcon, ShieldCheckIcon, SmartphoneIcon } from "lucide-react";
import { toast } from "sonner";

import { ErrorState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { ApiError, api } from "@/lib/api";

export default function OnboardingPage() {
    const router = useRouter();
    const [step, setStep] = React.useState(0);
    const [error, setError] = React.useState<string | null>(null);
    const [busy, setBusy] = React.useState(false);
    const [pin, setPin] = React.useState("");

    async function connectKra(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError(null);
        setBusy(true);

        const form = new FormData(event.currentTarget);

        try {
            await api.validateKraPin({ pin: pin.trim() });
            await api.connectKra({
                pin: pin.trim(),
                branch_id: String(form.get("branch") ?? "01").trim(),
                device_serial: String(form.get("serial") ?? "").trim() || null,
            });

            toast.success("KRA eTIMS connected. Invoices can now be fiscalized.");
            setStep(1);
        } catch (err) {
            setError(err instanceof ApiError ? err.message : "KRA did not accept those details.");
        } finally {
            setBusy(false);
        }
    }

    async function registerMpesa(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError(null);
        setBusy(true);

        const form = new FormData(event.currentTarget);

        try {
            await api.registerMpesa({
                business_shortcode: String(form.get("shortcode") ?? "").trim(),
                connection_type: "PAYBILL",
            });

            toast.success("Callbacks registered. Payments will reach your dashboard.");
            setStep(2);
        } catch (err) {
            setError(err instanceof ApiError ? err.message : "Daraja did not accept that shortcode.");
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="w-full max-w-xl py-6">
            <h1 className="text-2xl font-extrabold">Connect your business</h1>
            <p className="text-muted-foreground mt-1 text-sm">
                Two connections, then payments turn into fiscal receipts on their own.
            </p>

            <Progress value={((step + 1) / 3) * 100} className="mt-5 mb-5" aria-label={`Step ${step + 1} of 3`} />

            {step === 0 ? (
                <Card>
                    <CardHeader>
                        <span className="bg-primary-soft text-primary grid size-10 shrink-0 place-items-center rounded-xl">
                            <ShieldCheckIcon className="size-5" />
                        </span>
                        <CardTitle>Step 1 · KRA eTIMS</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={connectKra} className="grid gap-4">
                            <div className="grid gap-1.5">
                                <Label htmlFor="pin">KRA PIN</Label>
                                <Input
                                    id="pin"
                                    value={pin}
                                    onChange={(e) => setPin(e.target.value.toUpperCase())}
                                    placeholder="P051234567M"
                                    required
                                />
                                <p className="text-muted-foreground text-xs">
                                    We check this against the KRA PIN checker before saving it.
                                </p>
                            </div>
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div className="grid gap-1.5">
                                    <Label htmlFor="branch">Branch ID</Label>
                                    <Input id="branch" name="branch" defaultValue="01" required />
                                </div>
                                <div className="grid gap-1.5">
                                    <Label htmlFor="serial">Device serial</Label>
                                    <Input id="serial" name="serial" placeholder="Optional" />
                                </div>
                            </div>
                            <Button type="submit" disabled={busy}>{busy ? "Checking with KRA…" : "Connect eTIMS"}</Button>
                        </form>
                    </CardContent>
                </Card>
            ) : null}

            {step === 1 ? (
                <Card>
                    <CardHeader>
                        <span className="bg-primary-soft text-primary grid size-10 shrink-0 place-items-center rounded-xl">
                            <SmartphoneIcon className="size-5" />
                        </span>
                        <CardTitle>Step 2 · M-Pesa</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={registerMpesa} className="grid gap-4">
                            <div className="grid gap-1.5">
                                <Label htmlFor="shortcode">Paybill shortcode</Label>
                                <Input id="shortcode" name="shortcode" inputMode="numeric" required placeholder="600987" />
                                <p className="text-muted-foreground text-xs">
                                    We register the validation and confirmation URLs with Daraja for you.
                                </p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <Button type="submit" disabled={busy}>{busy ? "Registering…" : "Register callbacks"}</Button>
                                <Button type="button" variant="outline" onClick={() => setStep(2)}>Skip for now</Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            ) : null}

            {step === 2 ? (
                <Card>
                    <CardHeader>
                        <span className="bg-ok-soft text-ok grid size-10 shrink-0 place-items-center rounded-xl">
                            <CheckIcon className="size-5" />
                        </span>
                        <CardTitle>You are set up</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-muted-foreground mb-4 text-sm leading-relaxed">
                            Add the items you sell, raise your first order, and the next paybill payment will match
                            itself and fiscalize.
                        </p>
                        <Button onClick={() => router.push("/merchant")}>Go to dashboard</Button>
                    </CardContent>
                </Card>
            ) : null}

            {error ? <div className="mt-4"><ErrorState message={error} /></div> : null}
        </div>
    );
}
