/**
 * A stand-in for the Express API, used to drive the UI in tests without a
 * database. Payload shapes mirror backend/routes/*.js exactly; if the real API
 * changes shape, this file should change with it.
 *
 * Run: node test/mock-api.mjs [port]
 */
import { createServer } from "node:http";

const PORT = Number(process.argv[2] ?? 5099);
const day = (back) => new Date(Date.now() - back * 86400000).toISOString();

const sales = [
    { id: "s1", order_reference: "ORD-10148", status: "COMPLETED", currency: "KES", total_amount: "2160", created_at: day(0), customer_name: "Wanjiku Stores" },
    { id: "s2", order_reference: "ORD-10147", status: "COMPLETED", currency: "KES", total_amount: "950", created_at: day(0), customer_name: "Walk-in customer" },
    { id: "s3", order_reference: "ORD-10146", status: "AWAITING_PAYMENT", currency: "KES", total_amount: "18420", created_at: day(1), customer_name: "Kimathi Hardware" },
    { id: "s4", order_reference: "ORD-10145", status: "COMPLETED", currency: "KES", total_amount: "7310", created_at: day(2), customer_name: "Achieng Pharmacy" },
    { id: "s5", order_reference: "ORD-10144", status: "CANCELLED", currency: "KES", total_amount: "4080", created_at: day(3), customer_name: "Mwangi Grocers" },
    { id: "s6", order_reference: "ORD-10143", status: "PAID", currency: "KES", total_amount: "12600", created_at: day(4), customer_name: "Otieno & Sons" },
    { id: "s7", order_reference: "ORD-10142", status: "COMPLETED", currency: "KES", total_amount: "5400", created_at: day(5), customer_name: "Njeri Wholesalers" },
    { id: "s8", order_reference: "ORD-10141", status: "COMPLETED", currency: "KES", total_amount: "3180", created_at: day(6), customer_name: "Walk-in customer" },
];

const payments = [
    { id: "p1", amount: "2160", currency: "KES", status: "MATCHED", match_method: "BILL_REF", payment_reference: "ORD-10148", paid_at: day(0), trans_id: "SKJ7HQ2X9L", business_shortcode: "600987", payer_name: "WANJIKU KAMAU" },
    { id: "p2", amount: "950", currency: "KES", status: "MATCHED", match_method: "BILL_REF", payment_reference: "ORD-10147", paid_at: day(0), trans_id: "SKJ7HQ3B2M", business_shortcode: "600987", payer_name: "JOSEPH OTIENO" },
    { id: "p3", amount: "18000", currency: "KES", status: "AMOUNT_MISMATCH", match_method: "BILL_REF", payment_reference: "ORD-10146", paid_at: day(1), trans_id: "SKJ7HQ4C8N", business_shortcode: "600987", payer_name: "PETER KIMATHI" },
    { id: "p4", amount: "7310", currency: "KES", status: "MATCHED", match_method: "MSISDN", payment_reference: "ORD-10145", paid_at: day(2), trans_id: "SKJ7HQ5D1P", business_shortcode: "600987", payer_name: "ACHIENG ODHIAMBO" },
    { id: "p5", amount: "1500", currency: "KES", status: "UNMATCHED", match_method: null, payment_reference: null, paid_at: day(3), trans_id: "SKJ7HQ6E4Q", business_shortcode: "600987", payer_name: "UNKNOWN PAYER" },
];

