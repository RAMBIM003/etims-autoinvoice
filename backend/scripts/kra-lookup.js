// Usage (from C:\etims\backend):
//   node scripts\kra-lookup.js classes "fuel|petrol|diesel|wash"
//   node scripts\kra-lookup.js codes            (lists code classes)
//   node scripts\kra-lookup.js codes 10         (lists codes in class 10)
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '../.env') });

const base = (
    process.env.OSCU_BASE_URL || 'https://etims-api-sbx.kra.go.ke/etims-api'
).replace(/\/+$/, '');

async function call(endpoint) {
    const e = process.env;
    const bhfId = e.KRA_BRANCH_ID || '00';

    const response = await fetch(base + endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            tin: e.KRA_PIN,
            bhfId,
            cmcKey: e.KRA_CMC_KEY
        },
        body: JSON.stringify({
            tin: e.KRA_PIN,
            bhfId,
            lastReqDt: '20180523000000'
        })
    });

    return response.json().catch(() => ({}));
}

(async () => {
    const [mode, term] = process.argv.slice(2);

    if (mode === 'classes') {
        const j = await call('/selectItemClsList');
        const list = j.data?.itemClsList || [];
        const re = new RegExp(term || '.', 'i');

        console.log('KRA:', j.resultCd, j.resultMsg, '| total:', list.length);

        list
            .filter(x => re.test(x.itemClsNm || ''))
            .slice(0, 40)
            .forEach(x =>
                console.log(x.itemClsCd, '|', x.itemClsNm, '| level', x.itemClsLvl, '|', x.taxTyCd || '-')
            );
    } else if (mode === 'codes') {
        const j = await call('/selectCodeList');
        const classes = j.data?.clsList || [];

        console.log('KRA:', j.resultCd, j.resultMsg);

        if (!term) {
            classes.forEach(c => console.log(c.cdCls, '|', c.cdClsNm));
            return;
        }

        const found = classes.find(c => String(c.cdCls) === String(term));

        if (!found) {
            console.log('No code class', term);
            return;
        }

        console.log('Class', found.cdCls, '-', found.cdClsNm);
        (found.dtlList || []).forEach(d => console.log(d.cd, '|', d.cdNm));
    } else {
        console.log('Usage: node scripts\\kra-lookup.js classes "<regex>" | codes [classNumber]');
    }
})().catch(e => console.log('ERR', e.cause || e.message));
