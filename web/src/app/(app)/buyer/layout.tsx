import { cookies } from "next/headers";

import { DashboardShell } from "@/components/dashboard-shell";

export default async function BuyerLayout({ children }: { children: React.ReactNode }) {
    const store = await cookies();
    const defaultOpen = store.get("etims_sidebar")?.value !== "false";

    return (
        <DashboardShell audience="Buyer" defaultOpen={defaultOpen}>
            {children}
        </DashboardShell>
    );
}
