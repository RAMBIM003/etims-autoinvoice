"use client";

import * as React from "react";
import Script from "next/script";

type QrConstructor = new (el: HTMLElement, options: { text: string; width: number; height: number }) => unknown;

declare global {
    interface Window {
        QRCode?: QrConstructor;
    }
}

/**
 * Sandbox note carried over from the original receipt page: this QR encodes the
 * receipt's own link, not KRA's official verification URL.
 *
 * With no `text`, the link is read from the address bar inside the effect and
 * written straight to the DOM, so the server and client render the same empty box.
 */
export function ReceiptQr({
    text,
    caption = "Scan to open this receipt",
    size = 132,
    onRendered,
}: {
    text?: string;
    caption?: string;
    size?: number;
    /** Called once the code is drawn, e.g. to print only after it is on the page. */
    onRendered?: () => void;
}) {
    const box = React.useRef<HTMLDivElement>(null);
    const [ready, setReady] = React.useState(false);
    const renderedRef = React.useRef(onRendered);

    React.useEffect(() => {
        renderedRef.current = onRendered;
    });

    React.useEffect(() => {
        const node = box.current;

        if (!ready || !node || !window.QRCode) return;

        node.replaceChildren();
        new window.QRCode(node, { text: text ?? window.location.href, width: size, height: size });
        renderedRef.current?.();
    }, [ready, text, size]);

    return (
        <>
            <Script src="/qrcode.min.js" strategy="afterInteractive" onReady={() => setReady(true)} />
            <div className="grid gap-1.5 text-center">
                <div
                    ref={box}
                    aria-label="QR code linking to this receipt"
                    className="grid place-items-center rounded-lg bg-white p-1"
                    style={{ width: size, height: size }}
                />
                <span className="text-muted-foreground text-[10px]">{caption}</span>
            </div>
        </>
    );
}
