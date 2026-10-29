import { notFound, redirect } from "next/navigation";

/**
 * Receipt links from the backend (and every SMS already sent) use the old
 * static site's form, /receipt?t=<token>. The receipt page here lives at
 * /receipt/<token>, so send the old form there instead of a 404.
 */
export default async function LegacyReceiptLink({
    searchParams,
}: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
    const { t } = await searchParams;
    const token = Array.isArray(t) ? t[0] : t;

    if (!token) notFound();

    redirect(`/receipt/${encodeURIComponent(token)}`);
}
