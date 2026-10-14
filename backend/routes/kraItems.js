const r = require('express').Router();
const db = require('../db');
const auth = require('../middleware/auth');
const wrap = require('../middleware/wrap');
const kraItems = require('../services/itemKraService');

const merchantFor = async userId => {
    const row = (
        await db.query(
            `SELECT merchant_id
             FROM merchant_users
             WHERE user_id = $1 AND status = 'ACTIVE'
             LIMIT 1`,
            [userId]
        )
    ).rows[0];

    if (!row) {
        throw Object.assign(new Error('Merchant account not found'), { status: 404 });
    }

    return row.merchant_id;
};

r.use(auth);

// Items with their KRA code and classification status.
r.get('/', wrap(async (q, s) => {
    const merchantId = await merchantFor(q.user.sub);
    s.json({ items: await kraItems.status(merchantId) });
}));

// Search KRA's classification list, e.g. /classes?q=lubric
r.get('/classes', wrap(async (q, s) => {
    await merchantFor(q.user.sub);

    const term = String(q.query.q || '').trim().toLowerCase();

    const list = (await kraItems.classes())
        .filter(x => x.useYn === 'Y')
        .filter(x =>
            !term ||
            String(x.itemClsNm || '').toLowerCase().includes(term) ||
            String(x.itemClsCd || '').startsWith(term)
        )
        .slice(0, 50)
        .map(x => ({
            code: x.itemClsCd,
            name: x.itemClsNm,
            level: x.itemClsLvl,
            tax_type: x.taxTyCd || null
        }));

    s.json({ classes: list });
}));

// Register one item with KRA before it can be sold.
r.post('/:itemId/register', wrap(async (q, s) => {
    const merchantId = await merchantFor(q.user.sub);
    const b = q.body || {};

    const out = await kraItems.registerItem({
        merchantId,
        itemId: q.params.itemId,
        classCode: String(b.item_cls_code || '').trim(),
        taxType: String(b.tax_type_code || '').trim().toUpperCase(),
        itemTypeCode: String(b.item_type_code || '2').trim()
    });

    s.status(out.already_registered ? 200 : 201).json(out);
}));

module.exports = r;
