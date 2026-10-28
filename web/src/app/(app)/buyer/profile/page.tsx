"use client";

import * as React from "react";
import { HashIcon, PhoneIcon, UserRoundIcon } from "lucide-react";
import { toast } from "sonner";

import { PageHero } from "@/components/page-hero";
import { ErrorState, LoadingRows } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useApi } from "@/hooks/use-api";
import { ApiError, api } from "@/lib/api";

type Profile = { name: string; pin_masked: string | null; phone_masked: string | null };
type Identity = { mpesa_name?: string | null; last3?: string | null; consent_at?: string | null };

function Detail({ icon: Icon, label, value }: { icon: typeof UserRoundIcon; label: string; value: string }) {
    return (
        <Card className="flex items-center gap-3 p-4">
            <span className="bg-primary-soft text-primary grid size-10 shrink-0 place-items-center rounded-xl">
                <Icon className="size-5" />
            </span>
            <div className="min-w-0">
                <p className="text-muted-foreground text-xs font-semibold">{label}</p>
                <p className="truncate font-mono text-sm font-bold">{value}</p>
            </div>
        </Card>
    );
}

export default function BuyerProfilePage() {
    const profile = useApi<Profile>(() => api.buyerProfile() as unknown as Promise<Profile>);
    const identity = useApi<Identity>(() => api.mpesaIdentity() as unknown as Promise<Identity>);

    /* Null means "not edited yet", so the saved value shows through until the
       person types. Copying it into state in an effect would fight the reload. */
    const [draftName, setDraftName] = React.useState<string | null>(null);
    const [draftConsent, setDraftConsent] = React.useState<boolean | null>(null);
    const [saving, setSaving] = React.useState(false);

    const name = draftName ?? identity.data?.mpesa_name ?? "";
    const consent = draftConsent ?? Boolean(identity.data?.consent_at);

    async function save(event: React.FormEvent) {
        event.preventDefault();

        if (!consent) {
            toast.error("Tick the box to let us match your M-Pesa name to your purchases.");
            return;
        }

        setSaving(true);

        try {
            await api.saveMpesaIdentity({ mpesa_name: name.trim(), consent: true });
            toast.success("Saved. Payments under this name will link to your account.");
            identity.reload();
        } catch (error) {
            toast.error(error instanceof ApiError ? error.message : "That could not be saved.");
        } finally {
            setSaving(false);
        }
    }

    return (
        <>
            <PageHero
                crumb="Buyer / Profile"
                title="Your"
                accent="details"
                description="What merchants and KRA see when a receipt is issued to you."
                icon={UserRoundIcon}
            />

            {profile.error ? <ErrorState message={profile.error} onRetry={profile.reload} /> : null}

            {profile.loading ? (
                <LoadingRows rows={3} />
            ) : (
                <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    <Detail icon={UserRoundIcon} label="Name" value={profile.data?.name || "—"} />
                    <Detail icon={PhoneIcon} label="Phone" value={profile.data?.phone_masked || "Not verified"} />
                    <Detail icon={HashIcon} label="KRA PIN" value={profile.data?.pin_masked || "Not set"} />
                </div>
            )}

            <Card className="max-w-2xl">
                <CardHeader>
                    <CardTitle>Match my M-Pesa payments</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-muted-foreground mb-4 text-[13px] leading-relaxed">
                        M-Pesa sends the merchant the name on your Safaricom line, not your phone number. Telling us
                        that name lets us link a payment to this account and send you the receipt, without the
                        merchant having to look you up.
                    </p>
                    <form onSubmit={save} className="grid gap-4">
                        <div className="grid gap-1.5">
                            <Label htmlFor="mpesa-name">Name on your M-Pesa line</Label>
                            <Input
                                id="mpesa-name"
                                value={name}
                                onChange={(e) => setDraftName(e.target.value)}
                                placeholder="As it appears on your M-Pesa messages"
                                required
                            />
                        </div>
                        <Label htmlFor="mpesa-consent" className="items-start gap-2.5 text-[13px] leading-relaxed font-normal">
                            <Checkbox
                                id="mpesa-consent"
                                checked={consent}
                                onCheckedChange={(v) => setDraftConsent(v === true)}
                                className="mt-0.5"
                            />
                            <span>
                                I agree that this name may be compared against payments made to merchants on eTIMS
                                AutoInvoice, so my receipts reach me automatically.
                            </span>
                        </Label>
                        <div className="flex flex-wrap gap-2">
                            <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
                            {identity.data?.mpesa_name ? (
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={async () => {
                                        await api.clearMpesaIdentity().catch(() => null);
                                        setDraftName("");
                                        setDraftConsent(false);
                                        toast.success("Removed. Payments will no longer be matched by name.");
                                        identity.reload();
                                    }}
                                >
                                    Remove
                                </Button>
                            ) : null}
                        </div>
                    </form>
                </CardContent>
            </Card>
        </>
    );
}
