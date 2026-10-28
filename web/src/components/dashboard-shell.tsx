"use client";

import * as React from "react";

import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader, type Notice } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { api } from "@/lib/api";
import { buyerNav, merchantNav } from "@/lib/nav";

type Connections = {
    kra?: { status?: string; pin?: string; branch_id?: string } | null;
    mpesa?: { status?: string }[] | null;
};

export function DashboardShell({
    audience,
    defaultOpen,
    children,
}: {
    audience: "Merchant" | "Buyer";
    defaultOpen: boolean;
    children: React.ReactNode;
}) {
    const [account, setAccount] = React.useState<string>(audience === "Merchant" ? "Your business" : "Your account");
    const [connections, setConnections] = React.useState<Connections | null>(null);

    React.useEffect(() => {
        let cancelled = false;

        api.me()
            .then((me) => {
                if (cancelled) return;

                const name =
                    (me.trading_name as string) ||
                    (me.business_name as string) ||
                    (me.full_name as string) ||
                    (me.name as string) ||
                    (me.email as string);

                if (name) setAccount(name);
            })
            .catch(() => {
                /* the sidebar falls back to a generic label; the page shows the real error */
            });

        if (audience === "Merchant") {
            api.connections()
                .then((data) => {
                    if (!cancelled) setConnections(data as Connections);
                })
                .catch(() => {
                    /* treated as not connected below */
                });
        }

        return () => {
            cancelled = true;
        };
    }, [audience]);

    const kraConnected = connections?.kra?.status === "CONNECTED";
    const mpesaConnected = Boolean(connections?.mpesa?.some((m) => m.status === "ACTIVE"));

    const notices: Notice[] = [];

    if (audience === "Merchant" && connections) {
        if (!kraConnected) {
            notices.push({
                id: "kra",
                title: "KRA eTIMS is not connected",
                detail: "Invoices cannot be fiscalized until you connect your PIN and control unit.",
                tone: "bad",
            });
        }

        if (!mpesaConnected) {
            notices.push({
                id: "mpesa",
                title: "No active M-Pesa channel",
                detail: "Register your paybill callbacks so payments match themselves to orders.",
                tone: "warn",
            });
        }
    }

    const status =
        audience === "Merchant"
            ? { label: kraConnected ? "KRA connected" : "KRA not connected", connected: kraConnected }
            : { label: "Signed in", connected: true };

    const systemNote =
        audience === "Merchant" && connections?.kra?.branch_id
            ? `Branch ${connections.kra.branch_id}`
            : "Awaiting first fiscalization";

    return (
        <SidebarProvider defaultOpen={defaultOpen}>
            <AppSidebar
                items={audience === "Merchant" ? merchantNav : buyerNav}
                audience={audience}
                accountName={account}
                accountStatus={status}
                systemNote={systemNote}
            />
            <SidebarInset>
                <SiteHeader
                    searchPlaceholder={
                        audience === "Merchant"
                            ? "Search orders, invoices, payments or reference"
                            : "Search purchases, receipts or reference"
                    }
                    notices={notices}
                />
                <div className="mx-auto w-full max-w-[1400px] flex-1 px-3 pt-4 pb-10 sm:px-6">{children}</div>
            </SidebarInset>
        </SidebarProvider>
    );
}
