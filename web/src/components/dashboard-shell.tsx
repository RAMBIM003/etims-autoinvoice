"use client";

import * as React from "react";

import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader, type Notice } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { api } from "@/lib/api";
import { buyerAccountNav, buyerNav, merchantAccountNav, merchantNav } from "@/lib/nav";
import type { ConnectionsPayload } from "@/lib/types";

type Shell = {
    account: string;
    connected: boolean;
    statusLabel: string;
    systemNote: string;
    notices: Notice[];
};

const MERCHANT_FALLBACK: Shell = {
    account: "Your business",
    connected: false,
    statusLabel: "Checking…",
    systemNote: "Loading",
    notices: [],
};

const BUYER_FALLBACK: Shell = {
    account: "Your account",
    connected: true,
    statusLabel: "Signed in",
    systemNote: "Receipts arrive by SMS",
    notices: [],
};

/* /connections carries the trading name, the KRA state and the M-Pesa
   channels in one response, so the merchant shell needs no second request. */
function fromConnections(data: ConnectionsPayload): Shell {
    const kraConnected = data.kra?.status === "CONNECTED";
    const mpesaConnected = data.mpesa?.some((channel) => channel.status === "ACTIVE") ?? false;
    const notices: Notice[] = [];

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

    const branch = data.kra?.bhf_id;

    return {
        account: data.merchant?.trading_name || MERCHANT_FALLBACK.account,
        connected: kraConnected,
        statusLabel: kraConnected ? "KRA connected" : "KRA not connected",
        systemNote: branch ? `Branch ${branch}` : "Awaiting first fiscalization",
        notices,
    };
}

export function DashboardShell({
    audience,
    defaultOpen,
    children,
}: {
    audience: "Merchant" | "Buyer";
    defaultOpen: boolean;
    children: React.ReactNode;
}) {
    const isMerchant = audience === "Merchant";
    const [shell, setShell] = React.useState<Shell>(isMerchant ? MERCHANT_FALLBACK : BUYER_FALLBACK);

    React.useEffect(() => {
        let cancelled = false;

        const load = isMerchant
            ? api.connections().then((data) => fromConnections(data as ConnectionsPayload))
            : api.buyerProfile().then((profile) => ({
                  ...BUYER_FALLBACK,
                  account: (profile.name as string) || BUYER_FALLBACK.account,
              }));

        load
            .then((next) => {
                if (!cancelled) setShell(next);
            })
            .catch(() => {
                /* The sidebar keeps its fallback label; the page itself shows
                   the real error rather than two copies of it. */
                if (!cancelled && isMerchant) {
                    setShell({ ...MERCHANT_FALLBACK, statusLabel: "Status unavailable", systemNote: "Not reachable" });
                }
            });

        return () => {
            cancelled = true;
        };
    }, [isMerchant]);

    return (
        <SidebarProvider defaultOpen={defaultOpen}>
            <AppSidebar
                items={isMerchant ? merchantNav : buyerNav}
                audience={audience}
                accountName={shell.account}
                accountStatus={{ label: shell.statusLabel, connected: shell.connected }}
                systemNote={shell.systemNote}
            />
            <SidebarInset>
                <SiteHeader
                    searchPlaceholder={
                        isMerchant
                            ? "Search orders, invoices, payments or reference"
                            : "Search purchases, receipts or reference"
                    }
                    notices={shell.notices}
                    accountName={shell.account}
                    accountItems={isMerchant ? merchantAccountNav : buyerAccountNav}
                />
                <div className="mx-auto w-full max-w-[1400px] flex-1 px-3 pt-4 pb-10 sm:px-6">{children}</div>
            </SidebarInset>
        </SidebarProvider>
    );
}
