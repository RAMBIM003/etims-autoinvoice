/**
 * Drives every route against the mock API in four combinations
 * (desktop/mobile × light/dark) and fails on:
 *   - any console error or uncaught page error
 *   - horizontal overflow of the document
 *   - a page that renders none of its expected text
 *
 * It then exercises the collapsible sidebar on desktop and mobile.
 *
 * Run: node test/e2e.mjs [baseUrl]
 */
import { createRequire } from "node:module";

/* Playwright is installed in the container's tool directory, not in this
   package, so it is resolved through require rather than a bare import. */
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH ?? "playwright");
import { mkdirSync } from "node:fs";

const BASE = process.argv[2] ?? "http://localhost:3100";
const SHOTS = process.env.SHOT_DIR;

if (SHOTS) mkdirSync(SHOTS, { recursive: true });

const ROUTES = [
    { path: "/", name: "landing", expect: "Payments in. Invoices out." },
    { path: "/sign-in", name: "sign-in", expect: "Sign in" },
    { path: "/sign-up", name: "sign-up", expect: "Which side of the counter" },
    { path: "/sign-up/merchant", name: "sign-up-merchant", expect: "Register your business" },
    { path: "/sign-up/buyer", name: "sign-up-buyer", expect: "Create a buyer account" },
    { path: "/onboarding", name: "onboarding", expect: "Connect your business" },
    { path: "/merchant", name: "merchant-dashboard", expect: "Sales overview" },
    { path: "/merchant/orders", name: "merchant-orders", expect: "ORD-10148" },
    { path: "/merchant/payments", name: "merchant-payments", expect: "SKJ7HQ2X9L" },
    { path: "/merchant/invoices", name: "merchant-invoices", expect: "INV-00148" },
    { path: "/merchant/items", name: "merchant-items", expect: "Maize flour 2kg" },
    { path: "/merchant/branches", name: "merchant-branches", expect: "Head office" },
    { path: "/merchant/connections", name: "merchant-connections", expect: "OSCU" },
    { path: "/merchant/profile", name: "merchant-profile", expect: "P051234567M" },
    { path: "/buyer", name: "buyer-purchases", expect: "Nairobits Supplies" },
    { path: "/buyer/receipts", name: "buyer-receipts", expect: "INV-00148" },
    { path: "/buyer/profile", name: "buyer-profile", expect: "Match my M-Pesa payments" },
    { path: "/receipt/demo-token", name: "receipt", expect: "OSCU-SBX-0442" },
    { path: "/simulator", name: "simulator", expect: "payment simulator" },
    { path: "/no-such-page", name: "not-found", expect: "404" },
];

const VIEWPORTS = [
    { tag: "desktop", width: 1440, height: 950 },
    { tag: "mobile", width: 390, height: 844 },
];

const failures = [];
const note = (msg) => failures.push(msg);

/* next/script and the dev overlay are noisy about favicons; ignore only those. */
const IGNORE = [/favicon/i, /Download the React DevTools/i];

async function newPage(browser, viewport, scheme) {
    const ctx = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        colorScheme: scheme,
        deviceScaleFactor: 1,
    });

    /* The app reads the bearer token from localStorage, so seed one. */
    await ctx.addInitScript(() => {
        try {
            window.localStorage.setItem("token", "test-token");
        } catch {}
    });

    const page = await ctx.newPage();
    const errors = [];

    page.on("console", (m) => {
        if (m.type() !== "error") return;
        const text = m.text();
        if (IGNORE.some((re) => re.test(text))) return;
        errors.push(text);
    });
    page.on("pageerror", (e) => errors.push(`UNCAUGHT ${e.message}`));

    return { ctx, page, errors };
}

