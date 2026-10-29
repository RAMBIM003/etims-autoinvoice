"use client";

import * as React from "react";
import Link from "next/link";
import { SmartphoneIcon } from "lucide-react";
import { toast } from "sonner";

import { ErrorState, LoadingRows } from "@/components/states";
import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useApi } from "@/hooks/use-api";
import { ApiError, api } from "@/lib/api";
import { kes } from "@/lib/format";

type SimOrder = {
    order_reference: string;
    total_amount: string | number;
    currency: string;
    trading_name: string;
    shortcode: string | null;
};

type Context = { mode: string; shortcodes: string[]; orders: SimOrder[] };

export default function SimulatorPage() {
    const context = useApi<Context>(() => api.simulatorContext() as unknown as Promise<Context>);

    const [reference, setReference] = React.useState("");
    const [amount, setAmount] = React.useState("");
    const [sending, setSending] = React.useState(false);
    const [result, setResult] = React.useState<string | null>(null);

    const orders = context.data?.orders ?? [];
    const mode = context.data?.mode ?? "off";
    const chosen = orders.find((o) => o.order_reference === reference);

    /* Picking an order fills in the exact amount; a mismatch is the interesting test. */
    function choose(value: string) {
        setReference(value);

        const order = orders.find((o) => o.order_reference === value);

        if (order) setAmount(String(Math.round(Number(order.total_amount))));
    }

    async function send(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setResult(null);
        setSending(true);

        const form = new FormData(event.currentTarget);

        try {
            const response = (await api.simulatorPay({
                shortcode: chosen?.shortcode ?? String(form.get("shortcode") ?? ""),
                reference,
                amount: Number(amount),
                firstName: String(form.get("firstName") ?? "").trim(),
                lastName: String(form.get("lastName") ?? "").trim(),
                phone: String(form.get("phone") ?? "").trim(),
            })) as { mode?: string; trans_id?: string; message?: string };

            setResult(
                response.trans_id
                    ? `Payment accepted as ${response.trans_id}. Check the merchant's Payments page.`
                    : (response.message ?? "Payment sent.")
            );
            toast.success("Payment sent to the callback.");
        } catch (error) {
            const message = error instanceof ApiError ? error.message : "The payment could not be sent.";

            setResult(message);
            toast.error(message);
        } finally {
            setSending(false);
        }
    }

    return (
        <div className="min-h-svh px-4 py-6 sm:px-6">
            <div className="mx-auto w-full max-w-2xl">
                <div className="mb-4 flex items-center gap-2">
                    <Link href="/" className="font-display flex items-center gap-2.5 text-sm font-extrabold">
                        <span className="bg-primary text-primary-foreground grid size-8 place-items-center rounded-lg">
                            e
                        </span>
                        eTIMS AutoInvoice
                    </Link>
                    <ThemeToggle className="ml-auto size-9" />
                </div>

                <Card>
                    <CardHeader>
                        <span className="bg-primary-soft text-primary grid size-10 shrink-0 place-items-center rounded-xl">
                            <SmartphoneIcon className="size-5" />
                        </span>
                        <div>
                            <CardTitle>M-Pesa payment simulator</CardTitle>
                            <p className="text-muted-foreground text-xs">
                                Stands in for a customer paying your paybill.
                            </p>
                        </div>
                        <Badge variant={mode === "off" ? "bad" : "warn"} dot className="ml-auto">
                            {mode === "off" ? "Disabled" : mode}
                        </Badge>
                    </CardHeader>

                    <CardContent>
                        {mode === "off" ? (
                            <p className="border-warn-border bg-warn-soft text-warn rounded-lg border px-4 py-3 text-sm">
                                Simulation is switched off. Set <code className="font-mono">PAYMENT_SIMULATION</code>{" "}
                                in the backend environment to <code className="font-mono">local</code> or{" "}
                                <code className="font-mono">daraja</code> to use this page.
                            </p>
                        ) : null}

                        {context.loading ? <LoadingRows rows={4} /> : null}
                        {context.error ? <ErrorState message={context.error} onRetry={context.reload} /> : null}

                        {context.data && orders.length === 0 ? (
                            <p className="text-muted-foreground mb-4 rounded-lg border px-4 py-3 text-sm">
                                No orders are waiting for payment. Create an order on the{" "}
                                <Link href="/merchant/orders" className="text-primary font-semibold">Orders page</Link>{" "}
                                first, then come back here.
                            </p>
                        ) : null}

                        {context.data ? (
                            <form onSubmit={send} className="grid gap-4">
                                <div className="grid gap-1.5">
                                    <Label htmlFor="order">Order awaiting payment</Label>
                                    <Select value={reference} onValueChange={choose}>
                                        <SelectTrigger id="order">
                                            <SelectValue
                                                placeholder={orders.length ? "Choose an order" : "No orders awaiting payment"}
                                            />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {orders.map((order) => (
                                                <SelectItem key={order.order_reference} value={order.order_reference}>
                                                    {order.order_reference} · {order.trading_name} ·{" "}
                                                    {kes(order.total_amount)}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="grid gap-4 sm:grid-cols-2">
                                    <div className="grid gap-1.5">
                                        <Label htmlFor="shortcode">Shortcode</Label>
                                        <Input
                                            id="shortcode"
                                            name="shortcode"
                                            defaultValue={context.data.shortcodes[0] ?? ""}
                                            value={chosen?.shortcode ?? undefined}
                                            readOnly={Boolean(chosen?.shortcode)}
                                            required
                                        />
                                    </div>
                                    <div className="grid gap-1.5">
                                        <Label htmlFor="amount">Amount (KES)</Label>
                                        <Input
                                            id="amount"
                                            value={amount}
                                            onChange={(e) => setAmount(e.target.value)}
                                            type="number"
                                            min="1"
                                            step="1"
                                            required
                                        />
                                        <p className="text-muted-foreground text-xs">
                                            Change it to test how an amount mismatch is handled.
                                        </p>
                                    </div>
                                </div>

                                <div className="grid gap-4 sm:grid-cols-3">
                                    <div className="grid gap-1.5">
                                        <Label htmlFor="firstName">First name</Label>
                                        <Input id="firstName" name="firstName" defaultValue="Wanjiku" required />
                                    </div>
                                    <div className="grid gap-1.5">
                                        <Label htmlFor="lastName">Last name</Label>
                                        <Input id="lastName" name="lastName" defaultValue="Kamau" />
                                    </div>
                                    <div className="grid gap-1.5">
                                        <Label htmlFor="phone">Phone</Label>
                                        <Input id="phone" name="phone" inputMode="tel" defaultValue="254712345678" required />
                                    </div>
                                </div>

                                <Button type="submit" disabled={sending || mode === "off" || !reference}>
                                    {sending ? "Sending…" : "Send payment"}
                                </Button>
                            </form>
                        ) : null}

                        {result ? (
                            <p className="border-ok-border bg-ok-soft text-ok mt-4 rounded-lg border px-4 py-3 text-sm">
                                {result}
                            </p>
                        ) : null}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
