/** Shapes returned by the Express API. Only the fields the UI reads are listed. */

export type Sale = {
    id: string;
    order_reference: string;
    status: string;
    currency: string;
    total_amount: string | number;
    subtotal?: string | number;
    tax_amount?: string | number;
    created_at: string;
    customer_name?: string;
};

export type Payment = {
    id: string;
    amount: string | number;
    currency: string;
    status: string;
    match_method?: string | null;
    payment_reference?: string | null;
    paid_at?: string | null;
    created_at?: string | null;
    trans_id?: string | null;
    business_shortcode?: string | null;
    /** The account reference the payer typed, normally an order reference. */
    bill_ref_number?: string | null;
    payer_name?: string | null;
};

export type Invoice = {
    id: string;
    sale_id: string;
    invoice_number: string;
    seller_pin?: string | null;
    buyer_pin?: string | null;
    buyer_name?: string | null;
    currency: string;
    subtotal?: string | number;
    tax_amount?: string | number;
    total_amount: string | number;
    fiscalization_status: string;
    kra_receipt_number?: string | null;
    kra_invoice_number?: string | null;
    cu_serial_number?: string | null;
    fiscalized_at?: string | null;
    created_at: string;
};

export type Item = {
    id: string;
    sku?: string | null;
    name: string;
    description?: string | null;
    unit_code?: string | null;
    unit_price: string | number;
    currency: string;
    tax_type_code?: string | null;
    tax_rate?: string | number | null;
    status: string;
};

export type Branch = {
    id: string;
    branch_code: string;
    branch_name: string;
    kra_bhf_id?: string | null;
    is_head_office?: boolean;
    status: string;
    created_at: string;
};

export type KraConnection = {
    status?: string;
    last_verified_at?: string | null;
    last_result?: string | null;
    pin?: string | null;
    branch_id?: string | null;
} | null;

export type MpesaConnection = {
    connection_type: string;
    business_shortcode?: string | null;
    status: string;
    callback_registration_status?: string | null;
    callback_error?: string | null;
};

export type DashboardPayload = {
    merchant: { id: string; trading_name: string; kra_pin?: string | null };
    stats: {
        items: number;
        orders: number;
        today_sales: number;
        matched_payments: number;
        unmatched_payments: number;
        invoices: number;
        fiscalized_invoices: number;
    };
    orders: Sale[];
    payments: Payment[];
    invoices: Invoice[];
    branches: Branch[];
    connections: { kra: KraConnection; mpesa: MpesaConnection[] };
};

export type BuyerOrder = {
    id: string;
    order_reference: string;
    status: string;
    total_amount: string | number;
    currency: string;
    created_at: string;
    merchant_name?: string;
    invoice_id?: string | null;
    receipt_url?: string | null;
    fiscalization_status?: string | null;
};

export type BuyerPurchase = {
    order: {
        id: string;
        order_reference: string;
        status: string;
        total_amount: string | number;
        currency: string;
        merchant_name?: string | null;
        created_at: string;
    };
    payment?: { status: string; amount: string | number; trans_id?: string | null } | null;
    invoice?: { id: string; number: string; status: string; kra_receipt_number?: string | null } | null;
    stage: string;
    receipt_url?: string | null;
};

export type ConnectionsPayload = {
    merchant: { id: string; trading_name: string; kra_pin?: string | null };
    kra: {
        environment?: string | null;
        kra_pin?: string | null;
        bhf_id?: string | null;
        status?: string | null;
        last_verified_at?: string | null;
        last_result?: string | null;
    } | null;
    mpesa: MpesaConnection[];
};

export type MeResponse = {
    user: { id: string; email?: string | null; full_name?: string | null; phone?: string | null };
    merchant?: { id: string; trading_name: string; kra_pin?: string | null } | null;
    kra?: { status?: string | null } | null;
    mpesa?: { type: string; shortcode?: string | null; status: string; callback?: string | null }[] | null;
};
