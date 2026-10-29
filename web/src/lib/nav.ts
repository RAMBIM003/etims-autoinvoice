import {
    Boxes,
    CreditCard,
    FileText,
    LayoutDashboard,
    Link2,
    MapPin,
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
};

export const merchantNav: NavItem[] = [
    { href: "/merchant", label: "Dashboard", icon: LayoutDashboard, description: "Live transaction view" },
    { href: "/merchant/orders", label: "Orders", icon: ShoppingCart, description: "Sales awaiting payment" },
    { href: "/merchant/payments", label: "Payments", icon: CreditCard, description: "M-Pesa payments and matching" },
    { href: "/merchant/invoices", label: "Invoices", icon: FileText, description: "Fiscalized through the control unit" },
    { href: "/merchant/items", label: "Items", icon: Boxes, description: "Catalogue and KRA classification" },
    { href: "/merchant/branches", label: "Branches", icon: MapPin, description: "Registered trading locations" },
    { href: "/merchant/connections", label: "Connections", icon: Link2, description: "KRA eTIMS and M-Pesa" },
    { href: "/merchant/profile", label: "Business profile", icon: Store, description: "Your registered details" },
];

export const buyerNav: NavItem[] = [
    { href: "/buyer", label: "My purchases", icon: ShoppingCart, description: "Everything you have bought" },
    { href: "/buyer/receipts", label: "Receipts", icon: Receipt, description: "Fiscal receipts from KRA" },
    { href: "/buyer/profile", label: "Profile", icon: UserRound, description: "Phone, PIN and M-Pesa name" },
];
