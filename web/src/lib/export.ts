/**
 * Table exports that need no server: a CSV download and a print-formatted
 * report. Both take the rows the user is looking at (after search and
 * filters, across every page) and the same column list.
 */

export type ExportColumn<T> = {
    header: string;
    /** Display text for the printed report. */
    value: (row: T) => string;
    /** Raw value for the CSV, when the display text is not it (amounts, dates). */
    csv?: (row: T) => string | number;
    align?: "right";
    mono?: boolean;
};

export type ReportMeta = {
    title: string;
    /** Business name, PIN and similar, under the title. */
    subtitle?: string;
    /** Label/value pairs above the table: filters, totals. */
    facts?: [string, string][];
    /** The row under the table, one cell per column ("" for none). */
    totals?: string[];
    /** Becomes the suggested file name when the report is saved as a PDF. */
    fileName: string;
};

/** "2026-10-29", for file names. */
export function today() {
    return new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Nairobi" });
}

/** "2026-10-29 11:49" in Nairobi time: sorts as text, and Excel reads it as a date. */
export function csvDate(value: unknown) {
    const d = new Date(String(value ?? ""));

    if (!value || Number.isNaN(d.getTime())) return "";

    return d.toLocaleString("sv-SE", { timeZone: "Africa/Nairobi" }).slice(0, 16);
}

function csvCell(value: string | number) {
    const text = String(value ?? "");

    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function downloadCsv<T>(rows: T[], columns: ExportColumn<T>[], fileName: string) {
    const lines = [
        columns.map((c) => csvCell(c.header)).join(","),
        ...rows.map((row) => columns.map((c) => csvCell((c.csv ?? c.value)(row))).join(",")),
    ];

    /* The byte-order mark makes Excel read the file as UTF-8 rather than mangling "–" and "·". */
    const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = Object.assign(document.createElement("a"), { href: url, download: `${fileName}.csv` });

    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}

const escape = (text: string) =>
    text.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);

/* Plain black on white whatever the app theme is: it is going on paper. */
const PRINT_CSS = `
@page { size: A4 landscape; margin: 14mm 12mm 16mm;
  @bottom-left { content: "eTIMS AutoInvoice"; font: 9px system-ui, sans-serif; color: #666; }
  @bottom-right { content: "Page " counter(page) " of " counter(pages); font: 9px system-ui, sans-serif; color: #666; } }
* { box-sizing: border-box; }
body { margin: 0; font: 11px/1.4 system-ui, -apple-system, "Segoe UI", sans-serif; color: #111; background: #fff; }
header { display: flex; justify-content: space-between; align-items: flex-end; gap: 24px;
  border-bottom: 2px solid #111; padding-bottom: 8px; margin-bottom: 10px; }
h1 { font-size: 18px; margin: 0; }
.sub { color: #555; margin-top: 2px; }
.generated { color: #555; text-align: right; white-space: nowrap; }
dl { display: flex; flex-wrap: wrap; gap: 6px 28px; margin: 0 0 12px; }
dt { color: #666; font-size: 9px; text-transform: uppercase; letter-spacing: .04em; }
dd { margin: 0; font-weight: 600; }
table { width: 100%; border-collapse: collapse; }
thead { display: table-header-group; }
tr { break-inside: avoid; }
th { text-align: left; font-size: 9px; text-transform: uppercase; letter-spacing: .04em; color: #444;
  border-bottom: 1px solid #111; padding: 5px 6px; }
td { border-bottom: 1px solid #ddd; padding: 5px 6px; vertical-align: top; }
tbody tr:nth-child(even) td { background: #f6f6f6; }
tfoot td { border-top: 2px solid #111; border-bottom: 0; font-weight: 700; }
.r { text-align: right; font-variant-numeric: tabular-nums; }
.m { font-family: ui-monospace, Consolas, monospace; font-size: 10px; }
.n { color: #888; width: 1%; }
`;

export function printReport<T>(rows: T[], columns: ExportColumn<T>[], meta: ReportMeta) {
    const cls = (c: ExportColumn<T>) => [c.align === "right" ? "r" : "", c.mono ? "m" : ""].join(" ").trim();
    const generated = new Date().toLocaleString("en-KE", {
        timeZone: "Africa/Nairobi", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false,
    });

    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escape(meta.fileName)}</title><style>${PRINT_CSS}</style></head><body>
<header><div><h1>${escape(meta.title)}</h1>${meta.subtitle ? `<div class="sub">${escape(meta.subtitle)}</div>` : ""}</div>
<div class="generated">Generated ${escape(generated)} EAT</div></header>
${meta.facts?.length ? `<dl>${meta.facts.map(([k, v]) => `<div><dt>${escape(k)}</dt><dd>${escape(v)}</dd></div>`).join("")}</dl>` : ""}
<table><thead><tr><th class="n">#</th>${columns.map((c) => `<th class="${cls(c)}">${escape(c.header)}</th>`).join("")}</tr></thead>
<tbody>${rows.map((row, i) => `<tr><td class="n">${i + 1}</td>${columns.map((c) => `<td class="${cls(c)}">${escape(c.value(row))}</td>`).join("")}</tr>`).join("")}</tbody>
${meta.totals ? `<tfoot><tr><td></td>${meta.totals.map((t, i) => `<td class="${cls(columns[i]!)}">${escape(t)}</td>`).join("")}</tr></tfoot>` : ""}
</table></body></html>`;

    /* A hidden frame rather than a new window: no popup blocker, and the app
       page underneath is never restyled for print. */
    const frame = Object.assign(document.createElement("iframe"), { title: meta.title, srcdoc: html });

    /* afterprint is not guaranteed everywhere, so clear any frame a previous print left behind. */
    document.querySelectorAll("iframe[data-print-report]").forEach((old) => old.remove());
    frame.dataset.printReport = "";
    frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
    frame.onload = () => {
        const win = frame.contentWindow!;

        win.addEventListener("afterprint", () => frame.remove(), { once: true });
        win.focus();
        win.print();
    };
    document.body.append(frame);
}
