/**
 * Client for the Express API in ../backend. Next rewrites /api/* to it, so the
 * browser always talks to a same-origin path and no CORS preflight is needed.
 */

export class ApiError extends Error {
    status: number;

    constructor(message: string, status: number) {
        super(message);
        this.name = "ApiError";
        this.status = status;
    }
}

const TOKEN_KEY = "token";

export function getToken(): string | null {
    if (typeof window === "undefined") return null;

    try {
        return window.localStorage.getItem(TOKEN_KEY);
    } catch {
        return null;
    }
}

export function setToken(token: string) {
    try {
        window.localStorage.setItem(TOKEN_KEY, token);
    } catch {
        /* a private window just will not stay signed in across reloads */
    }
}

export function clearToken() {
    try {
        window.localStorage.removeItem(TOKEN_KEY);
    } catch {
        /* nothing to clear */
    }
}

type RequestOptions = Omit<RequestInit, "body"> & { body?: unknown };

export async function request<T = unknown>(path: string, options: RequestOptions = {}): Promise<T> {
    const { body, headers, ...rest } = options;
    const token = getToken();

    const init: RequestInit = {
        ...rest,
        headers: {
            ...(body === undefined ? {} : { "Content-Type": "application/json" }),
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(headers as Record<string, string>),
        },
    };

    if (body !== undefined) init.body = JSON.stringify(body);

    let response: Response;

    try {
        response = await fetch(`/api${path}`, init);
    } catch {
        throw new ApiError("Cannot reach the API. Check that the backend is running.", 0);
    }

    const data = await response.json().catch(() => ({}));

    if (response.status === 401) {
        clearToken();

        if (typeof window !== "undefined" && !window.location.pathname.startsWith("/sign-in")) {
            /* A full load, not a client transition: an expired session should
               leave nothing of the old one behind in memory. */
            window.location.assign(new URL("/sign-in", window.location.origin));
        }

        throw new ApiError("Your session has expired. Sign in again.", 401);
    }

    if (!response.ok) {
        const message =
            (data as Record<string, string>).error ||
            (data as Record<string, string>).message ||
            (data as Record<string, string>).ResultDesc ||
            `Request failed (${response.status})`;

        throw new ApiError(message, response.status);
    }

    return data as T;
}

const get = <T,>(path: string) => request<T>(path);
const post = <T,>(path: string, body?: unknown) => request<T>(path, { method: "POST", body });
const put = <T,>(path: string, body?: unknown) => request<T>(path, { method: "PUT", body });
const del = <T,>(path: string) => request<T>(path, { method: "DELETE" });

export const api = {
    /* Authentication and one-time passwords */
    sendOtp: (body: unknown) => post("/otp/send", body),
    verifyOtp: (body: unknown) => post("/otp/verify", body),
    login: (body: unknown) => post<{ token: string; role?: string }>("/auth/login", body),
    loginWithOtp: (body: unknown) => post<{ token: string; role?: string }>("/auth/login-otp", body),
    me: () => get<Record<string, unknown>>("/auth/me"),

    /* Registration and onboarding */
    registerMerchant: (body: unknown) => post("/merchant/register", body),
    registerBuyer: (body: unknown) => post("/buyer/register", body),
    validateKraPin: (body: unknown) => post("/kra/validate-pin", body),
    connectKra: (body: unknown) => post("/kra/connect", body),

    /* Merchant surfaces */
    dashboard: () => get<Record<string, unknown>>("/dashboard"),
    sales: () => get<unknown[]>("/sales"),
    sale: (id: string) => get(`/sales/${id}`),
    createSale: (body: unknown) => post("/sales", body),
    cancelSale: (id: string) => post(`/sales/${id}/cancel`),
    payments: () => get<unknown[]>("/payments"),
    payment: (id: string) => get(`/payments/${id}`),
    invoices: () => get<unknown[]>("/invoices"),
    invoice: (id: string) => get(`/invoices/${id}`),
    items: () => get<unknown[]>("/items"),
    createItem: (body: unknown) => post("/items", body),
    updateItem: (id: string, body: unknown) => put(`/items/${id}`, body),
    deleteItem: (id: string) => del(`/items/${id}`),
    kraItems: () => get<unknown[]>("/kra-items"),
    kraItemClasses: () => get<unknown[]>("/kra-items/classes"),
    registerKraItem: (itemId: string, body: unknown) => post(`/kra-items/${itemId}/register`, body),
    fiscalize: (saleId: string) => post(`/kra/fiscalize/${saleId}`),

    /* Connections */
    connections: () => get<Record<string, unknown>>("/connections"),
    checkKra: (body: unknown) => post("/connections/kra/check", body),
    registerMpesa: (body: unknown) => post("/connections/mpesa/register", body),

    /* Buyer surfaces */
    buyerProfile: () => get<Record<string, unknown>>("/buyer-app/profile"),
    buyerOrders: () => get<unknown[]>("/buyer-app/orders"),
    buyerOrderStatus: (id: string) => get(`/buyer-app/orders/${id}/status`),
    simulatePayment: (id: string) => post(`/buyer-app/orders/${id}/simulate-payment`),
    sendReceiptSms: (invoiceId: string) => post(`/buyer-app/receipts/${invoiceId}/sms`),
    buyerMerchants: () => get<unknown[]>("/buyer/merchants"),
    buyerMerchantItems: (id: string) => get<unknown[]>(`/buyer/merchants/${id}/items`),
    createBuyerOrder: (body: unknown) => post("/buyer/orders", body),
    mpesaIdentity: () => get<Record<string, unknown>>("/buyer-identity/mpesa"),
    saveMpesaIdentity: (body: unknown) => put("/buyer-identity/mpesa", body),
    clearMpesaIdentity: () => del("/buyer-identity/mpesa"),

    /* Public receipt and the payment simulator */
    publicReceipt: (token: string) => get<Record<string, unknown>>(`/receipts/public/${token}`),
    receiptLink: (invoiceId: string) => get<{ url?: string }>(`/receipts/link/${invoiceId}`),
    simulatorContext: () => get<Record<string, unknown>>("/simulator/context"),
    simulatorPay: (body: unknown) => post("/simulator/c2b", body),
    simulatorResult: () => get<Record<string, unknown>>("/simulator/result"),
};
