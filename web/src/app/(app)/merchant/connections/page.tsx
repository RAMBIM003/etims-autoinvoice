"use client";

import * as React from "react";
import Link from "next/link";
import { Link2Icon, ShieldCheckIcon, SmartphoneIcon } from "lucide-react";
import { toast } from "sonner";

import { PageHero } from "@/components/page-hero";
import { StatusBadge } from "@/components/status-badge";
import { ErrorState, LoadingRows } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useApi } from "@/hooks/use-api";
import { ApiError, api } from "@/lib/api";
import { dateTime } from "@/lib/format";
import type { ConnectionsPayload } from "@/lib/types";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div className="bg-muted flex items-center justify-between gap-3 rounded-md px-3 py-2 text-[13px]">
            <span className="text-muted-foreground">{label}</span>
            <span className="truncate font-mono font-semibold">{value}</span>
        </div>
    );
}

export default function ConnectionsPage() {
    const [checking, setChecking] = React.useState(false);
    const dashboard = useApi<ConnectionsPayload>(() => api.connections() as Promise<ConnectionsPayload>);

    const kra = dashboard.data?.kra ?? null;
    const mpesa = dashboard.data?.mpesa ?? [];
    const merchant = dashboard.data?.merchant;

    async function recheck() {
        setChecking(true);

        try {
            await api.checkKra({});
            toast.success("KRA responded. The status below is up to date.");
            dashboard.reload();
        } catch (error) {
            toast.error(error instanceof ApiError ? error.message : "KRA could not be reached.");
        } finally {
            setChecking(false);
        }
    }

    return (
        <>
            <PageHero
                crumb="Merchant / Connections"
                title="Your"
                accent="integrations"
                description="The two services this account stands on: KRA eTIMS for fiscalization, M-Pesa for payment."
                icon={Link2Icon}
            />

            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <p className="text-muted-foreground text-sm">Enter or change your KRA eTIMS and M-Pesa details here.</p>
                <Button asChild>
                    <Link href="/onboarding">Set up KRA and M-Pesa</Link>
                </Button>
            </div>

            {dashboard.error ? <ErrorState message={dashboard.error} onRetry={dashboard.reload} /> : null}

            {dashboard.loading ? (
                <LoadingRows rows={4} />
            ) : (
                <div className="grid gap-3 lg:grid-cols-2">
                    <Card>
                        <CardHeader>
                            <span className="bg-primary-soft text-primary grid size-11 shrink-0 place-items-center rounded-xl">
                                <ShieldCheckIcon className="size-5" />
                            </span>
                            <div>
                                <CardTitle>KRA eTIMS</CardTitle>
                                <StatusBadge status={kra?.status ?? "NOT_CONNECTED"} className="mt-1" />
                            </div>
                        </CardHeader>
                        <CardContent className="grid gap-2">
                            <p className="text-muted-foreground mb-1 text-[13px] leading-relaxed">
                                Invoices are signed by the OSCU control unit and filed against your PIN within seconds
                                of a matched payment.
                            </p>
                            <Row label="PIN" value={kra?.kra_pin || merchant?.kra_pin || "Not set"} />
                            <Row label="Branch" value={kra?.bhf_id || "Not set"} />
                            <Row label="Environment" value={kra?.environment || "—"} />
                            <Row label="Last verified" value={kra?.last_verified_at ? dateTime(kra.last_verified_at) : "Never"} />
                            {kra?.last_result ? <Row label="Last result" value={kra.last_result} /> : null}
                            <Button variant="outline" className="mt-2 w-fit" onClick={recheck} disabled={checking}>
                                {checking ? "Checking…" : "Re-check status"}
                            </Button>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <span className="bg-primary-soft text-primary grid size-11 shrink-0 place-items-center rounded-xl">
                                <SmartphoneIcon className="size-5" />
                            </span>
                            <div>
                                <CardTitle>M-Pesa</CardTitle>
                                <StatusBadge
                                    status={mpesa.some((m) => m.status === "ACTIVE") ? "ACTIVE" : "PENDING"}
                                    className="mt-1"
                                />
                            </div>
                        </CardHeader>
                        <CardContent className="grid gap-2">
                            <p className="text-muted-foreground mb-1 text-[13px] leading-relaxed">
                                Validation and confirmation URLs are registered with Daraja, so a paybill payment
                                matches itself to an open order.
                            </p>
                            {mpesa.length ? (
                                mpesa.map((channel) => (
                                    <React.Fragment key={channel.connection_type}>
                                        <Row label={channel.connection_type} value={channel.business_shortcode || "—"} />
                                        <Row
                                            label="Callbacks"
                                            value={channel.callback_registration_status || "Not registered"}
                                        />
                                        {channel.callback_error ? (
                                            <p className="text-bad text-xs">{channel.callback_error}</p>
                                        ) : null}
                                    </React.Fragment>
                                ))
                            ) : (
                                <p className="text-muted-foreground text-[13px]">
                                    No channel registered yet. Add your shortcode during onboarding to start receiving
                                    payments.
                                </p>
                            )}
                        </CardContent>
                    </Card>
                </div>
            )}
        </>
    );
}
