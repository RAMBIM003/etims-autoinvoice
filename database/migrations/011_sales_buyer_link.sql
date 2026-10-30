-- Records how a payment was linked to a buyer (buyerLinkService writes these).
-- Without them, the link step fails and the sale is left unlinked.
ALTER TABLE sales ADD COLUMN IF NOT EXISTS buyer_link_method text;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS buyer_link_detail text;