async function run() {
    const browser = await chromium.launch({ args: ["--no-sandbox"] });

    for (const viewport of VIEWPORTS) {
        for (const scheme of ["light", "dark"]) {
            for (const route of ROUTES) {
                const { ctx, page, errors } = await newPage(browser, viewport, scheme);
                const label = `${route.name} [${viewport.tag}/${scheme}]`;

                try {
                    const response = await page.goto(`${BASE}${route.path}`, { waitUntil: "networkidle", timeout: 30000 });

                    if (route.name !== "not-found" && response && response.status() >= 500) {
                        note(`${label}: HTTP ${response.status()}`);
                    }

                    await page.waitForTimeout(500);

                    const body = await page.evaluate(() => document.body.innerText);

                    if (!body.toLowerCase().includes(route.expect.toLowerCase())) {
                        note(`${label}: expected text "${route.expect}" not found`);
                    }

                    const overflow = await page.evaluate(() => ({
                        scrollW: document.documentElement.scrollWidth,
                        clientW: document.documentElement.clientWidth,
                        dark: document.documentElement.classList.contains("dark"),
                        bg: getComputedStyle(document.body).backgroundColor,
                    }));

                    if (overflow.scrollW > overflow.clientW + 1) {
                        note(`${label}: horizontal overflow ${overflow.scrollW} > ${overflow.clientW}`);
                    }

                    if (scheme === "dark" && !overflow.dark) {
                        note(`${label}: dark scheme did not apply the dark class`);
                    }

                    if (overflow.bg === "rgba(0, 0, 0, 0)") {
                        note(`${label}: body has no background colour`);
                    }

                    /* The 404 page's own document request logs a console error
                       by design, so it is not counted against that route. */
                    const real = route.name === "not-found"
                        ? errors.filter((e) => !/404 \(Not Found\)/.test(e))
                        : errors;

                    if (real.length) note(`${label}: console ${JSON.stringify(real.slice(0, 2))}`);

                    if (SHOTS && viewport.tag === "desktop") {
                        await page.screenshot({ path: `${SHOTS}/${route.name}-${scheme}.png`, fullPage: true });
                    }

                    console.log(`  ok  ${label}`);
                } catch (error) {
                    note(`${label}: ${error.message}`);
                } finally {
                    await ctx.close();
                }
            }
        }
    }

    /* ---- The collapsible sidebar ---- */
    {
        const { ctx, page, errors } = await newPage(browser, VIEWPORTS[0], "light");

        await page.goto(`${BASE}/merchant`, { waitUntil: "networkidle" });

        const width = () => page.locator('[data-slot="sidebar-gap"]').evaluate((el) => el.getBoundingClientRect().width);

        const expanded = await width();

        await page.click('[data-sidebar="trigger"]');
        await page.waitForTimeout(400);

        const collapsed = await width();

        if (!(expanded > 200)) note(`sidebar: expanded width was ${expanded}, expected > 200`);
        if (!(collapsed > 40 && collapsed < 70)) note(`sidebar: collapsed width was ${collapsed}, expected an icon rail of ~56`);

        const state = await page.locator('[data-slot="sidebar"]').first().getAttribute("data-state");

        if (state !== "collapsed") note(`sidebar: data-state was "${state}" after collapsing`);

        const cookie = (await ctx.cookies()).find((c) => c.name === "etims_sidebar");

        if (cookie?.value !== "false") note(`sidebar: cookie was ${JSON.stringify(cookie?.value)}, expected "false"`);

        /* Collapsed, the labels must survive as tooltips. */
        await page.locator('[data-sidebar="menu-button"]').first().hover();
        await page.waitForTimeout(400);

        const tip = await page.locator('[data-slot="tooltip-content"]').count();

        if (!tip) note("sidebar: no tooltip shown for a collapsed menu item");

        /* Ctrl+B toggles it back. */
        await page.keyboard.press("Control+b");
        await page.waitForTimeout(400);

        if ((await width()) < 200) note("sidebar: Ctrl+B did not expand it again");

        if (errors.length) note(`sidebar: console ${JSON.stringify(errors.slice(0, 2))}`);

        console.log(`  ok  sidebar collapse (${Math.round(expanded)}px → ${Math.round(collapsed)}px rail)`);

        if (SHOTS) {
            await page.click('[data-sidebar="trigger"]');
            await page.waitForTimeout(400);
            await page.screenshot({ path: `${SHOTS}/sidebar-collapsed.png` });
        }

        await ctx.close();
    }

    /* ---- The sidebar as a sheet on mobile ---- */
    {
        const { ctx, page, errors } = await newPage(browser, VIEWPORTS[1], "dark");

        await page.goto(`${BASE}/merchant`, { waitUntil: "networkidle" });

        if (await page.locator('[data-slot="sidebar"][data-mobile="true"]').isVisible().catch(() => false)) {
            note("mobile sidebar: the drawer was open before the trigger was pressed");
        }

        await page.click('[data-sidebar="trigger"]');
        await page.waitForTimeout(500);

        const drawer = page.locator('[data-slot="sidebar"][data-mobile="true"]');

        if (!(await drawer.isVisible())) note("mobile sidebar: the drawer did not open");

        if (SHOTS) await page.screenshot({ path: `${SHOTS}/mobile-drawer.png` });

        await page.keyboard.press("Escape");
        await page.waitForTimeout(400);

        if (await drawer.isVisible().catch(() => false)) note("mobile sidebar: Escape did not close the drawer");

        if (errors.length) note(`mobile sidebar: console ${JSON.stringify(errors.slice(0, 2))}`);

        console.log("  ok  mobile drawer opens and closes");

        await ctx.close();
    }

    /* ---- The theme toggle persists across a reload ---- */
    {
        const { ctx, page, errors } = await newPage(browser, VIEWPORTS[0], "light");

        await page.goto(`${BASE}/sign-in`, { waitUntil: "networkidle" });
        await page.click('button[aria-label="Switch between light and dark mode"]');
        await page.waitForTimeout(300);

        if (!(await page.evaluate(() => document.documentElement.classList.contains("dark")))) {
            note("theme toggle: pressing it did not switch to dark");
        }

        await page.reload({ waitUntil: "networkidle" });
        await page.waitForTimeout(300);

        if (!(await page.evaluate(() => document.documentElement.classList.contains("dark")))) {
            note("theme toggle: the choice did not survive a reload");
        }

        if (errors.length) note(`theme toggle: console ${JSON.stringify(errors.slice(0, 2))}`);

        console.log("  ok  theme toggle persists across a reload");

        await ctx.close();
    }

    await browser.close();

    console.log("");

    if (failures.length) {
        console.log(`FAILED (${failures.length})`);
        failures.forEach((f) => console.log(`  - ${f}`));
        process.exit(1);
    }

    console.log(`PASSED — ${ROUTES.length} routes × ${VIEWPORTS.length} widths × 2 themes, plus sidebar and theme checks`);
}

run();
