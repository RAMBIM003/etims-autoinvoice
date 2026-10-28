import { cookies } from "next/headers";

import { DashboardShell } from "@/components/dashboard-shell";

export default async function MerchantLayout({ children }: { children: React.ReactNode }) {
    /* The sidebar's collapsed state is read on the server so the first paint is
       already the right width and the layout does not jump. */
    const store = await cookies();
    const defaultOpen = store.get("etims_sidebar")?.value !== "false";

    return (
        <DashboardShell audience="Merchant" defaultOpen={defaultOpen}>
            {children}
        </DashboardShell>
    );
}
