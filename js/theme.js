/* theme.js: light/dark switching and the mobile navigation drawer.

   Load this in <head>, NOT deferred. The first few lines run before the page
   paints, so a viewer who chose dark never sees a white flash.

   Three states are stored: "light", "dark", or nothing at all, which means
   "follow the device". The data-theme attribute is only set for an explicit
   choice, so the prefers-color-scheme rules in tokens.css keep working. */

(function () {
    'use strict';

    var KEY = 'etims-theme';

    // localStorage throws in a private window with site data blocked.
    function stored() {
        try { return localStorage.getItem(KEY); } catch (e) { return null; }
    }

    function remember(value) {
        try {
            if (value) localStorage.setItem(KEY, value);
            else localStorage.removeItem(KEY);
        } catch (e) { /* the choice just will not survive a reload */ }
    }

    function systemPrefersDark() {
        return window.matchMedia &&
            window.matchMedia('(prefers-color-scheme: dark)').matches;
    }

    function apply(choice) {
        var root = document.documentElement;

        if (choice === 'light' || choice === 'dark') root.setAttribute('data-theme', choice);
        else root.removeAttribute('data-theme');
    }

    // What the viewer is actually seeing, once the device preference is folded in.
    function resolved() {
        var choice = stored();

        if (choice === 'light' || choice === 'dark') return choice;

        return systemPrefersDark() ? 'dark' : 'light';
    }

    function announce() {
        var mode = resolved();

        document.querySelectorAll('.themebtn').forEach(function (btn) {
            btn.setAttribute(
                'aria-label',
                mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'
            );
            btn.setAttribute('title', btn.getAttribute('aria-label'));
        });

        window.dispatchEvent(new CustomEvent('themechange', { detail: { theme: mode } }));
    }

    function set(choice) {
        remember(choice === 'light' || choice === 'dark' ? choice : null);
        apply(choice);
        announce();
    }

    // Run now, before the body paints.
    apply(stored());

    // Follow the device while no explicit choice is stored.
    if (window.matchMedia) {
        var mq = window.matchMedia('(prefers-color-scheme: dark)');
        var onSystemChange = function () { if (!stored()) announce(); };

        if (mq.addEventListener) mq.addEventListener('change', onSystemChange);
        else if (mq.addListener) mq.addListener(onSystemChange);
    }

    window.Theme = {
        get: resolved,
        choice: stored,
        set: set,
        toggle: function () { set(resolved() === 'dark' ? 'light' : 'dark'); },
        matchDevice: function () { set(null); }
    };

    /* ---------- Shell wiring: theme button + mobile drawer ---------- */

    var SUN = '<svg class="i-sun" viewBox="0 0 24 24" aria-hidden="true">' +
        '<circle cx="12" cy="12" r="4.2"/>' +
        '<path d="M12 2.6v2.2M12 19.2v2.2M4.4 4.4l1.6 1.6M18 18l1.6 1.6M2.6 12h2.2M19.2 12h2.2M4.4 19.6L6 18M18 6l1.6-1.6"/>' +
        '</svg>';

    var MOON = '<svg class="i-moon" viewBox="0 0 24 24" aria-hidden="true">' +
        '<path d="M20.5 14.3A8.6 8.6 0 1 1 9.7 3.5a7 7 0 0 0 10.8 10.8z"/>' +
        '</svg>';

    var BURGER = '<svg viewBox="0 0 24 24" aria-hidden="true">' +
        '<path d="M3.5 6.5h17M3.5 12h17M3.5 17.5h17"/></svg>';

    function buildShell() {
        var top = document.querySelector('.top');
        var app = document.querySelector('.app');

        if (!top) return;

        // The theme button sits with the bell, in a flex group we create if needed.
        if (!top.querySelector('.themebtn')) {
            var acts = top.querySelector('.topacts');

            if (!acts) {
                acts = document.createElement('div');
                acts.className = 'topacts';

                // Move whatever already lives at the end of the bar (the bell) inside.
                var bell = top.querySelector('.bellwrap');

                top.appendChild(acts);
                if (bell) acts.appendChild(bell);
            }

            var btn = document.createElement('button');

            btn.type = 'button';
            btn.className = 'themebtn';
            btn.innerHTML = SUN + MOON;
            btn.addEventListener('click', window.Theme.toggle);
            acts.insertBefore(btn, acts.firstChild);
        }

        // The burger is hidden by CSS above 1000px, so it can always be present.
        if (app && !top.querySelector('.burger')) {
            var burger = document.createElement('button');

            burger.type = 'button';
            burger.className = 'burger';
            burger.innerHTML = BURGER;
            burger.setAttribute('aria-label', 'Open menu');
            burger.setAttribute('aria-expanded', 'false');
            top.insertBefore(burger, top.firstChild);

            var scrim = document.createElement('div');

            scrim.className = 'scrim';
            app.appendChild(scrim);

            var setOpen = function (open) {
                app.classList.toggle('navopen', open);
                burger.setAttribute('aria-expanded', open ? 'true' : 'false');
                burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
            };

            burger.addEventListener('click', function () {
                setOpen(!app.classList.contains('navopen'));
            });

            scrim.addEventListener('click', function () { setOpen(false); });

            document.addEventListener('keydown', function (e) {
                if (e.key === 'Escape') setOpen(false);
            });

            // Picking a destination closes the drawer; the view behind it changes.
            var side = document.querySelector('.side');

            if (side) {
                side.addEventListener('click', function (e) {
                    if (e.target.closest('.nav button, .helpcard')) setOpen(false);
                });
            }
        }

        announce();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', buildShell);
    } else {
        buildShell();
    }
}());