const invoices = [
    { id: "i1", sale_id: "s1", invoice_number: "INV-00148", seller_pin: "P051234567M", buyer_pin: "P012345678K", buyer_name: "Wanjiku Stores", currency: "KES", subtotal: "1862", tax_amount: "298", total_amount: "2160", fiscalization_status: "FISCALIZED", kra_receipt_number: "0010294471", kra_invoice_number: "KRA-0010294471", cu_serial_number: "OSCU-SBX-0442", fiscalized_at: day(0), created_at: day(0) },
    { id: "i2", sale_id: "s2", invoice_number: "INV-00147", seller_pin: "P051234567M", buyer_pin: null, buyer_name: null, currency: "KES", subtotal: "950", tax_amount: "0", total_amount: "950", fiscalization_status: "FISCALIZED", kra_receipt_number: "0010294468", kra_invoice_number: "KRA-0010294468", cu_serial_number: "OSCU-SBX-0442", fiscalized_at: day(0), created_at: day(0) },
    { id: "i3", sale_id: "s4", invoice_number: "INV-00145", seller_pin: "P051234567M", buyer_pin: "P099887766L", buyer_name: "Achieng Pharmacy", currency: "KES", subtotal: "6769", tax_amount: "541", total_amount: "7310", fiscalization_status: "FISCALIZED", kra_receipt_number: "0010294455", kra_invoice_number: "KRA-0010294455", cu_serial_number: "OSCU-SBX-0442", fiscalized_at: day(2), created_at: day(2) },
    { id: "i4", sale_id: "s5", invoice_number: "INV-00144", seller_pin: "P051234567M", buyer_pin: null, buyer_name: "Mwangi Grocers", currency: "KES", subtotal: "3517", tax_amount: "563", total_amount: "4080", fiscalization_status: "FAILED", kra_receipt_number: null, kra_invoice_number: null, cu_serial_number: null, fiscalized_at: null, created_at: day(3) },
    { id: "i5", sale_id: "s6", invoice_number: "INV-00143", seller_pin: "P051234567M", buyer_pin: null, buyer_name: "Otieno & Sons", currency: "KES", subtotal: "12600", tax_amount: "0", total_amount: "12600", fiscalization_status: "PENDING", kra_receipt_number: null, kra_invoice_number: null, cu_serial_number: null, fiscalized_at: null, created_at: day(4) },
];

const items = [
    { id: "it1", sku: "MF-2KG", name: "Maize flour 2kg", unit_code: "PCS", unit_price: "180", currency: "KES", tax_type_code: "B", tax_rate: "16", status: "ACTIVE" },
    { id: "it2", sku: "CO-1L", name: "Cooking oil 1L", unit_code: "PCS", unit_price: "350", currency: "KES", tax_type_code: "B", tax_rate: "16", status: "ACTIVE" },
    { id: "it3", sku: "UP-1KG", name: "Unga Pembe 1kg", unit_code: "PCS", unit_price: "95", currency: "KES", tax_type_code: "A", tax_rate: "0", status: "ACTIVE" },
    { id: "it4", sku: null, name: "Delivery within Nairobi", unit_code: "SVC", unit_price: "250", currency: "KES", tax_type_code: null, tax_rate: null, status: "ACTIVE" },
    { id: "it5", sku: "SG-2KG", name: "Sugar 2kg", unit_code: "PCS", unit_price: "420", currency: "KES", tax_type_code: "E", tax_rate: "8", status: "INACTIVE" },
];

const branches = [
    { id: "b1", branch_code: "01", branch_name: "Head office · Nairobi CBD", kra_bhf_id: "01", is_head_office: true, status: "ACTIVE", created_at: day(90) },
    { id: "b2", branch_code: "02", branch_name: "Westlands depot", kra_bhf_id: "02", is_head_office: false, status: "ACTIVE", created_at: day(60) },
];

const connections = {
    kra: { status: "CONNECTED", last_verified_at: day(0), last_result: "OK", pin: "P051234567M", branch_id: "01" },
    mpesa: [{ connection_type: "PAYBILL", business_shortcode: "600987", status: "ACTIVE", callback_registration_status: "REGISTERED", callback_error: null }],
};

const buyerOrders = [
    { order: { id: "s1", order_reference: "ORD-10148", status: "COMPLETED", total_amount: "2160", currency: "KES", merchant_name: "Nairobits Supplies", created_at: day(0) }, payment: { status: "MATCHED", amount: "2160", trans_id: "SKJ7HQ2X9L" }, invoice: { id: "i1", number: "INV-00148", status: "FISCALIZED", kra_receipt_number: "0010294471" }, stage: "RECEIPT_READY", receipt_url: "/receipt/demo-token" },
    { order: { id: "s3", order_reference: "ORD-10146", status: "AWAITING_PAYMENT", total_amount: "18420", currency: "KES", merchant_name: "Kimathi Hardware", created_at: day(1) }, payment: null, invoice: null, stage: "AWAITING_PAYMENT", receipt_url: null },
    { order: { id: "s6", order_reference: "ORD-10143", status: "PAID", total_amount: "12600", currency: "KES", merchant_name: "Otieno & Sons", created_at: day(4) }, payment: { status: "MATCHED", amount: "12600", trans_id: "SKJ7HQ9Z3T" }, invoice: { id: "i5", number: "INV-00143", status: "PENDING", kra_receipt_number: null }, stage: "FISCALIZING", receipt_url: null },
    { order: { id: "s5", order_reference: "ORD-10144", status: "CANCELLED", total_amount: "4080", currency: "KES", merchant_name: "Mwangi Grocers", created_at: day(3) }, payment: null, invoice: { id: "i4", number: "INV-00144", status: "FAILED", kra_receipt_number: null }, stage: "FISCALIZATION_FAILED", receipt_url: null },
];

