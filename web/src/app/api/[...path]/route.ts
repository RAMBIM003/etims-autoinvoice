import { type NextRequest } from "next/server";

/**
 * Proxies /api/* to the Express API in ../backend, the job nginx did before.
 *
 * This is a route handler rather than a `rewrites()` entry because rewrite
 * destinations are compiled into the build, which would mean rebuilding the
 * image to point at a different API host. Here API_ORIGIN is read per request,
 * so the same image works in compose, on a VPS, and locally.
 */
export const dynamic = "force-dynamic";

const API_ORIGIN = () => (process.env.API_ORIGIN ?? "http://localhost:5000").replace(/\/+$/, "");

/* Hop-by-hop headers must not be forwarded, and the upstream sets its own. */
const STRIP = new Set(["host", "connection", "keep-alive", "transfer-encoding", "upgrade", "content-length"]);

async function proxy(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
    const { path } = await context.params;
    const search = request.nextUrl.search;
    const target = `${API_ORIGIN()}/api/${path.map(encodeURIComponent).join("/")}${search}`;

    const headers = new Headers();

    request.headers.forEach((value, key) => {
        if (!STRIP.has(key.toLowerCase())) headers.set(key, value);
    });

    const hasBody = !["GET", "HEAD"].includes(request.method);

    let upstream: Response;

    try {
        upstream = await fetch(target, {
            method: request.method,
            headers,
            body: hasBody ? await request.arrayBuffer() : undefined,
            redirect: "manual",
            cache: "no-store",
        });
    } catch {
        return Response.json(
            { error: "The API is not reachable. Check that the backend is running." },
            { status: 502 }
        );
    }

    const responseHeaders = new Headers(upstream.headers);

    responseHeaders.delete("content-encoding");
    responseHeaders.delete("content-length");
    responseHeaders.delete("transfer-encoding");

    return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
export const HEAD = proxy;
export const OPTIONS = proxy;
