import {
    Boxes,
    CreditCard,
    FileText,
    LayoutDashboard,
    Link2,
    MapPin,
    ScrollText,
    Settings,
    Receipt,
    ShoppingCart,
    Store,
    UserRound,
} from "lucide-react";

export type NavItem = {
    href: string;
    label: string;
    icon: typeof LayoutDashboard;
    description: string;
    /** Sidebar section heading. Items without one sit under the audience heading. */
    group?: string;
};

export const merchantNav: NavItem[] = [
    { href: "/merchant", label: "Dashboard", icon: LayoutDashboard, description: "Live transaction view" },
    { href: "/merchant/orders", label: "Orders", icon: ShoppingCart, description: "Sales awaiting payment", group: "Sales" },
    {
        href: "/merchant/payments",
        label: "Payments",
        icon: CreditCard,
        description: "M-Pesa payments and matching",
        group: "Sales",
    },
    {
        href: "/merchant/invoices",
        label: "Invoices",
        icon: FileText,
        description: "Fiscalized through the control unit",
        group: "Sales",
    },
    { href: "/merchant/items", label: "Items", icon: Boxes, description: "Catalogue and KRA classification", group: "Setup" },
    { href: "/merchant/branches", label: "Branches", icon: MapPin, description: "Registered trading locations", group: "Setup" },
    { href: "/merchant/connections", label: "Connections", icon: Link2, description: "KRA eTIMS and M-Pesa", group: "Setup" },
    { href: "/merchant/logs", label: "Logs", icon: ScrollText, description: "Errors and workflow events", group: "System" },
];

export const buyerNav: NavItem[] = [
    { href: "/buyer", label: "My purchases", icon: ShoppingCart, description: "Everything you have bought" },
    { href: "/buyer/receipts", label: "Receipts", icon: Receipt, description: "Fiscal receipts from KRA" },
];

/* Account pages live in the avatar menu in the header, not the sidebar. */
export const merchantAccountNav: NavItem[] = [
    { href: "/merchant/profile", label: "Business profile", icon: Store, description: "Your registered details" },
    { href: "/merchant/connections", label: "Settings", icon: Settings, description: "KRA eTIMS and M-Pesa" },
];

export const buyerAccountNav: NavItem[] = [
    { href: "/buyer/profile", label: "Profile", icon: UserRound, description: "Phone, PIN and M-Pesa name" },
];
