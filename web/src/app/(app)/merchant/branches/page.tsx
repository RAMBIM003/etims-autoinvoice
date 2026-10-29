"use client";

import { MapPinIcon } from "lucide-react";

import { ListCard } from "@/components/list-card";
import { TablePagination, usePagination } from "@/components/table-pagination";
import { PageHero } from "@/components/page-hero";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState, ErrorState, LoadingRows } from "@/components/states";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useApi } from "@/hooks/use-api";
import { api } from "@/lib/api";
import type { DashboardPayload } from "@/lib/types";

export default function BranchesPage() {
    const dashboard = useApi<DashboardPayload>(() => api.dashboard() as Promise<DashboardPayload>);
    const branches = dashboard.data?.branches ?? [];
    const paged = usePagination(branches);

    return (
        <>
            <PageHero
                crumb="Merchant / Branches"
                title="Trading"
                accent="locations"
                description="The branches registered against your PIN. KRA files each invoice under one of them."
                icon={MapPinIcon}
            />

            {dashboard.error ? <ErrorState message={dashboard.error} onRetry={dashboard.reload} /> : null}

            <ListCard
                icon={MapPinIcon}
                title="Branches"
                count={branches.length}
                description="Ordered by branch code"
                footer={<TablePagination pagination={paged} noun="branches" one="branch" />}
            >
                {dashboard.loading ? (
                    <LoadingRows rows={3} />
                ) : branches.length ? (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Code</TableHead>
                                <TableHead>Branch</TableHead>
                                <TableHead className="hidden sm:table-cell">KRA branch ID</TableHead>
                                <TableHead>Status</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {paged.rows.map((branch) => (
                                <TableRow key={branch.id}>
                                    <TableCell className="font-mono text-xs">{branch.branch_code}</TableCell>
                                    <TableCell className="font-medium">
                                        {branch.branch_name}
                                        {branch.is_head_office ? (
                                            <Badge variant="outline" className="ml-2">Head office</Badge>
                                        ) : null}
                                    </TableCell>
                                    <TableCell className="text-muted-foreground hidden font-mono text-xs sm:table-cell">
                                        {branch.kra_bhf_id || "—"}
                                    </TableCell>
                                    <TableCell><StatusBadge status={branch.status} /></TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                ) : (
                    <EmptyState
                        icon={MapPinIcon}
                        title="No branches registered"
                        description="Your head office branch is created when you connect KRA eTIMS. Connect it to see it here."
                    />
                )}
            </ListCard>
        </>
    );
}
