// ==UserScript==
// @name         Gladiatus · Subasta y fundición beta
// @namespace    gladibot.beta.subasta
// @version      0.5.10
// @description  Beta independiente para personajes de servidores españoles.
// @match        https://*.gladiatus.gameforge.com/game/index.php*
// @grant        none
// ==/UserScript==
(() => {
  'use strict';
  // Beta: los módulos se activan por separado desde el panel.
  const READY_FOR_GAME = true;
  const ID = 'gladibot.beta.subasta.identity';
  const host=location.hostname.toLowerCase();
  if (!/^s\d+-es\.gladiatus\.gameforge\.com$/.test(host)) return;
  const params = new URLSearchParams(location.search);
  const normal = name => String(name || '').normalize('NFKC').trim().toLocaleLowerCase('es');
  const nameNode = () => document.querySelector('.playername_achievement,.playername.ellipsis,.player_name_bg .playername,.playername,#header_values_name,#header_values_playername,#avatar .char_name');
  const overview = params.get('mod')==='overview' && (!params.has('doll') || params.get('doll')==='0');
  let accountName='';
  if (overview) {
    const node=nameNode();
    if (node?.getClientRects().length) accountName=node.textContent.trim();
    if (accountName) sessionStorage.setItem(ID,JSON.stringify({name:accountName,host,at:Date.now()}));
  } else {
    try {const identity=JSON.parse(sessionStorage.getItem(ID));if(identity?.host===host && identity.name && Number.isFinite(identity.at) && Date.now()>=identity.at && Date.now()-identity.at<24*60*60*1000)accountName=identity.name;}catch{}
  }
  if (!accountName) {
    const notice=document.createElement('aside');
    notice.style.cssText='position:fixed;right:12px;bottom:12px;z-index:2147483000;background:#211b18;color:#f5e6c7;padding:12px;border:1px solid #a88150;font:14px sans-serif';
    notice.textContent='Subasta beta: abre Visión general de tu personaje para identificarlo.';
    document.body.append(notice);return;
  }
  const KEY='gladibot.beta.subasta.v2.'+host+'.'+encodeURIComponent(normal(accountName));
  const legacyKey='gladibot.beta.subasta.s62.comesagapitus.v1';
  if(host==='s62-es.gladiatus.gameforge.com' && normal(accountName)==='comesagapitus' && !localStorage.getItem(KEY)) {
    try {const previous=JSON.parse(localStorage.getItem(legacyKey));if(previous && typeof previous==='object') {previous.running=false;localStorage.setItem(KEY,JSON.stringify(previous));}}catch{}
  }
  const CATEGORIES = [8, 4, 5, 2, 3];
  const SALE_PRICE = 500;
  // Confirmado en edificios de alianza: cada nivel añade dos ofertas por miembro.
  const MARKET_CAPACITY_RULE_CONFIRMED = true;
  const MARKET_RECHECK_MS = 60*60*1000;
  const PACKAGE_FILTERS = [1, 2, 3, 4, 5, 8, 7, 20];
  const SMELT_TYPES = [1, 2, 3, 4, 5, 8];
  let state;
  try { state = JSON.parse(localStorage.getItem(KEY)) || {}; } catch { state = {}; }
  state.options = Object.assign({bid:false,bidUsable:false,sell:false,smelt:false,scroll:true}, state.options);
  // Solo se permite vender pergaminos al alquimista como respaldo cuando falta oro.
  state.options.scroll = false;
  state.options.sell = false; // La beta solo ejecuta subasta y fundición.
  state.needGold = state.needGold === true && Number.isSafeInteger(state.goldRequired) && state.goldRequired>0;
  if (state.scrollRecoveryV059!==true) {state.scrollRecoveryV059=true;state.scrollRetryAt=0;}
  if (state.itemTx?.kind==='sell' && !Number.isSafeInteger(state.itemTx.salePrice)) {
    if (state.itemTx.stage==='sold') state.itemTx.salePrice=5000;
    else if (state.itemTx.stage==='drop') {state.itemTx.blocked=true;state.itemTx.problem='Anuncio anterior a la actualización pendiente de revisión.';}
    else {state.itemTx.salePrice=SALE_PRICE;delete state.itemTx.before;delete state.itemTx.marketScan;}
  }
  if (state.itemTx && (state.itemTx.kind==='scroll' || state.itemTx.type===20 || ['npc','npcSold'].includes(state.itemTx.stage)) && state.itemTx.authorizedScroll!==true) {
    state.itemTx.blocked=true;state.itemTx.problem='Pergamino reservado: operación anterior detenida para revisión.';
  }
  state.bids = state.bids && typeof state.bids === 'object' ? state.bids : {};
  if (state.itemTx?.type===20 && ['market','drop','sold'].includes(state.itemTx.stage)) {
    state.itemTx.blocked=true;state.itemTx.problem='Venta anterior de pergamino requiere revisión; no se enviará a la alianza.';
  }
  if (!['auction','packages'].includes(state.phase)) state.phase='auction';
  state.message ||= 'Beta detenida.';
  const save = () => localStorage.setItem(KEY, JSON.stringify(state));
  const visible = e => !!e && e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden' && getComputedStyle(e).display !== 'none';
  const number = text => /^\d[\d.\s]*$/.test(String(text || '').trim()) ? Number(String(text).replace(/[.\s]/g,'')) : NaN;
  const balance = () => number(document.querySelector('#sstat_gold_val')?.textContent);
  const goldPageOpenedAt=Date.now();
  const verification = () => [...document.querySelectorAll('iframe[src*="captcha" i],iframe[src*="turnstile" i],.g-recaptcha,.h-captcha,.cf-turnstile,input[name*="captcha" i],[data-sitekey]')].some(visible);
  const noticeAttempts=new WeakMap();
  function handleNotice(dialog) {
    if (!visible(dialog)) { if (dialog) noticeAttempts.delete(dialog); return false; }
    const text=String(dialog.textContent||'').normalize('NFKC');
    if (/captcha|turnstile|verificaci[oó]n|verificar.{0,30}(?:humano|identidad|cuenta)|security\s*check/i.test(text)) { stop('Posible verificación detectada. Intervención humana requerida.'); return true; }
    const button=dialog.querySelector('#breakDiv, #linknotification'), handler=button?.getAttribute('onclick')||'';
    if (/\b(?:logro|logros|t[ií]tulo|t[ií]tulos|nivel)\b/i.test(text) && !/rub[ií]|diamant|premium|comprar|pagar|coste|precio/i.test(text) && visible(button) && !button.disabled && !button.form && /^(?:BUTTON|INPUT|DIV|SPAN)$/.test(button.tagName||'') && /^\s*blackoutDialog(?:notification)?\(\s*false\s*\)\s*;?\s*$/.test(handler)) {
      const previous=noticeAttempts.get(dialog);
      if (!previous) {noticeAttempts.set(dialog,Date.now());note('Cerrando aviso informativo del juego.');button.click();return true;}
      if (Date.now()-previous<15000) return true;
    }
    if (Date.now()>=(state.noticeRetryAt||0) && Date.now()-(state.navigationAt||0)>=5000) {
      state.noticeRetryAt=Date.now()+300000;save();
      navigate('#mainmenu a[href*="mod=overview"]','overview');
    }
    return true;
  }
  function note(text) { state.message=text; save(); render(); }
  function stop(text) { state.running=false; note(text); releaseControl(); }
  function sameAccount() {
    const node=nameNode(), name=node?.getClientRects().length ? node.textContent.trim() : '';
    if (overview && name) {
      if (normal(name)!==normal(accountName)) return false;
      sessionStorage.setItem(ID,JSON.stringify({name,host,at:Date.now()}));
      return true;
    }
    try { const x=JSON.parse(sessionStorage.getItem(ID)); return x.host===host && normal(x.name)===normal(accountName) && Date.now()-x.at<15*60*1000 && Date.now()>=x.at; } catch { return false; }
  }
  function allowedBidCategory(category, mode) {
    return (state.options.bid && CATEGORIES.includes(category) && (mode==='2'||mode==='3')) ||
      (state.options.bidUsable && category===7 && mode==='2');
  }
  function auctionPlan() {
    const plan=[];
    if(state.options.bid) for(const mode of ['2','3']) for(const category of CATEGORIES) plan.push({mode,category});
    if(state.options.bidUsable) plan.push({mode:'2',category:7});
    return plan;
  }
  function bidCandidate(form, category, gold) {
    const mode=params.get('ttype')||'2';
    if (!allowedBidCategory(category,mode) || !form || !/^auctionForm\d+$/.test(form.id)) return null;
    const item=form.querySelector('[data-basis]'), button=form.querySelector('input[name="bid"]');
    const amountField=form.querySelector('input[name="bid_amount"]');
    const type=Number((item?.getAttribute('data-basis') || '').match(/^(\d+)-\d+$/)?.[1]);
    const amount=Number(amountField?.value), id=form.id.slice('auctionForm'.length);
    const line=[...form.querySelectorAll('.auction_bid_div > div')].find(e=>/Puja mínima\s*:/i.test(e.textContent));
    const match=line?.textContent.match(/Puja mínima\s*:\s*([\d.\s\u00a0]+)/i);
    const minimum=match ? number(match[1].replace(/\u00a0/g,' ')) : NaN;
    let url; try { url=new URL(form.getAttribute('action'),location.href); } catch { return null; }
    // Además del historial persistente, respetar señales visibles de una puja propia.
    const formText=normal(form.textContent || '');
    const ownName=normal(accountName);
    if (state.pendingBid?.id===id || /tu oferta fue aceptada\./i.test(formText) ||
        (ownName && formText.includes(ownName)) ||
        type!==category || !visible(item) || !visible(button) || button.disabled || button.value!=='Ofrecer' ||
        !/^\d+$/.test(amountField?.value || '') || !Number.isSafeInteger(amount) || amount<=0 || amount!==minimum ||
        !Number.isSafeInteger(gold) || amount>gold || !line?.querySelector('img[title="Oro"]') ||
        url.origin!==location.origin || url.pathname!=='/game/index.php' || url.searchParams.get('mod')!=='auction' ||
        url.searchParams.get('submod')!=='placeBid' || url.searchParams.get('ttype')!==(params.get('ttype')||'2') || form.method.toLowerCase()!=='post' || state.bids[id]) return null;
    // El campo de compra inmediata nunca se modifica ni se envía.
    return {id,amount,button,name:form.getAttribute('data-item_name') || 'objeto'};
  }
  function confirmBid(form, tx, gold) {
    return !!form && /Tu oferta fue aceptada\./i.test(form.textContent || '') &&
      Number.isSafeInteger(gold) && gold===tx.balance-tx.amount;
  }
  function auctionTick() {
    if (params.get('mod')!=='auction') return false;
    const tx=state.pendingBid;
    if (tx) {
      const form=document.getElementById('auctionForm'+tx.id);
      if (confirmBid(form,tx,balance())) {
        state.bids[tx.id]={status:'accepted',at:Date.now(),amount:tx.amount};
        state.pendingBid=null; note('Puja aceptada: '+tx.name+'.'); return true;
      }
      if (Date.now()-tx.at>20000) {
        state.bids[tx.id]={status:'unknown',at:tx.at,amount:tx.amount};
        state.pendingBid=null; note('Puja sin confirmar; no se repetirá: '+tx.name+'.'); return true;
      }
      return true;
    }
    const select=document.querySelector('select[name="itemType"]');
    const category=Number(select?.value);
    if (!allowedBidCategory(category,params.get('ttype')||'2')) return false;
    const candidate=[...document.querySelectorAll('form[id^="auctionForm"]')].map(f=>bidCandidate(f,category,balance())).find(Boolean);
    if (!candidate) {
      const unaffordable=[...document.querySelectorAll('form[id^="auctionForm"]')].map(f=>bidCandidate(f,category,Number.MAX_SAFE_INTEGER)).find(Boolean);
      if (unaffordable && !state.goldClaim && Date.now()>=(state.goldRetryAt||0)) {state.needGold=true;state.goldRequired=unaffordable.amount;state.goldVisited=[];state.phase='packages';state.nextPackages=0;save();return true;}
      return false;
    }
    state.pendingBid={id:candidate.id,name:candidate.name,amount:candidate.amount,balance:balance(),at:Date.now()};
    note('Enviando puja en oro: '+candidate.name+'.');
    candidate.button.click(); return true;
  }
  function itemDetails(el) {
    if (!el || !visible(el)) return null;
    const basis=el.getAttribute('data-basis'), match=/^(\d+)-\d+$/.exec(basis || '');
    const hash=el.getAttribute('data-hash');
    let rows; try { rows=JSON.parse(el.getAttribute('data-tooltip'))?.[0]; } catch { return null; }
    const name=rows?.[0]?.[0], width=Number(el.getAttribute('data-measurement-x')), height=Number(el.getAttribute('data-measurement-y'));
    if (!match || typeof hash!=='string' || !hash || hash.length>256 || /[\x00-\x1f\x7f]/.test(hash) ||
        typeof name!=='string' || !name.trim() || !Number.isInteger(width) || !Number.isInteger(height) || width<1 || height<1) return null;
    const text=rows.flat(Infinity).filter(x=>typeof x==='string').join(' ');
    const linked=/Vinculado al alma de:/i.test(text) || !!el.getAttribute('data-soulbound-to');
    const classes=el.classList;
    const colors=['green','blue','purple','orange','red'].filter(c=>classes.contains('item-i-'+c));
    const quality=colors.length===0?'standard':colors.length===1?colors[0]:null;
    const value=Number(el.getAttribute('data-price-gold'));
    return {basis,type:Number(match[1]),contentType:el.getAttribute('data-content-type'),hash,name:name.trim(),width,height,linked,quality,value:Number.isSafeInteger(value)&&value>0?value:null,food:/En uso:\s*Cura\s+[\d.\s]+\s+punto\(s\) de vida/i.test(text),reserved: /pergamino|receta|herramienta|material(?:es)? de forja|tintura|poci[oó]n(?:es)? de percepci[oó]n/i.test(text) || el.getAttribute('data-reserved')==='true'};
  }
  function sellableUsable(item) { return !!item && item.type===7 && item.contentType==='64' && !item.linked && !item.reserved; }
  function packageKind(el) {
    const item=itemDetails(el);
    if (!item) return null;
    if (state.options.sell && sellableUsable(item)) return {...item,kind:'sell'};
    // Los pergaminos tienen filtro propio; no se confunde su filtro con data-basis.
    if (state.scrollNeeded && state.needGold && params.get('f')==='20' && item.type===20 && /^pergaminos?\b/i.test(item.name) && item.width===1 && item.height===1 && item.value) return {...item,kind:'scroll'};
    if (state.options.smelt && SMELT_TYPES.includes(item.type) && item.quality && !item.reserved) return {...item,kind:'smelt'};
    return null;
  }
  function bagSpace(inv, width, height) {
    if (!Number.isInteger(width) || !Number.isInteger(height) || width<1 || height<1) return false;
    const rect=inv?.getBoundingClientRect(), cols=inv?.offsetWidth/32, rows=inv?.offsetHeight/32;
    if (!rect || !Number.isInteger(cols) || !Number.isInteger(rows) || cols<width || rows<height || cols>20 || rows>20 || !Number.isFinite(rect.width) || !Number.isFinite(rect.height) || rect.width<=0 || rect.height<=0) return false;
    // MooTools reemplaza Array.from en Gladiatus y no acepta el mapeador nativo.
    // Misma construcción por bucles que usa goldSpace en el script principal.
    const occupied=[];
    for(let row=0;row<rows;row++){const cells=[];for(let col=0;col<cols;col++)cells.push(false);occupied.push(cells);}
    for (const el of inv.querySelectorAll('.ui-draggable')) {
      const r=el.getBoundingClientRect(), w=Number(el.getAttribute('data-measurement-x')), h=Number(el.getAttribute('data-measurement-y'));
      const dx=(r.left-rect.left)/(rect.width/cols), dy=(r.top-rect.top)/(rect.height/rows), x=Math.round(dx), y=Math.round(dy);
      if (!visible(el) || !Number.isInteger(w) || !Number.isInteger(h) || w<1 || h<1 || !Number.isFinite(dx) || !Number.isFinite(dy) || Math.abs(dx-x)>.1 || Math.abs(dy-y)>.1 || x<0 || y<0 || x+w>cols || y+h>rows) return false;
      for(let j=y;j<y+h;j++) for(let i=x;i<x+w;i++) { if(occupied[j][i]) return false; occupied[j][i]=true; }
    }
    for(let y=0;y<=rows-height;y++) for(let x=0;x<=cols-width;x++) {
      let free=true; for(let j=y;j<y+height;j++) for(let i=x;i<x+width;i++) if(occupied[j][i]) free=false;
      if(free) return true;
    }
    return false;
  }
  function drag(item,target) {
    const a=item?.getBoundingClientRect(),b=target?.getBoundingClientRect();
    if (!a || !b || a.width<=0 || a.height<=0 || b.width<=0 || b.height<=0) return false;
    const from={x:a.left+a.width/2,y:a.top+a.height/2},to={x:b.left+b.width/2,y:b.top+b.height/2};
    const event=(type,p,buttons=1)=>new MouseEvent(type,{bubbles:true,cancelable:true,view:window,clientX:p.x,clientY:p.y,button:0,buttons});
    item.dispatchEvent(event('mousedown',from));
    document.dispatchEvent(event('mousemove',{x:from.x+6,y:from.y+6}));
    for(let i=1;i<=4;i++) document.dispatchEvent(event('mousemove',{x:from.x+(to.x-from.x)*i/4,y:from.y+(to.y-from.y)*i/4}));
    document.dispatchEvent(event('mouseup',to,0)); return true;
  }
  function navigate(selector, expected, submod) {
    const link=[...document.querySelectorAll(selector)].find(e=>{ try { const href=e.getAttribute('href'); if(!href)return false; const u=new URL(href,location.href); const hiddenCity=expected==='auction' && selector==='#mainmenu a[href*="mod=auction"]' && e.closest('#mainmenu') && !u.searchParams.has('submod'); return (visible(e) || hiddenCity) && u.origin===location.origin && u.pathname==='/game/index.php' && u.searchParams.get('mod')===expected && (!submod || u.searchParams.get('submod')===submod) && !u.searchParams.has('action'); } catch { return false; } });
    if (!link) { note('Ruta no verificable: '+expected+'.'); return false; }
    if (Date.now()-(state.navigationAt||0)<5000) return true;
    state.navigationAt=Date.now(); save(); link.click(); return true;
  }
  function inventoryHash(hash) {
    const matches=[...document.querySelectorAll('#inv .ui-draggable[data-hash]')].filter(e=>e.getAttribute('data-hash')===hash);
    return matches.length===1 ? matches[0] : null;
  }
  function selectBag(number) {
    const bag=document.querySelector('#inventory_nav a[data-bag-number="'+number+'"]');
    if (!visible(bag) || bag.getAttribute('data-available')!=='true') return false;
    if (!bag.classList.contains('current')) { state.bagSwitch={number,at:Date.now()};save();bag.click();return false; }
    if(state.bagSwitch?.number===number && Date.now()-state.bagSwitch.at<3000)return false;
    const inv=document.querySelector('#inv');
    if(!inv || [...inv.querySelectorAll('.ui-draggable')].some(e=>e.getAttribute('data-container-number') && e.getAttribute('data-container-number')!==number))return false;
    if(state.bagSwitch){delete state.bagSwitch;save();}return true;
  }
  function finishItem(message) { state.itemTx=null; state.nextPackages=Date.now()+3000; if(state.options.smelt)state.forgeDue=0; note(message); }
  function waitItem(tx,message) {
    if (Date.now()-tx.at>25000) { tx.blocked=true; tx.problem=message; note(message); }
    return true;
  }
  function goldClaimTick() {
    const now=Date.now(), claim=state.goldClaim;
    if (claim && now<(claim.retryAt||0)) return false;
    if (params.get('mod')!=='packages') return navigate('#menue_packages','packages');
    if (params.get('f')!=='14') {
      const link=[...document.querySelectorAll('#mainnav a[href]')].find(a=>{try{const u=new URL(a.href,location.href);return visible(a)&&u.origin===location.origin&&u.pathname==='/game/index.php'&&u.searchParams.get('mod')==='packages'&&u.searchParams.get('f')==='14'&&!u.searchParams.has('fq');}catch{return false;}});
      if(!link){
        const form=document.querySelector('#pf'),query=form?.querySelector('input[name="qry"]'),filter=form?.querySelector('select[name="f"]'),quality=form?.querySelector('select[name="fq"]'),submit=form?.querySelector('[type="submit"]');let url;
        try {url=new URL(form?.getAttribute('action'),location.href);}catch{}
        const option=[...(filter?.options||[])].find(o=>o.value==='14' && /^oro$/i.test(o.textContent.trim()));
        if(!url || url.origin!==location.origin || url.pathname!=='/game/index.php' || url.searchParams.get('mod')!=='packages' || url.searchParams.get('submod')!=='search' || String(form.method).toLowerCase()!=='post' || !query || !quality || !option || !visible(submit) || submit.disabled){state.goldRetryAt=now+120000;state.needGold=false;note('Filtro Oro no verificable; lo revisaré más tarde.');return false;}
        if(now-(state.navigationAt||0)<5000)return true;
        query.value='';filter.value='14';quality.value='-1';
        if(filter.value!=='14'||quality.value!=='-1'){state.goldRetryAt=now+120000;state.needGold=false;note('Filtro Oro no disponible.');return false;}
        state.navigationAt=now;save();submit.click();return true;
      }
      if(now-(state.navigationAt||0)<5000)return true;
      state.navigationAt=now;save();link.click();return true;
    }
    const box=document.querySelector('#packages'), gold=balance();
    if (!box || !Number.isSafeInteger(gold)) return true;
    const key=[params.get('f'),params.get('page')||'1'].join(':');
    if(state.goldScan?.key!==key){state.goldScan={key,at:now};save();return true;}
    if(now-goldPageOpenedAt<3000 || now-state.goldScan.at<3000)return true;
    const items=[...box.querySelectorAll('.packageItem .ui-draggable[data-hash]')];
    if(claim){
      if ((params.get('page')||'1')!==claim.page) {
        claim.retryAt=now+120000;state.needGold=false;state.goldRetryAt=claim.retryAt;note('El cobro pendiente está en otra página; no se repetirá.');return false;
      }
      const matches=items.filter(e=>e.getAttribute('data-hash')===claim.hash);
      if(matches.length===0 && gold===claim.balanceBefore+claim.amount){
        state.goldClaim=null;delete state.goldScan;
        state.needGold=Number.isSafeInteger(state.goldRequired) && gold<state.goldRequired;
        if(!state.needGold) {state.goldRequired=null;state.goldRetryAt=0;}
        note('Cobro de oro confirmado: '+claim.amount.toLocaleString('es-ES')+'.');return true;
      }
      if(now-claim.at>=25000){claim.retryAt=now+120000;state.needGold=false;state.goldRetryAt=claim.retryAt;note('Cobro de oro sin confirmar; no se repetirá.');return false;}
      return true;
    }
    if(Number.isSafeInteger(state.goldRequired) && gold>=state.goldRequired){state.needGold=false;state.goldRequired=null;save();return false;}
    const candidates=items.map(el=>{
      const hash=el.getAttribute('data-hash'), price=Number(el.getAttribute('data-price-gold')), amount=Number(el.getAttribute('data-amount'));
      const value=price*amount, origin=el.closest('.packageItem')?.textContent||'';
      return visible(el) && /\bMercado\b/i.test(origin) && el.hasAttribute('data-gca-flag_double-click-event') && typeof hash==='string' && hash.length>0 && hash.length<=256 && !/[\x00-\x1f\x7f]/.test(hash) && Number.isSafeInteger(price) && price>0 && Number.isSafeInteger(amount) && amount>0 && [SALE_PRICE,5000].includes(value) && Number.isSafeInteger(gold+value) ? {el,hash,amount:value} : null;
    }).filter(Boolean);
    const candidate=candidates.find(x=>items.filter(el=>el.getAttribute('data-hash')===x.hash).length===1);
    if(!candidate){
      const current=Number(params.get('page')||'1'),visited=Array.isArray(state.goldVisited)?state.goldVisited:[];
      const next=[...document.querySelectorAll('.paging_right_step[href],.paging_right_step a[href]')].find(el=>{
        try {const u=new URL(el.getAttribute('href'),location.href),page=Number(u.searchParams.get('page'));return visible(el)&&u.origin===location.origin&&u.pathname==='/game/index.php'&&u.searchParams.get('mod')==='packages'&&u.searchParams.get('f')==='14'&&u.searchParams.getAll('page').length===1&&Number.isSafeInteger(current)&&Number.isSafeInteger(page)&&page>current&&page<=100&&!visited.includes(page)&&![...u.searchParams.keys()].some(k=>!['mod','f','fq','qry','sh','page'].includes(k));}catch{return false;}
      });
      if(next && visited.length<50){if(now-(state.navigationAt||0)<5000)return true;state.goldVisited=[...visited,current];state.navigationAt=now;save();next.click();return true;}
      state.goldVisited=[];
      if(state.needGold && !state.goldClaim && Date.now()>=(state.scrollRetryAt||0) && (state.options?.bid || state.options?.bidUsable || state.options?.smelt)){state.scrollNeeded=true;state.phase='packages';state.packageFilterIndex=0;state.nextPackages=0;note('Sin cobros de mercado; buscando pergaminos para obtener oro.');return false;}
      state.needGold=false;state.goldRetryAt=now+120000;note('Sin cobro de mercado verificable en el filtro Oro; revisaré más tarde.');return false;
    }
    state.goldClaim={hash:candidate.hash,amount:candidate.amount,balanceBefore:gold,page:params.get('page')||'1',at:now};
    note('Recogiendo oro de mercado; esperando confirmación.');
    candidate.el.dispatchEvent(new MouseEvent('dblclick',{bubbles:true,cancelable:true,view:window}));return true;
  }
  function scrollInventoryTick() {
    if (!state.needGold || !state.scrollNeeded || state.itemTx || state.suspendedScroll) return false;
    const inv=document.querySelector('#inv'),bag=document.querySelector('#inventory_nav a[data-bag-number="512"]');
    if (!inv || !visible(bag) || bag.getAttribute('data-available')!=='true') return false;
    if (!selectBag('512')) return true;
    const entries=[...inv.querySelectorAll('.ui-draggable[data-basis]')].map(el=>({el,item:itemDetails(el)})).filter(x=>x.item && x.item.type===20 && /^pergaminos?\b/i.test(x.item.name) && x.item.width===1 && x.item.height===1 && x.item.value && x.el.getAttribute('data-reserved')!=='true' && !state.blockedItems?.some(y=>y.hash===x.item.hash && (y.kind!=='scroll' || y.stage!=='npc')));
    const selected=entries.find(x=>entries.filter(y=>y.item.hash===x.item.hash).length===1 && inventoryHash(x.item.hash));
    if (!selected) return false;
    state.itemTx={...selected.item,kind:'scroll',authorizedScroll:true,bag:'512',stage:'npc',at:Date.now()};
    note('Pergamino localizado en baúl I: '+selected.item.name+'. Buscando vendedor.'); return true;
  }
  function packageTick() {
    const tx=state.itemTx;
    if (params.get('mod')!=='packages') return navigate('#menue_packages','packages');
    const inv=document.querySelector('#inv'), box=document.querySelector('#packages');
    if (!inv || !box) {if(tx)return waitItem(tx,'Paquetes o baúl no disponibles.');return false;}
    if (tx?.stage==='transfer') {
      if (!selectBag(tx.bag)) return waitItem(tx,'No se pudo abrir el baúl del paquete.');
      const item=inventoryHash(tx.hash), remaining=[...box.querySelectorAll('[data-hash]')].some(e=>e.getAttribute('data-hash')===tx.hash);
      if (item && !remaining) { tx.stage=tx.kind==='sell'?'market':tx.kind==='scroll'?'npc':'forge';tx.at=Date.now();note('Paquete recibido: '+tx.name+'.');return true; }
      return waitItem(tx,'Traslado no confirmado; no se repetirá.');
    }
    if (!tx && !state.scrollNeeded && state.options.sell && marketSaleAllowed() && Date.now()>=(state.sellRetryAt||0)) {
      const bag=document.querySelector('#inventory_nav a[data-bag-number="512"]');
      if (visible(bag) && bag.getAttribute('data-available')==='true') {
        if (!selectBag('512')) return true;
        const inventory=[...inv.querySelectorAll('.ui-draggable[data-basis]')].map(itemDetails).filter(Boolean);
        // Solo recuperar un intento anterior al envío, con precio conocido y objeto único presente.
        // Una operación en etapa sold o un identificador compartido conserva el bloqueo.
        const blocked=Array.isArray(state.blockedItems)?state.blockedItems:[];
        const safe=blocked.find(x=>x.kind==='sell' && x.stage==='drop' && x.salePrice===SALE_PRICE &&
          ['Objeto en mercado sin confirmar.','Tarifa de 24 h no verificable.','Formulario de venta no verificable.'].includes(x.problem) &&
          blocked.filter(y=>y.hash===x.hash).length===1 && inventory.filter(y=>y.hash===x.hash).length===1 &&
          inventory.some(y=>y.hash===x.hash && y.name===x.name && y.basis===x.basis && sellableUsable(y)));
        if(safe){state.blockedItems=blocked.filter(x=>x!==safe);state.itemTx={...safe,stage:'market',at:Date.now()};delete state.itemTx.blocked;delete state.itemTx.problem;delete state.itemTx.marketScan;delete state.itemTx.before;state.itemTx.capacityGranted=true;state.marketCapacity.permit=false;note('Revisando venta no enviada: '+safe.name+'.');return true;}
        const items=inventory.filter(item=>sellableUsable(item) && !state.blockedItems?.some(x=>x.hash===item.hash));
        const item=items.find(x=>items.filter(y=>y.hash===x.hash).length===1);
        if (item) {state.itemTx={...item,kind:'sell',salePrice:SALE_PRICE,bag:'512',stage:'market',at:Date.now()};state.itemTx.capacityGranted=true;state.marketCapacity.permit=false;note('Preparando venta del utilizable en baúl I: '+item.name+'.');return true;}
      }
    }
    // El DOM de paquetes y Crazy Addon llegan después de la navegación.
    // Una lista todavía sin cargar no es una página vacía.
    const scanKey=[params.get('f')||'0',params.get('page')||'1'].join(':');
    if(state.packageScan?.key!==scanKey){state.packageScan={key:scanKey,at:Date.now()};save();return true;}
    if(Date.now()-state.packageScan.at<3000)return true;
    const filters=state.needGold && state.scrollNeeded ? [20] : PACKAGE_FILTERS.filter(f=>f===7 ? state.options.sell && marketSaleAllowed() && Date.now()>=(state.sellRetryAt||0) : f===20 ? false : state.options.smelt && state.forgeHasFree!==false);
    if (!filters.length) { state.nextPackages=Date.now()+120000;save();return false; }
    const filter=filters[(state.packageFilterIndex||0)%filters.length];
    if (params.get('f')!==String(filter)) {
      const link=[...document.querySelectorAll('#mainnav a[href]')].find(a=>{try{const u=new URL(a.href,location.href);return visible(a)&&u.origin===location.origin&&u.searchParams.get('mod')==='packages'&&u.searchParams.get('f')===String(filter)&&!u.searchParams.has('fq');}catch{return false;}});
      if (!link && filter===20) {
        const form=document.querySelector('#pf'),query=form?.querySelector('input[name="qry"]'),select=form?.querySelector('select[name="f"]'),quality=form?.querySelector('select[name="fq"]'),submit=form?.querySelector('[type="submit"]');let url;
        try{url=new URL(form?.getAttribute('action'),location.href);}catch{}
        const option=[...(select?.options||[])].find(o=>o.value==='20' && /^pergaminos?$/i.test(o.textContent.trim()));
        if(!url||url.origin!==location.origin||url.pathname!=='/game/index.php'||url.searchParams.get('mod')!=='packages'||url.searchParams.get('submod')!=='search'||String(form.method).toLowerCase()!=='post'||!query||!quality||!option||!visible(submit)||submit.disabled){state.scrollNeeded=false;state.needGold=false;state.scrollRetryAt=Date.now()+120000;state.goldRetryAt=state.scrollRetryAt;note('Filtro de pergaminos no verificable; revisaré más tarde.');return false;}
        if(Date.now()-(state.navigationAt||0)<5000)return true;
        query.value='';select.value='20';quality.value='-1';
        if(select.value!=='20'||quality.value!=='-1'){state.scrollNeeded=false;state.needGold=false;state.scrollRetryAt=Date.now()+120000;state.goldRetryAt=state.scrollRetryAt;note('Filtro de pergaminos no disponible.');return false;}
        state.navigationAt=Date.now();save();submit.click();return true;
      }
      if (!link) {note('Filtro de paquetes no verificable.');return false;} if(Date.now()-(state.navigationAt||0)<5000)return true;
      state.navigationAt=Date.now();save();link.click();return true;
    }
    const candidates=[...box.querySelectorAll('.packageItem .ui-draggable[data-hash]')].map(el=>({el,item:packageKind(el)})).filter(x=>x.item && !state.blockedItems?.some(y=>y.hash===x.item.hash) && x.el.hasAttribute('data-gca-flag_double-click-event'));
    const bag=[7,20].includes(filter)?'512':'513';
    if (candidates.length && !selectBag(bag)) return true;
    // Un objeto sin hueco o con identidad repetida no debe bloquear otros paquetes.
    const candidate=candidates.find(x=>x.item.kind===(filter===20?'scroll':filter===7?'sell':'smelt') &&
      candidates.filter(y=>y.item.hash===x.item.hash).length===1 &&
      ![...inv.querySelectorAll('.ui-draggable[data-hash]')].some(el=>el.getAttribute('data-hash')===x.item.hash) &&
      bagSpace(inv,x.item.width,x.item.height));
    if (!candidate) {
      if (candidates.length) note('Sin paquete seguro con espacio en baúl '+(bag==='512'?'I':'II')+'; revisando siguiente tarea.');
      const next=document.querySelector('.paging_right_step');
      if (visible(next)) return navigate('.paging_right_step','packages');
      if(state.scrollNeeded){state.needGold=false;state.scrollNeeded=false;state.goldRetryAt=Date.now()+120000;state.scrollRetryAt=state.goldRetryAt;state.nextPackages=Date.now()+120000;note('Sin pergamino disponible; vuelvo a revisar más tarde.');return false;}
      state.packageFilterIndex=(state.packageFilterIndex||0)+1;
      if(state.packageFilterIndex>=filters.length){state.packageFilterIndex=0;state.nextPackages=Date.now()+120000;save();return false;}
      save();return true;
    }
    state.itemTx={...candidate.item,...(candidate.item.kind==='sell'?{salePrice:SALE_PRICE,capacityGranted:true}:candidate.item.kind==='scroll'?{authorizedScroll:true}:{}),bag,stage:'transfer',at:Date.now()};
    if(candidate.item.kind==='sell')state.marketCapacity.permit=false;
    note('Trasladando paquete de subasta: '+candidate.item.name+'.');
    candidate.el.dispatchEvent(new MouseEvent('dblclick',{bubbles:true,cancelable:true,view:window})); return true;
  }
  function forgeTick(tx) {
    if (params.get('mod')!=='forge' || params.get('submod')!=='smeltery') return navigate('#mainmenu a[href*="submod=smeltery"],#mainnav a[href*="submod=smeltery"]','forge','smeltery');
    if (!selectBag('513')) return true;
    const slots=[...document.querySelectorAll('#forge_nav > div')], active=slots.findIndex(e=>e.classList.contains('tabActive'));
    if (slots.length!==6 || active<0) return waitItem(tx,'Huecos de fundición no verificables.');
    if (tx.stage==='rent') {
      if (active===tx.slot && slots[active].classList.contains('forge_crafting') && !inventoryHash(tx.hash)) { finishItem('Fundición iniciada: '+tx.name+'.'); return true; }
      return waitItem(tx,'Fundición sin confirmar; no se repetirá el pago.');
    }
    if (tx.stage==='forge') {
      const slot=slots.findIndex(e=>e.classList.contains('forge_closed'));
      if (slot<0) { state.itemTx=null;state.forgeHasFree=false;state.forgeDue=Date.now()+60000;note('Fundición ocupada; revisaré más tarde y seguiré con otras tareas.');return false; }
      tx.slot=slot;tx.stage='place';tx.at=Date.now();save();return true;
    }
    if (active!==tx.slot) { slots[tx.slot].click(); return true; }
    if (!slots[tx.slot].classList.contains('forge_closed')) return waitItem(tx,'Hueco de fundición cambió.');
    const target=document.querySelector('#slot-closed #itembox'), displayed=target?.querySelector('[data-hash]');
    if (!tx.dragAt) {
      const el=inventoryHash(tx.hash), item=itemDetails(el);
      if (!item || item.hash!==tx.hash || item.basis!==tx.basis || item.name!==tx.name || item.quality!==tx.quality || !visible(target) || target.querySelector('[data-basis]')) return waitItem(tx,'Equipo no verificable para fundir.');
      tx.dragAt=Date.now();tx.at=Date.now();save();if(!drag(el,target)) {tx.blocked=true;note('No se pudo arrastrar a fundición.');}return true;
    }
    if (displayed?.getAttribute('data-hash')!==tx.hash) return waitItem(tx,'Arrastre a fundición sin confirmar.');
    const rent=document.querySelector('#slot-closed [data-rent="2"]'), cost=number(rent?.textContent), gold=balance();
    if (!visible(rent) || !rent.querySelector('.icon_gold') || rent.querySelector('.icon_rubies') || !Number.isSafeInteger(cost) || cost<=0 || !Number.isSafeInteger(gold) || !(document.querySelector('#forge_item_name')?.textContent||'').includes(tx.name)) return waitItem(tx,'Coste o equipo de fundición no verificable.');
    if(cost>gold && !state.goldClaim && Date.now()>=(state.goldRetryAt||0)){tx.neededCost=cost;state.suspendedSmelt=tx;state.itemTx=null;state.needGold=true;state.goldRequired=cost;state.goldVisited=[];state.phase='packages';state.nextPackages=0;note('Falta oro para fundir; buscando cobros de mercado.');return true;}
    if(cost>gold){tx.neededCost=cost;state.suspendedSmelt=tx;state.itemTx=null;state.forgeDue=Date.now()+60000;note('Falta oro para fundir; continuaré con otras tareas.');return false;}
    tx.stage='rent';tx.at=Date.now();tx.cost=cost;save();rent.click();return true;
  }
  function forgeReviewTick() {
    if(params.get('mod')!=='forge' || params.get('submod')!=='smeltery') return navigate('#mainmenu a[href*="submod=smeltery"],#mainnav a[href*="submod=smeltery"]','forge','smeltery');
    const slots=[...document.querySelectorAll('#forge_nav > div')],active=slots.findIndex(e=>e.classList.contains('tabActive'));
    if(slots.length!==6||active<0){note('No se pueden verificar los huecos de fundición.');state.forgeDue=Date.now()+60000;save();return false;}
    const pending=state.forgeSave;
    if(pending){
      if(slots[pending.slot]?.classList.contains('forge_closed')){state.forgeSave=null;note('Recursos guardados.');return true;}
      if(Date.now()-pending.at>20000){state.forgeSave.blocked=true;state.forgeDue=Date.now()+60000;note('Recogida sin confirmar; no se repetirá.');return false;}
      return true;
    }
    const finished=slots.findIndex(e=>e.classList.contains('forge_finished-succeeded'));
    if(finished<0){
      const free=slots.some(e=>e.classList.contains('forge_closed'));
      state.forgeHasFree=free;
      if(free){
        if(!selectBag('513')) return true;
        const inventory=[...document.querySelectorAll('#inv .ui-draggable[data-basis]')].map(itemDetails).filter(x=>x&&SMELT_TYPES.includes(x.type)&&x.quality&&!x.reserved&&!state.blockedItems?.some(y=>y.hash===x.hash));
        const item=inventory.find(x=>inventory.filter(y=>y.hash===x.hash).length===1);
        if(item){state.itemTx={...item,kind:'smelt',bag:'513',stage:'forge',at:Date.now()};save();return true;}
      }
      if(free && Date.now()>=(state.nextPackages||0))state.phase='packages';
      state.forgeDue=Date.now()+60000;save();return false;
    }
    if(active!==finished){slots[finished].click();return true;}
    const button=document.querySelector('#slot-finished-succeeded #forge_horreum');
    if(!visible(button)||button.textContent.trim()!=='Guardar recursos'){note('Control de recursos no verificable.');state.forgeDue=Date.now()+60000;save();return false;}
    state.forgeSave={slot:finished,at:Date.now()};save();button.click();return true;
  }
  function marketOwnCount(tx) {
    const table=document.querySelector('#market_item_table');
    const allowed=['mod','fl','fq','f','qry','seller','s','p','sh'];
    if (Date.now()-goldPageOpenedAt<3000 || params.getAll('p').length>1 || [...params.keys()].some(k=>!allowed.includes(k)) || (params.get('fl')||'0')!=='0' || (params.get('f')||'0')!=='0' || (params.get('fq')||'-1')!=='-1' || (params.get('qry')||'') || (params.get('seller')||'')) return null;
    if (!table) return (!params.has('p') || params.get('p')==='1') && /No hay resultados/i.test(document.querySelector('#content')?.textContent || '') ? 0 : null;
    const page=(document.querySelector('#content')?.textContent||'').match(/Página\s+(\d+)\s*\/\s*(\d+)/i);
    const current=page ? Number(page[1]) : 1,total=page ? Number(page[2]) : 1;
    const pageParams=params.getAll('p'),requested=pageParams.length ? Number(pageParams[0]) : 1;
    if(!Number.isSafeInteger(current) || current!==requested || total<current || total>100 || (!page && visible(document.querySelector('.paging_right_step')))) return null;
    const phase=tx.stage==='capacity'?'capacity':tx.stage==='sold'?'verify':'baseline';
    let scan=tx.marketScan;
    if (!scan || scan.phase!==phase) scan=tx.marketScan={phase,pages:[],count:0,fingerprints:{}};
    const go=target=>{
      const here=new URL(location.href),defaults={fl:'0',fq:'-1',f:'0',qry:'',seller:'',s:''};
      const link=[...document.querySelectorAll('a[href]')].find(a=>{try{const u=new URL(a.getAttribute('href'),location.href);return visible(a)&&u.origin===location.origin&&u.pathname==='/game/index.php'&&u.searchParams.get('mod')==='guildMarket'&&u.searchParams.getAll('p').length===1&&u.searchParams.get('p')===String(target)&&![...u.searchParams.keys()].some(k=>!allowed.includes(k))&&Object.keys(defaults).every(k=>(u.searchParams.get(k)??defaults[k])===(here.searchParams.get(k)??defaults[k]));}catch{return false;}});
      if(!link || Date.now()-(state.navigationAt||0)<5000)return false;
      state.navigationAt=Date.now();tx.at=Date.now();save();link.click();return true;
    };
    if(phase==='capacity'){if(scan.total!==undefined && scan.total!==total)return null;scan.total=total;}
    const expected=scan.pages.length ? scan.pages[scan.pages.length-1]+1 : 1;
    if(current!==expected){go(expected);return null;}
    const rows=[...table.querySelectorAll('tr')];
    const fingerprint=rows.map(row=>{const cells=row.cells||[],item=cells[0]?.querySelector('[data-basis]');return [cells[1]?.textContent?.trim(),cells[2]?.textContent?.trim(),item?.getAttribute('data-item-id')||item?.getAttribute('data-hash')||''].join('|');}).filter(x=>x!=='||').join('\n');
    if(fingerprint && Object.values(scan.fingerprints).includes(fingerprint)) return null;
    if(fingerprint)scan.fingerprints[current]=fingerprint;
    scan.count+=rows.filter(row=>{
      const cells=row.cells || [], item=itemDetails(cells[0]?.querySelector('[data-basis]'));
      if (phase==='capacity') return !!cells[0]?.querySelector('[data-basis]') && normal(cells[1]?.textContent)===normal(accountName);
      return item?.name===tx.name && item.basis===tx.basis && normal(cells[1]?.textContent)===normal(accountName) && number(cells[2]?.textContent)===tx.salePrice;
    }).length;
    scan.pages.push(current);tx.at=Date.now();save();
    if(current<total){go(current+1);return null;}
    const count=scan.count;delete tx.marketScan;save();return count;
  }
  function marketLevelFromLabels(labels) {
    const found=labels.filter(e=>visible(e) && /^Mercado de la alianza\s*\(\d+\)$/i.test(e.textContent.trim())).filter(e=>{
      try { const u=new URL(e.getAttribute('href'),location.href);return u.origin===location.origin && u.pathname==='/game/index.php' && u.searchParams.get('mod')==='guildMarket' && !u.searchParams.has('submod'); } catch { return false; }
    });
    if(found.length!==1)return null;
    const level=Number(found[0].textContent.match(/\((\d+)\)$/)[1]);
    return Number.isSafeInteger(level) && level>0 && level<=100 ? level : null;
  }
  function capacityResult(level,own,verified=MARKET_CAPACITY_RULE_CONFIRMED) {
    if(!verified || !Number.isSafeInteger(level) || level<1 || !Number.isSafeInteger(own) || own<0)return {level:level??null,own:own??null,maximum:null,free:null,status:'unknown'};
    const maximum=level*2,free=Math.max(0,maximum-own);
    return {level,own,maximum,free,status:free?'available':'full'};
  }
  function marketSaleAllowed() { const c=state.marketCapacity;return c?.status==='available' && c.permit===true && Number.isFinite(c.checkedAt) && Date.now()>=c.checkedAt && Date.now()-c.checkedAt<30000; }
  function marketCapacityTick() {
    const now=Date.now();let scan=state.marketCapacityScan;
    if(!scan && now<(state.marketCapacity?.nextCheckAt||0))return false;
    if(!scan){scan=state.marketCapacityScan={stage:'level',at:now};state.marketCapacity={status:'checking',level:null,own:null,maximum:null,free:null};save();}
    const defer=()=>{state.marketCapacity={...state.marketCapacity,status:'unknown',permit:false,checkedAt:now,nextCheckAt:now+MARKET_RECHECK_MS};delete state.marketCapacityScan;note('Capacidad del mercado sin verificar; revisión en 60 minutos.');return false;};
    if(now-scan.at>30000)return defer();
    if(scan.stage==='level'){
      if(params.get('mod')!=='guild' || params.has('submod'))return navigate('#mainmenu a[href*="mod=guild"]','guild') || defer();
      const level=marketLevelFromLabels([...document.querySelectorAll('a.map_label')]);
      if(!level)return defer();scan.level=level;scan.stage='count';scan.at=now;state.marketCapacity.level=level;save();
    }
    if(params.get('mod')!=='guildMarket' || params.has('submod'))return navigate('a.map_label[href*="mod=guildMarket"],#gca_shortcuts_bar a[href*="mod=guildMarket"]','guildMarket') || defer();
    scan.stage='capacity';const count=marketOwnCount(scan);if(!Number.isSafeInteger(count))return true;
    const result=capacityResult(scan.level,count);state.marketCapacity={...result,checkedAt:now,permit:result.status==='available',nextCheckAt:result.status==='available'?0:now+MARKET_RECHECK_MS};delete state.marketCapacityScan;
    if(result.status==='full' && (state.options?.bid || state.options?.bidUsable))state.phase='auction';
    note(result.status==='full'?'Mercado lleno; revisión en 60 minutos.':result.status==='available'?'Mercado con huecos disponibles.':'Capacidad del mercado sin verificar; revisión en 60 minutos.');return false;
  }
  function marketTick(tx) {
    if (params.get('mod')!=='guildMarket') return navigate('#gca_shortcuts_bar a[href*="mod=guildMarket"]','guildMarket');
    if (!selectBag('512')) return true;
    if (tx.stage==='sold') {
      const limit=[...document.querySelectorAll('[role=alert],.error,.error_msg,.notification.error')].filter(visible).some(e=>/(?:l[ií]mite|m[aá]ximo).{0,50}(?:ofertas|anuncios|objetos).{0,50}(?:mercado|alcanzad)|(?:mercado.{0,30}(?:lleno|saturado))/i.test(e.textContent||''));
      if(limit){state.marketCapacity={...(state.marketCapacity||{}),status:'full',permit:false,checkedAt:Date.now(),nextCheckAt:Date.now()+MARKET_RECHECK_MS};tx.blocked=true;tx.problem='Respuesta de límite: venta sin confirmar; no se repetirá.';if(state.options?.bid || state.options?.bidUsable)state.phase='auction';note(tx.problem);return true;}
      const count=marketOwnCount(tx);
      if (Number.isInteger(count) && count>tx.before && !inventoryHash(tx.hash)) { finishItem('Anuncio confirmado: '+tx.name+' por '+tx.salePrice.toLocaleString('es-ES')+' durante 24 h.'); return true; }
      return waitItem(tx,'Venta sin confirmar; no se repetirá.');
    }
    const target=document.querySelector('#market_sell .ui-droppable'), form=document.querySelector('#sellForm');
    if (tx.stage==='market') {
      const count=marketOwnCount(tx), item=inventoryHash(tx.hash), details=itemDetails(item);
      if (!Number.isInteger(count) || !sellableUsable(details) || details.name!==tx.name || details.basis!==tx.basis || !visible(target) || target.querySelector('[data-basis]')) return waitItem(tx,'Mercado u objeto no verificable antes de anunciar.');
      tx.before=count;tx.stage='drop';tx.at=Date.now();save();if(!drag(item,target)){tx.blocked=true;note('No se pudo arrastrar al mercado.');}return true;
    }
    const displayed=itemDetails(target?.querySelector('[data-basis]')), sellid=form?.querySelector('input[name="sellid"]');
    if (!sellableUsable(displayed) || displayed.name!==tx.name || displayed.basis!==tx.basis || !sellid?.value) return waitItem(tx,'Objeto en mercado sin confirmar.');
    const price=document.querySelector('#preis'), duration=document.querySelector('#dauer'), fee=document.querySelector('#marktgebuehren'), submit=form?.querySelector('input[name="anbieten"]');
    let url;try {url=new URL(form?.getAttribute('action'),location.href);}catch{return waitItem(tx,'Formulario de venta no verificable.');}
    if (!price || !duration || !fee || !visible(submit) || submit.disabled || url.origin!==location.origin || url.pathname!=='/game/index.php' || url.searchParams.get('mod')!=='guildMarket' || String(form.method).toLowerCase()!=='post' || /rub[ií]|diamant|premium/i.test(submit.outerHTML)) return waitItem(tx,'Formulario de venta no verificable.');
    duration.value='3';price.value=String(tx.salePrice);fee.textContent='';
    for(const [el,type] of [[duration,'change'],[price,'keyup']]) {const event=document.createEvent('Event');event.initEvent(type,true,false);el.dispatchEvent(event);}
    const cost=number(fee.textContent), gold=balance();
    if (duration.value!=='3' || !/^24\s*h/i.test(duration.selectedOptions?.[0]?.textContent||'') || tx.salePrice!==SALE_PRICE || price.value!==String(SALE_PRICE) || !Number.isSafeInteger(cost) || cost<=0 || !Number.isSafeInteger(gold) || cost>gold) return waitItem(tx,'Tarifa de 24 h no verificable.');
    tx.stage='sold';tx.at=Date.now();tx.fee=cost;save();submit.click();return true;
  }
  function shopFreeCell(shop) {
    const r=shop?.getBoundingClientRect(),cols=shop?.offsetWidth/32,rows=shop?.offsetHeight/32;
    if(!r || !Number.isInteger(cols) || !Number.isInteger(rows) || cols<1 || rows<1 || cols>20 || rows>20 || r.width<=0 || r.height<=0) return null;
    const w=r.width/cols,h=r.height/rows,occupied=[...shop.querySelectorAll('.ui-draggable')].filter(visible).map(e=>e.getBoundingClientRect());
    for(let y=0;y<rows;y++) for(let x=0;x<cols;x++) {
      const cell={left:r.left+x*w,top:r.top+y*h,width:w,height:h};cell.right=cell.left+w;cell.bottom=cell.top+h;
      if(!occupied.some(o=>cell.left<o.right && cell.right>o.left && cell.top<o.bottom && cell.bottom>o.top)) return {getBoundingClientRect:()=>cell};
    }
    return null;
  }
  function npcScrollTick(tx) {
    const vendors=[...document.querySelectorAll('#mainmenu a[href]')].map(e=>{try{const u=new URL(e.href,location.href),name=normal(e.textContent).replace(/\s+/g,' ');if(!visible(e)||!['alquimista','armero','herrero','mercenarios','mercenario','maléfica','malefica'].includes(name)||u.origin!==location.origin||u.pathname!=='/game/index.php'||u.searchParams.get('mod')!=='inventory'||!/^\d+$/.test(u.searchParams.get('sub')||'')||u.searchParams.has('action'))return null;return {el:e,sub:u.searchParams.get('sub')};}catch{return null;}}).filter(Boolean);
    if(!tx.vendorSub) tx.vendorSub=vendors.find(v=>params.get('mod')==='inventory'&&params.get('sub')===v.sub)?.sub || vendors.find(v=>v.sub==='4')?.sub || vendors[0]?.sub || '4';
    const page=params.get('mod')==='inventory' && params.get('sub')===tx.vendorSub;
    if(!page) {
      const vendor=vendors.find(v=>v.sub===tx.vendorSub) || vendors[0];
      if(!vendor){if(navigate('#mainmenu a.submenuswitch[href*="submod=city"]','map','city'))return true;return waitItem(tx,'Ruta al vendedor no disponible; se aplaza la venta.');}
      tx.vendorSub=vendor.sub;
      if(Date.now()-(state.navigationAt||0)<5000)return true;state.navigationAt=Date.now();save();vendor.el.click();return true;
    }
    if(params.get('subsub')!=='2') {
      const link=[...document.querySelectorAll('#shop_nav a[href]')].find(e=>{try{const u=new URL(e.href,location.href);return visible(e)&&u.origin===location.origin&&u.searchParams.get('mod')==='inventory'&&u.searchParams.get('sub')===tx.vendorSub&&u.searchParams.get('subsub')==='2';}catch{return false;}});
      if(!link)return waitItem(tx,'Pestaña de venta del alquimista no verificable; se aplaza la venta.');if(Date.now()-(state.navigationAt||0)<5000)return true;state.navigationAt=Date.now();save();link.click();return true;
    }
    if(!selectBag('512'))return waitItem(tx,'Baúl I no disponible para vender el pergamino.');
    const shop=document.querySelector('#shop');
    if(!visible(shop)||shop.getAttribute('data-container-number')!=='322')return waitItem(tx,'Zona de venta del alquimista no verificable.');
    if(tx.stage==='npcSold') {
      const sold=[...shop.querySelectorAll('[data-hash]')].filter(e=>e.getAttribute('data-hash')===tx.hash);
      if(!inventoryHash(tx.hash)&&sold.length===1&&balance()===tx.balanceBefore+tx.value){
        state.itemTx=null;state.scrollNeeded=false;state.scrollRetryAt=0;state.goldRetryAt=0;
        state.needGold=Number.isSafeInteger(state.goldRequired) && balance()<state.goldRequired;
        if(!state.needGold){state.goldRequired=null;if(state.suspendedSmelt){state.itemTx=state.suspendedSmelt;state.itemTx.stage='forge';state.itemTx.at=Date.now();delete state.itemTx.dragAt;delete state.suspendedSmelt;}}
        note('Pergamino vendido al vendedor por '+tx.value.toLocaleString('es-ES')+' de oro.');return true;
      }
      return waitItem(tx,'Venta al alquimista sin confirmar; no se repetirá.');
    }
    const el=inventoryHash(tx.hash), item=itemDetails(el), gold=balance();
    if(!item||item.type!==20||item.name!==tx.name||!/^pergaminos?\b/i.test(item.name)||item.value!==tx.value||item.width!==1||item.height!==1||!Number.isSafeInteger(gold)) return waitItem(tx,'Pergamino o valor no verificable.');
    const cell=shopFreeCell(shop);
    if(!cell)return waitItem(tx,'Sin casilla libre en venta del alquimista.');
    tx.stage='npcSold';tx.at=Date.now();tx.balanceBefore=gold;save();
    if(!drag(el,cell)){tx.blocked=true;note('Arrastre al alquimista no disponible.');}return true;
  }
  function auctionFilter(category) {
    const type=document.querySelector('select[name="itemType"]'), level=document.querySelector('select[name="itemLevel"]'), quality=document.querySelector('select[name="itemQuality"]');
    const form=type?.form, button=form?.querySelector('input[type="submit"],button[type="submit"]');
    if (!form || !level || !quality || !visible(button) || !allowedBidCategory(category,params.get('ttype')||'2')) {note('Filtro de subasta no verificable.');return false;}
    let url;try{url=new URL(form.getAttribute('action'),location.href);}catch{return false;}
    if(url.origin!==location.origin || url.pathname!=='/game/index.php' || url.searchParams.get('mod')!=='auction') {note('Destino del filtro no verificable.');return false;}
    const levels=[...level.options].map(o=>Number(o.value)).filter(Number.isSafeInteger);
    if(!levels.length || ![...type.options].some(o=>o.value===String(category)) || ![...quality.options].some(o=>o.value==='-1')) return false;
    level.value=String(Math.min(...levels));type.value=String(category);quality.value='-1';
    const query=form.querySelector('input[name="qry"]');if(query)query.value='';
    state.filterExpected=category;state.filterAt=Date.now();save();button.click();return true;
  }
  function ensureGoldForTasks() {
    const gold=balance(),now=Date.now();
    if (state.needGold || state.goldClaim || state.itemTx || state.suspendedScroll || state.pendingBid || now<(state.scrollRetryAt||0) || !(state.options.bid || state.options.bidUsable || state.options.smelt) || !Number.isSafeInteger(gold) || gold>=1000) return false;
    state.needGold=true;state.goldRequired=1000;state.scrollNeeded=true;state.phase='packages';state.packageFilterIndex=0;state.nextPackages=0;
    note('Oro inferior a 1.000; buscando pergaminos para continuar.');return true;
  }
  function runTick() {
    if (!state.running) return;
    if (verification()) return stop('CAPTCHA o verificación detectados. Intervención humana requerida.');
    if (!sameAccount()) {
      if(overview)return stop('No se pudo verificar el personaje.');
      return navigate('#mainmenu a[href*="mod=overview"]','overview');
    }
    if (handleNotice(document.querySelector('#blackoutDialognotification'))) return;
    if (state.itemTx?.kind==='sell' && !state.itemTx.blocked) {state.itemTx.blocked=true;state.itemTx.problem='Venta de alianza desactivada en esta versión.';save();}
    if (state.itemTx?.blocked && state.itemTx.kind==='scroll' && state.itemTx.stage==='npc') {
      state.suspendedScroll=state.itemTx;state.suspendedScroll.retryAt=Date.now()+120000;state.itemTx=null;
      note('Venta de pergamino aplazada; volveré a buscar al alquimista sin trasladar otro.');
    }
    if (state.suspendedScroll && !state.itemTx && Date.now()>=(state.suspendedScroll.retryAt||0)) {
      state.itemTx=state.suspendedScroll;delete state.suspendedScroll;delete state.itemTx.blocked;delete state.itemTx.problem;delete state.itemTx.retryAt;state.itemTx.at=Date.now();save();
    }
    if (state.itemTx?.blocked) {
      state.blockedItems=Array.isArray(state.blockedItems)?state.blockedItems:[];
      if(state.itemTx.kind==='sell')state.sellRetryAt=Date.now()+120000;
      state.blockedItems.push(state.itemTx);state.itemTx=null;save();
    }
    if (state.goldClaim && goldClaimTick()) return;
    if(!state.itemTx && state.suspendedSmelt && !state.needGold) {
      if(Number.isSafeInteger(balance()) && balance()>=state.suspendedSmelt.neededCost){state.itemTx=state.suspendedSmelt;state.itemTx.stage='forge';state.itemTx.at=Date.now();delete state.itemTx.dragAt;delete state.suspendedSmelt;save();}
      else if(!state.goldClaim && Date.now()>=(state.goldRetryAt||0)){state.needGold=true;state.goldRequired=state.suspendedSmelt.neededCost;state.goldVisited=[];state.phase='packages';state.nextPackages=0;save();}
    }
    const tx=state.itemTx;
    if (tx) {
      if(tx.kind==='smelt' && [6,9].includes(tx.type) && tx.stage!=='rent') {tx.blocked=true;tx.problem='Anillos y amuletos excluidos por configuración.';save();return;}
      if (tx.stage==='transfer') return packageTick();
      if (tx.kind==='sell' && ['market','drop'].includes(tx.stage) && !tx.capacityGranted) {state.suspendedSale=tx;state.itemTx=null;save();return;}
      if (['market','drop','sold'].includes(tx.stage)) return marketTick(tx);
      if (['npc','npcSold'].includes(tx.stage)) return npcScrollTick(tx);
      if (['forge','place','rent'].includes(tx.stage)) return forgeTick(tx);
      tx.blocked=true;tx.problem='Etapa no reconocida.';return save();
    }
    if (state.pendingBid) {
      if (params.get('mod')!=='auction') return navigate('#mainmenu a[href*="mod=auction"]','auction');
      return auctionTick();
    }
    ensureGoldForTasks();
    // Los cobros del mercado de alianza se recogen exclusivamente a mano.
    // Una transacción antigua aún se verifica arriba, pero nunca se inicia otra.
    if (state.needGold && !state.scrollNeeded && !state.goldClaim && Date.now()>=(state.scrollRetryAt||0)) {
      if (state.options.bid || state.options.bidUsable || state.options.smelt) {
        state.scrollNeeded=true;state.phase='packages';state.packageFilterIndex=0;state.nextPackages=0;
        note('Falta oro; buscando pergaminos. El dinero de alianza se recoge a mano.');
      } else {state.needGold=false;save();}
    }
    if (scrollInventoryTick()) return;
    // Una lectura ya iniciada debe terminar antes de que otra tarea cambie la página.
    if(state.options.sell && state.marketCapacityScan && marketCapacityTick()) return;
    if(state.options.smelt && !state.suspendedSmelt && !state.forgeSave?.blocked && Date.now()>=(state.forgeDue||0)) {
      if(forgeReviewTick()) return;
    }
    if(!state.options.bid && !state.options.bidUsable && state.phase==='auction') {state.phase='packages';save();}
    const saleDue=!!state.suspendedSale || (state.phase==='packages' && Date.now()>=(state.nextPackages||0));
    if(state.options.sell && !state.scrollNeeded && saleDue && !marketSaleAllowed() && marketCapacityTick()) return;
    if(state.options.sell && marketSaleAllowed() && state.suspendedSale && !state.itemTx){state.itemTx=state.suspendedSale;state.itemTx.capacityGranted=true;state.marketCapacity.permit=false;delete state.suspendedSale;save();return;}
    if (!state.suspendedScroll && state.phase==='packages' && (state.options.sell || state.options.smelt || state.scrollNeeded) && Date.now()>=(state.nextPackages||0)) {
      if (packageTick()) return;
      state.phase='auction';save();
    }
    if (!state.options.bid && !state.options.bidUsable) return;
    if (Date.now()<(state.auctionRetryAt||0)) return;
    if (params.get('mod')!=='auction') return navigate('#mainmenu a[href*="mod=auction"]','auction');
    const plan=auctionPlan();
    const index=Number.isInteger(state.auctionStep)&&state.auctionStep>=0&&state.auctionStep<plan.length?state.auctionStep:0;
    const {mode,category}=plan[index], currentMode=params.get('ttype')||'2';
    if(currentMode!==mode){
      const link=[...document.querySelectorAll('#mainnav a[href]')].find(a=>{try{const u=new URL(a.href,location.href);return visible(a)&&u.origin===location.origin&&u.searchParams.get('mod')==='auction'&&(u.searchParams.get('ttype')||'2')===mode;}catch{return false;}});
      if(!link){note('Subasta de '+(mode==='3'?'mercenarios':'gladiadores')+' no verificable.');return;}
      if(Date.now()-(state.navigationAt||0)<5000)return;state.navigationAt=Date.now();save();link.click();return;
    }
    const selected=Number(document.querySelector('select[name="itemType"]')?.value);
    if (state.filterExpected) {
      if (selected!==state.filterExpected) { if(Date.now()-state.filterAt>20000){delete state.filterExpected;delete state.filterAt;state.auctionRetryAt=Date.now()+120000;state.phase='packages';state.nextPackages=0;note('Filtro de subasta sin confirmar; continuaré con otras tareas y lo revisaré más tarde.');}return; }
      delete state.filterExpected;save();
    }
    if (selected!==category) return auctionFilter(category);
    if (auctionTick()) return;
    if ([...document.querySelectorAll('.paging_right_step[href], .paging_right_step a[href]')].some(visible)) return navigate('.paging_right_step[href], .paging_right_step a[href]','auction');
    state.auctionStep=(index+1)%plan.length;
    if(state.auctionStep===0){state.phase='packages';state.nextPackages=0;}
    save();
  }
  const panel=document.createElement('aside');
  panel.id='gladibot-auction-beta';
  panel.style.cssText='position:fixed;bottom:12px;right:12px;z-index:2147483000;background:#211b18;color:#f5e6c7;padding:12px;border:1px solid #a88150;border-radius:8px;font:14px sans-serif;max-width:310px';
  panel.innerHTML='<strong>Subasta y fundición · BETA</strong><div><label><input type="checkbox" data-option="bid"> Pujar equipo</label></div><div><label><input type="checkbox" data-option="bidUsable"> Pujar utilizables</label></div><div><label><input type="checkbox" data-option="smelt"> Fundición de equipo</label></div><button type="button" data-action="run">Iniciar</button><p data-message></p>';
  document.body.append(panel);
  function render() {
    for (const input of panel.querySelectorAll('[data-option]')) input.checked=!!state.options[input.dataset.option];
    panel.querySelector('[data-action="run"]').textContent=state.running?'Detener':'Iniciar';
    panel.querySelector('[data-message]').textContent=state.message;
  }
  panel.addEventListener('change', e => { if (e.target.dataset.option) { state.options[e.target.dataset.option]=e.target.checked; save(); } });
  let releaseLock=null, releaseGuard=null, hasLock=false, guardActive=false, acquireAbort=null;
  const controlKey='gladibot.beta.control.v1.'+host+'.'+encodeURIComponent(normal(accountName));
  const controlId=String(Date.now())+'-'+Math.random().toString(36).slice(2);
  function announceControl() { if(guardActive && state.running) localStorage.setItem(controlKey,JSON.stringify({id:controlId,until:Date.now()+45000})); }
  function releaseControl() {
    try {if(JSON.parse(localStorage.getItem(controlKey))?.id===controlId)localStorage.removeItem(controlKey);}catch{}
    acquireAbort?.abort(); acquireAbort=null;hasLock=false;guardActive=false;
    const release=releaseLock,guard=releaseGuard;releaseLock=null;releaseGuard=null;release?.();guard?.();
  }
  async function acquire() {
    if (!READY_FOR_GAME) return stop('Beta en desarrollo: falta validar los ciclos de venta y fundición.');
    if (!navigator.locks || !window.isSecureContext) return stop('Navegador sin bloqueo entre pestañas.');
    try {
      await navigator.locks.request('gladibot.beta.guard.'+encodeURIComponent(normal(accountName)),{mode:'exclusive',ifAvailable:true},guard=>{
        if(!guard) {state.running=false;render();panel.querySelector('[data-message]').textContent='La beta ya está activa en otra pestaña.';return;}
        guardActive=true;state.running=true;announceControl();note('Esperando que el bot principal termine su acción y ceda el control.');
        acquireAbort=new AbortController();
        navigator.locks.request('axelbot.evento.owner.'+encodeURIComponent(normal(accountName)),{mode:'exclusive',signal:acquireAbort.signal},lock=>{
          if(!guardActive || !state.running)return;
          hasLock=true;note('Beta activa; el bot principal reanudará cuando termine.');
          return new Promise(resolve=>{releaseLock=resolve;});
        }).catch(error=>{if(error?.name!=='AbortError')stop('No se pudo obtener el control de la cuenta.');});
        return new Promise(resolve=>{releaseGuard=resolve;});
      });
    } catch {stop('No se pudo obtener el bloqueo de cuenta.');}
  }
  panel.querySelector('[data-action="run"]').addEventListener('click', () => {
    if (state.running) {stop('Beta detenida.');return;}
    if (!sameAccount()) return stop('Abre Visión general para identificar tu personaje.');
    if (!Object.values(state.options).some(Boolean)) return stop('Selecciona al menos una función.');
    if (verification()) return stop('CAPTCHA o verificación detectados. Intervención humana requerida.');
    void acquire();
  });
  render();
  if (state.running) void acquire();
  window.addEventListener('pagehide',()=>{acquireAbort?.abort();hasLock=false;guardActive=false;releaseLock?.();releaseGuard?.();},{once:true});
  setInterval(announceControl,10000);
  setInterval(()=>{if(!hasLock || !state.running)return;try {runTick();} catch (error) {
    const kind=/^[A-Za-z]+Error$/.test(error?.name||'')?error.name:'Error';
    const fn=String(error?.stack||'').match(/\bat\s+(\w+)\s*\(/)?.[1]||'desconocida';
    stop('Error interno ('+kind+', '+fn+'). Operación pendiente conservada; revisa antes de continuar.');
  }},1500);
})();