const ROUTES = {
    "GET /api/auth/me": { id: "u1", trading_name: "Nairobits Supplies", full_name: "Benard Mwangi", email: "owner@example.com" },
    "GET /api/dashboard": {
        merchant: { id: "m1", trading_name: "Nairobits Supplies", kra_pin: "P051234567M" },
        stats: { items: items.length, orders: sales.length, today_sales: 3110, matched_payments: 3, unmatched_payments: 1, invoices: invoices.length, fiscalized_invoices: 3 },
        orders: sales, payments, invoices, branches, connections,
    },
    "GET /api/sales": { sales },
    "GET /api/payments": { payments },
    "GET /api/invoices": { invoices },
    "GET /api/items": { items },
    "GET /api/connections": { merchant: { id: "m1" }, ...connections },
    "GET /api/buyer-app/profile": { name: "Benard Mwangi", pin_masked: "P05*****7M", phone_masked: "0712 ** 678" },
    "GET /api/buyer-app/orders": { orders: buyerOrders },
    "GET /api/buyer-identity/mpesa": { mpesa_name: "BENARD MWANGI", last3: "678", consent_at: day(10) },
    "GET /api/simulator/context": {
        mode: "local",
        shortcodes: ["600987"],
        orders: [{ order_reference: "ORD-10146", total_amount: "18420", currency: "KES", trading_name: "Nairobits Supplies", shortcode: "600987" }],
    },
    "GET /api/receipts/public/demo-token": {
        merchant: { name: "Nairobits Supplies", pin: "P051234567M" },
        buyer: { name: "Wanjiku Stores", pin: "P012345678K" },
        invoice: {
            number: "INV-00148", order_reference: "ORD-10148", currency: "KES",
            subtotal: "1862", tax_amount: "298", total_amount: "2160",
            kra_receipt_number: "0010294471", kra_invoice_number: "KRA-0010294471",
            cu_serial_number: "OSCU-SBX-0442", receipt_signature: "QK4T-9ZB2-7MVX-1LDR",
            kra_internal_data: "A4B2C9D1E7F3", sdc_date_time: "20261028143200", fiscalized_at: day(0),
        },
        items: [
            { item_name: "Maize flour 2kg", sku: "MF-2KG", quantity: "10", unit_code: "PCS", unit_price: "180", tax_rate: "16", tax_amount: "248", line_subtotal: "1552", line_total: "1800" },
            { item_name: "Unga Pembe 1kg", sku: "UP-1KG", quantity: "4", unit_code: "PCS", unit_price: "90", tax_rate: "0", tax_amount: "0", line_subtotal: "310", line_total: "360" },
        ],
        payment: { payment_method: "MPESA", amount: "2160", paid_at: day(0), trans_id: "SKJ7HQ2X9L" },
    },
};

createServer((req, res) => {
    const path = (req.url ?? "").split("?")[0];
    const key = `${req.method} ${path}`;

    res.setHeader("Content-Type", "application/json");

    if (ROUTES[key]) {
        res.end(JSON.stringify(ROUTES[key]));
        return;
    }

    if (req.method === "POST" || req.method === "PUT" || req.method === "DELETE") {
        res.end(JSON.stringify({ ok: true, trans_id: "SKJ7HQ0TEST" }));
        return;
    }

    res.statusCode = 404;
    res.end(JSON.stringify({ error: `No mock for ${key}` }));
}).listen(PORT, () => console.log(`mock API on http://localhost:${PORT}`));
