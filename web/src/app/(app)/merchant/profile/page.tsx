"use client";

import { HashIcon, MapPinIcon, StoreIcon } from "lucide-react";

import { PageHero } from "@/components/page-hero";
import { ErrorState, LoadingRows } from "@/components/states";
import { Card } from "@/components/ui/card";
import { useApi } from "@/hooks/use-api";
import { api } from "@/lib/api";
import type { DashboardPayload } from "@/lib/types";

function Detail({ icon: Icon, label, value }: { icon: typeof StoreIcon; label: string; value: string }) {
    return (
        <Card className="flex items-center gap-3 p-4">
            <span className="bg-primary-soft text-primary grid size-10 shrink-0 place-items-center rounded-xl">
                <Icon className="size-5" />
            </span>
            <div className="min-w-0">
                <p className="text-muted-foreground text-xs font-semibold">{label}</p>
                <p className="truncate text-sm font-bold">{value}</p>
            </div>
        </Card>
    );
}

export default function ProfilePage() {
    const dashboard = useApi<DashboardPayload>(() => api.dashboard() as Promise<DashboardPayload>);

    const merchant = dashboard.data?.merchant;
    const branches = dashboard.data?.branches ?? [];
    const head = branches.find((b) => b.is_head_office) ?? branches[0];

    return (
        <>
            <PageHero
                crumb="Merchant / Business profile"
                title="Business"
                accent="profile"
                description="The details KRA sees on every invoice you issue."
                icon={StoreIcon}
            />

            {dashboard.error ? <ErrorState message={dashboard.error} onRetry={dashboard.reload} /> : null}

            {dashboard.loading ? (
                <LoadingRows rows={3} />
            ) : (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    <Detail icon={StoreIcon} label="Trading name" value={merchant?.trading_name || "—"} />
                    <Detail icon={HashIcon} label="KRA PIN" value={merchant?.kra_pin || "Not set"} />
                    <Detail
                        icon={MapPinIcon}
                        label="Head office branch"
                        value={head ? `${head.branch_code} · ${head.branch_name}` : "Not registered"}
                    />
                </div>
            )}
        </>
    );
}
