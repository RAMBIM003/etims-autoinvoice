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
 * The link is read from the address bar inside the effect and written straight
 * to the DOM, so the server and client render the same empty box.
 */
export function ReceiptQr() {
    const box = React.useRef<HTMLDivElement>(null);
    const [ready, setReady] = React.useState(false);

    React.useEffect(() => {
        const node = box.current;

        if (!ready || !node || !window.QRCode) return;

        node.replaceChildren();
        new window.QRCode(node, { text: window.location.href, width: 132, height: 132 });
    }, [ready]);

    return (
        <>
            <Script src="/qrcode.min.js" strategy="afterInteractive" onReady={() => setReady(true)} />
            <div className="grid gap-1.5 text-center">
                <div
                    ref={box}
                    aria-label="QR code linking to this receipt"
                    className="grid size-[132px] place-items-center rounded-lg bg-white p-1"
                />
                <span className="text-muted-foreground text-[10px]">Scan to open this receipt</span>
            </div>
        </>
    );
}
