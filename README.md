**Merchant dashboard**

merchant.html: the shell (sidebar, top bar). It changes for the new sidebar.
css/merchant.css: all the styling.
js/merchant-dash.js: the dashboard, the bell and the sidebar status.
js/merchant-views.js: Orders, Payments, Invoices, Items, Branches, Connections and Business Profile.
js/merchant-app.js: the router, and the status words and colours (this is where “Closed” turns red).
js/charts.js: the chart and the icons.

**Buyer dashboard**

buyer.html
js/buyer.js
css/merchant.css and js/charts.js are shared with the merchant side, so changes there affect both.

**Shared, probably small edits**

css/theme.css: base styles and colours.
js/api.js: only if we add new calls, such as a short order numbe
