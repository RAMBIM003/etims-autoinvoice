const $=i=>document.getElementById(i);
const say=t=>$('msg').textContent=t||'';

const d0=JSON.parse(sessionStorage.mdraft||'{}');
const b0=d0.business||{};

['biz','pin','bphone','btype','paybill','till'].forEach(k=>{
  const v={
    biz:b0.tradingName,
    pin:b0.pin,
    bphone:b0.phone,
    btype:b0.type,
    paybill:b0.paybill,
    till:b0.till
  }[k];

  if(v && $(k)) $(k).value=v;
});

$('f').onsubmit=e=>{
  e.preventDefault();

  const v=i=>$(i).value.trim();

  if(!v('biz'))
    return say('Enter the trading / business name.');

  const pin=v('pin').toUpperCase();

  if(!/^[AP]\d{9}[A-Z]$/.test(pin))
    return say('Enter a valid KRA PIN.');

  if(!API.phoneOk(v('bphone')))
    return say('Enter a valid business phone number.');

  if(!v('btype'))
    return say('Select the business type.');

  const ok=x=>/^\d{5,7}$/.test(x);

  if(
    (v('paybill')&&!ok(v('paybill'))) ||
    (v('till')&&!ok(v('till')))
  )
    return say('Paybill and Till numbers are 5 to 7 digits.');

  if(!ok(v('paybill'))&&!ok(v('till')))
    return say('Enter a Paybill or a Till number.');

  sessionStorage.mdraft=JSON.stringify({
    ...d0,
    business:{
      tradingName:v('biz'),
      pin,
      phone:v('bphone'),
      type:v('btype'),
      paybill:v('paybill'),
      till:v('till')
    }
  });

  location='sign_merchant.html';
};

say('');
