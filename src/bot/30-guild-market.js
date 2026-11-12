  function goldItem(el) {
    if (!el) return null;
    let rows; try { rows=JSON.parse(el.getAttribute('data-tooltip'))?.[0]; } catch { return null; }
    if (!Array.isArray(rows)) return null;
    const texts=rows.flat(Infinity).filter(x=>typeof x==='string');
    const binding=texts.find(x=>/^Vinculado al alma de:/i.test(x));
    const name=Array.isArray(rows[0]) && typeof rows[0][0]==='string' ? rows[0][0].trim() : '';
    const owner=binding?.replace(/^Vinculado al alma de:\s*/i,'').trim() || null;
    const soul=el.getAttribute('data-soulbound-to'), basis=el.getAttribute('data-basis');
    if (!name || !/^\d+-\d+$/.test(basis||'') || (binding ? !owner || !/^\d+$/.test(soul||'') : !!soul)) return null;
    const width=Number(el.getAttribute('data-measurement-x')), height=Number(el.getAttribute('data-measurement-y'));
    if (el.getAttribute('data-level')!=='1' || !Number.isInteger(width) || !Number.isInteger(height) || width<1 || height<1 || width>8 || height>8) return null;
    // Materiales, pergaminos y herramientas nunca se manipulan como paquetes de oro.
    if (/^(?:1[2-8])-/.test(basis) || /pergamino|receta|herramienta|material de forja/i.test(name)) return null;
    return {name,owner,soul:soul || null,basis,width,height};
  }
  function goldSame(a,b) { return !!a && !!b && ['name','owner','soul','basis'].every(k=>a[k]===b[k]) && (b.width==null || (a.width===b.width && a.height===b.height)); }
  function goldBalance() { return parseGold(document.querySelector('#sstat_gold_val')?.textContent); }
  function goldBag(requireFree=true) {
    const inv=document.querySelector('#inv'), bag=document.querySelector('#inventory_nav a');
    if (!inv || !visible(bag)) return null;
    if (!bag.classList.contains('current')) { bag.click(); state.message='Seleccionando baúl I para el oro.'; save(); return null; }
    const items=[...inv.querySelectorAll('.ui-draggable[data-hash]')];
    if (items.some(x=>x.getAttribute('data-container-number') && x.getAttribute('data-container-number')!=='512')) return null;
    const box=inv.getBoundingClientRect();
    const capacity=Math.floor(box.width/32)*Math.floor(box.height/32);
    let occupied=0;
    for (const item of items) {
      const x=Number(item.getAttribute('data-measurement-x')), y=Number(item.getAttribute('data-measurement-y'));
      if (!Number.isInteger(x)||!Number.isInteger(y)||x<1||y<1) return null;
      occupied+=x*y;
    }
    return Number.isInteger(capacity)&&capacity>0&&occupied<=capacity&&(!requireFree||occupied<capacity) ? {inv,items} : null;
  }
  // Para objetos grandes, comprobar un rectángulo libre real. Los atributos de
  // posición pueden estar desactualizados tras un traslado; usar geometría visible.
  function goldSpace(bag,item) {
    const width=item?.width ?? 1, height=item?.height ?? 1;
    if (!bag || !Number.isInteger(width) || !Number.isInteger(height) || width<1 || height<1) return false;
    if (width===1 && height===1) return true; // goldBag ya comprobó una casilla libre.
    const box=bag.inv.getBoundingClientRect(), cols=Math.floor(box.width/32), rows=Math.floor(box.height/32);
    if (cols<width || rows<height || cols>20 || rows>20) return false;
    // MooTools sustituye Array.from y puede ignorar el segundo argumento.
    const used=[];
    for (let row=0;row<rows;row++) { const cells=[]; for (let col=0;col<cols;col++) cells.push(false); used.push(cells); }
    for (const el of bag.items) {
      if (!visible(el)) return false;
      const w=Number(el.getAttribute('data-measurement-x')),h=Number(el.getAttribute('data-measurement-y')),rect=el.getBoundingClientRect();
      const dx=(rect.left-box.left)/32,dy=(rect.top-box.top)/32,x=Math.round(dx),y=Math.round(dy);
      if (!Number.isInteger(w)||!Number.isInteger(h)||w<1||h<1||Math.abs(dx-x)>.1||Math.abs(dy-y)>.1||x<0||y<0||x+w>cols||y+h>rows) return false;
      for (let j=y;j<y+h;j++) for (let i=x;i<x+w;i++) { if (used[j][i]) return false; used[j][i]=true; }
    }
    for (let y=0;y<=rows-height;y++) for (let x=0;x<=cols-width;x++) {
      let free=true; for (let j=y;j<y+height;j++) for (let i=x;i<x+width;i++) if (used[j][i]) free=false;
      if (free) return true;
    }
    return false;
  }
  function goldFee(price) {
    const form=document.querySelector('#sellForm'), input=document.querySelector('#preis'), duration=document.querySelector('#dauer'), fee=document.querySelector('#marktgebuehren');
    if (!form || !input || !duration || !fee || !goldPriceAllowed(price) || !/calcDues\(\)/.test(input.getAttribute('onkeyup')||'') || !/calcDues\(\)/.test(duration.getAttribute('onchange')||'')) return null;
    try {
      duration.value='3'; input.value=String(price); fee.textContent='';
      // MooTools puede sustituir window.Event; el método nativo del documento no depende de él.
      for (const [element,type] of [[duration,'change'],[input,'keyup']]) {
        const event=document.createEvent('Event'); event.initEvent(type,true,false); element.dispatchEvent(event);
      }
    } catch { return null; }
    const amount=parseGold(fee.textContent);
    const durationLabel=duration.selectedOptions?.[0]?.textContent?.trim() || '';
    return duration.value==='3' && /^24\s*h(?:oras?)?$/i.test(durationLabel) && input.value===String(price) && Number.isSafeInteger(amount) && amount>0 ? amount : null;
  }
  function goldNav(selector,expected,purpose) {
    const link=document.querySelector(selector); let url;
    try { url=new URL(link?.getAttribute('href'),location.href); } catch { return false; }
    if (!visible(link) || url.origin!==location.origin || url.pathname!=='/game/index.php' || url.searchParams.get('mod')!==expected) return false;
    return navigation(link,purpose);
  }
  function goldPause(message) {
    if (state.goldTx) { state.goldTx.blocked=true; state.goldTx.problem=message; state.goldTx.retryAt=Date.now()+60000; }
    state.message='Oro: '+message+' Volveré a comprobarlo.'; log(state.message,'warn'); save();
  }
  function goldOffers() {
    const rows=[...document.querySelectorAll('#market_item_table tr')];
    return rows.map(row=>{
      const cells=[...(row.cells||[])], seller=cells[1]?.textContent.trim(), price=parseGold(cells[2]?.textContent), item=goldItem(cells[0]?.querySelector('[data-tooltip][data-basis]'));
      const button=row.querySelector('input[name="buy"]'), form=button?.form;
      let url; try { url=new URL(form?.getAttribute('action'),location.href); } catch { return null; }
      if (!seller || seller.normalize('NFKC').toLocaleLowerCase()===accountName.normalize('NFKC').toLocaleLowerCase() || !goldPriceAllowed(price) || cells[4]?.textContent.trim()!=='1' || !item || !visible(button) || button.disabled || button.value!=='Comprar') return null;
      const notice=form.getAttribute('data-confirm-message');
      if (url.origin!==location.origin || url.pathname!=='/game/index.php' || url.searchParams.get('mod')!=='guildMarket' || String(form.method).toLowerCase()!=='post' || (item.owner ? notice!=='Este objeto está vinculado al alma' : notice!==null) || /rub[ií]|diamant|premium/i.test(button.outerHTML+' '+row.textContent)) return null;
      return {seller,price,item,button};
    }).filter(Boolean).sort((a,b)=>b.price-a.price);
  }
  function goldOwnCount(item,price) {
    return [...document.querySelectorAll('#market_item_table tr')].filter(row=>{
      const cells=[...(row.cells||[])];
      return cells[1]?.textContent.trim().normalize('NFKC').toLocaleLowerCase()===accountName.normalize('NFKC').toLocaleLowerCase() && parseGold(cells[2]?.textContent)===price && /^(?:23:\d{2}|24(?::00)?)\s*h$/i.test(cells[3]?.textContent.trim()||'') && goldSame(goldItem(cells[0]?.querySelector('[data-tooltip][data-basis]')),item) && !!row.querySelector('input[value="Cancelar"]');
    }).length;
  }
  function goldTick(pendingOnly=false) {
    const tx=state.goldTx;
    if (state.goldPreviousReview===true) return false;
    const now=Date.now(), balance=goldBalance();
    if (tx?.blocked) {
      // Compatibilidad con operaciones bloqueadas por versiones anteriores.
      if (!Number.isFinite(tx.retryAt)) tx.retryAt=now;
      if (now<tx.retryAt) return false;
      tx.blocked=false; tx.at=now; delete tx.retryAt; delete tx.loadedAt;
      if (tx.stage==='drop') tx.stage='market'; // El arrastre no publica ni consume oro.
      state.goldEnabled=true; state.message='Revisando la operación de oro pendiente.'; log(state.message); save();
    }
    if (!tx && (!state.goldEnabled || pendingOnly)) return false;
    if (tx && (!Number.isFinite(tx.at) || now-tx.at>60000)) { goldPause('Operación sin confirmar.'); return false; }
    if (!tx) {
      if (!Number.isSafeInteger(balance) || balance<=200000 || now<(state.goldCheckAt||0)) return false;
      if (mod!=='guildMarket') {
        const link=document.querySelector('#gca_shortcuts_bar a[href*="mod=guildMarket"]');
        if (!visible(link)) { state.goldCheckAt=now+60000; save(); return false; }
        if (!goldNav('#gca_shortcuts_bar a[href*="mod=guildMarket"]','guildMarket','Revisando paquetes de oro de la alianza.')) { state.goldCheckAt=now+15000; save(); return false; }
        return true;
      }
      if (now-goldPageOpenedAt<5000) { state.message='Esperando a que cargue el baúl I y el mercado.'; save(); return true; }
      const availableBag=goldBag();
      if (!availableBag) { state.goldCheckAt=now+60000; state.message='Baúl I sin espacio verificable; revisaré el oro más tarde.'; save(); return false; }
      let chosen=null, fee=null;
      for (const offer of goldOffers()) {
        if (!goldSpace(availableBag,offer.item)) continue;
        if (Array.isArray(state.goldUnresolved) && state.goldUnresolved.some(x=>goldSame(x.item,offer.item))) continue;
        if (balance-offer.price<100000) continue;
        const cost=goldFee(offer.price);
        if (cost!==null && balance-offer.price-cost>=100000) { chosen=offer; fee=cost; break; }
      }
      if (!chosen) { state.goldCheckAt=now+60000; state.message='Sin oferta de oro verificable que respete la reserva.'; save(); return false; }
      const t={stage:'buy',at:now,price:chosen.price,fee,item:chosen.item,seller:chosen.seller,balanceBefore:balance,confirmed:!chosen.item.owner};
      state.goldTx=t; state.message='Comprando paquete de '+chosen.price.toLocaleString('es-ES')+' de '+chosen.seller+'.'; log(state.message,'action'); save();
      const original=window.confirm;
      if (typeof original!=='function') { goldPause('Confirmación nativa no disponible; compra no iniciada.'); return false; }
      try {
        window.confirm=message=>{
          if (t.item.owner && !t.confirmed && /^Este objeto está vinculado al alma\s+¿Realmente quieres comprar este objeto\?$/.test(String(message).trim())) { t.confirmed=true; save(); return true; }
          t.rejected=true; save(); return false;
        };
        chosen.button.click();
      } catch { goldPause('Compra interrumpida; resultado desconocido. Revisa el mercado.'); return false; }
      finally { window.confirm=original; }
      if (t.rejected) { goldPause('Aviso de compra desconocido; operación detenida.'); return false; }
      return true;
    }
    if (tx.stage==='buy') {
      if (mod!=='guildMarket') { goldNav('#gca_shortcuts_bar a[href*="mod=guildMarket"]','guildMarket','Comprobando la compra pendiente.'); return true; }
      if (Number.isSafeInteger(balance) && balance===tx.balanceBefore-tx.price && tx.confirmed && !tx.rejected) {
        tx.stage='packages'; tx.at=now; state.message='Compra confirmada; buscando el objeto en paquetes.'; log(state.message,'success'); save();
      } else { state.message='Esperando confirmación de la compra de oro.'; save(); return true; }
    }
    if (tx.stage==='packages') {
      if (mod!=='packages') { goldNav('#menue_packages','packages','Abriendo paquetes de la alianza.'); return true; }
      if (!tx.item?.name) { goldPause('Falta el nombre del objeto pendiente.'); return false; }
      const bag=goldBag(), packages=document.querySelector('#packages');
      if (!bag || !packages) { state.message='Esperando baúl I y paquetes.'; save(); return true; }
      if (!goldSpace(bag,tx.item)) { goldPause('No hay espacio verificable para el objeto en el baúl I.'); return false; }
      if (params.get('f')!=='0' || params.get('fq')!=='-1' || params.get('qry')!==tx.item.name) {
        const form=document.querySelector('#pf'), input=form?.querySelector('input[name="qry"]'), filter=form?.querySelector('select[name="f"]'), quality=form?.querySelector('select[name="fq"]'), submit=form?.querySelector('[type="submit"]'); let u;
        try { u=new URL(form.getAttribute('action'),location.href); } catch { goldPause('Buscador de paquetes no verificable.'); return false; }
        if (u.origin!==location.origin || u.pathname!=='/game/index.php' || u.searchParams.get('mod')!=='packages' || u.searchParams.get('submod')!=='search' || String(form.method).toLowerCase()!=='post' || !input || !filter || !quality || !visible(submit) || submit.disabled || !tx.item?.name) { goldPause('Buscador de paquetes no verificable.'); return false; }
        input.value=tx.item.name; filter.value='0'; quality.value='-1'; if (filter.value!=='0' || quality.value!=='-1') { goldPause('Filtro de paquetes no verificable.'); return false; }
        tx.loadedAt=0; tx.at=now; state.message='Buscando el objeto de oro por nombre.'; save(); submit.click(); return true;
      }
      if (!tx.loadedAt) { tx.loadedAt=now; save(); return true; }
      if (now-tx.loadedAt<5000) return true;
      const matches=[...packages.querySelectorAll('.ui-draggable[data-tooltip][data-hash]')].filter(el=>visible(el) && goldSame(goldItem(el),tx.item) && /\bMercado\b/i.test(el.closest('.packageItem')?.textContent||''));
      if (!matches.length && /^\s*No hay paquetes\s*$/i.test(packages.textContent || '') && (params.get('page')||'1')==='1') {
        if (!Array.isArray(state.goldUnresolved)) state.goldUnresolved=[];
        if (state.goldUnresolved.length>=20) { goldPause('Demasiadas operaciones antiguas sin resolver.'); return false; }
        state.goldUnresolved.push({...tx,unresolvedAt:now}); state.goldTx=null; state.goldCheckAt=now+60000;
        state.message='Objeto anterior ausente en la búsqueda; operación archivada sin confirmar. Se excluyen objetos iguales.'; log(state.message,'warn'); save(); return false;
      }
      const page=Number(params.getAll('page').at(-1) || '1');
      const scan=tx.packageScan || (tx.packageScan={pages:[],matches:[],complete:false});
      const goPage=number=>{
        let u; try { u=new URL(location.href); } catch { return false; }
        if (u.origin!==location.origin || u.pathname!=='/game/index.php' || u.searchParams.get('mod')!=='packages' || u.searchParams.get('f')!=='0' || u.searchParams.get('fq')!=='-1' || u.searchParams.get('qry')!==tx.item.name || [...u.searchParams.keys()].some(k=>!['mod','f','fq','qry','sh','page'].includes(k)) || !Number.isSafeInteger(number) || number<1 || number>100) return false;
        u.searchParams.delete('page'); u.searchParams.set('page',String(number)); tx.loadedAt=0; tx.at=Date.now(); state.message='Revisando página '+number+' de paquetes de oro.'; save(); location.assign(u.href); return true;
      };
      if (!Number.isSafeInteger(page) || page<1 || page>100) { goldPause('Página de paquetes no verificable.'); return false; }
      if (!scan.complete) {
        const expected=scan.pages.length ? scan.pages.at(-1)+1 : 1;
        if (page!==expected) { if (!goPage(expected)) goldPause('No se pudo revisar la paginación de paquetes.'); return true; }
        for (const match of matches) { const hash=match.getAttribute('data-hash'); if (!validItemHash(hash) || scan.matches.some(x=>x.hash===hash)) { goldPause('Identificadores de paquetes ambiguos.'); return false; } scan.matches.push({hash,page}); }
        scan.pages.push(page); save();
        const next=document.querySelector('.paging_right_step');
        if (visible(next)) { if (!goPage(page+1)) goldPause('No se pudo revisar la siguiente página.'); return true; }
        if (scan.matches.length!==1) { goldPause('Objeto comprado aún no identificable de forma única en paquetes.'); return false; }
        scan.complete=true; save();
      }
      const found=scan.matches[0];
      if (page!==found.page) { if (!goPage(found.page)) goldPause('No se pudo volver al objeto de oro.'); return true; }
      const item=matches.find(x=>x.getAttribute('data-hash')===found.hash), hash=found.hash;
      if (matches.length!==1 || !item || !item.hasAttribute('data-gca-flag_double-click-event')) { goldPause('Objeto comprado cambió durante la búsqueda.'); return false; }
      // El identificador del juego es opaco y puede contener "!". Solo se compara
      // como atributo, nunca se interpola en un selector ni se guarda una URL.
      if (typeof hash!=='string' || !hash || hash.length>256 || /[\x00-\x1f\x7f]/.test(hash) || bag.items.some(x=>goldSame(goldItem(x),tx.item))) { goldPause('Objeto o baúl ambiguo antes del traslado.'); return false; }
      tx.stage='transfer'; tx.hash=hash; tx.at=now; state.message='Trasladando el objeto de oro al baúl I.'; log(state.message,'action'); save();
      item.dispatchEvent(new MouseEvent('dblclick',{bubbles:true,cancelable:true,view:window})); return true;
    }
    if (tx.stage==='transfer') {
      if (mod!=='packages') { goldNav('#menue_packages','packages','Comprobando el traslado pendiente.'); return true; }
      const bag=goldBag(false); if (!bag) return true;
      const matches=bag.items.filter(x=>x.getAttribute('data-hash')===tx.hash && goldSame(goldItem(x),tx.item));
      const still=document.querySelector('#packages')?.querySelectorAll('.ui-draggable[data-hash]');
      if (matches.length!==1 || !still || [...still].some(x=>x.getAttribute('data-hash')===tx.hash)) { state.message='Esperando confirmación del traslado al baúl I.'; save(); return true; }
      tx.stage='market'; tx.at=now; log('Objeto recibido en baúl I.','success'); save();
    }
    if (tx.stage==='market') {
      if (mod!=='guildMarket') { goldNav('#gca_shortcuts_bar a[href*="mod=guildMarket"]','guildMarket','Preparando la venta a 24 horas.'); return true; }
      const bag=goldBag(false), target=document.querySelector('#market_sell .ui-droppable');
      const items=bag?.items.filter(x=>x.getAttribute('data-hash')===tx.hash && goldSame(goldItem(x),tx.item)) || [];
      if (!bag || items.length!==1 || !visible(target)) { goldPause('Objeto o casilla de venta no verificable.'); return false; }
      tx.stage='drop'; tx.at=now; tx.ownBefore=goldOwnCount(tx.item,tx.price); state.message='Colocando el objeto en el formulario de venta.'; log(state.message,'action'); save();
      if (!dragFood(items[0],target)) goldPause('No se pudo preparar el arrastre al mercado.');
      return true;
    }
    if (tx.stage==='drop') {
      if (mod!=='guildMarket') { tx.stage='market'; save(); return true; }
      const clone=document.querySelector('#market_sell .ui-droppable [data-tooltip][data-basis]'), form=document.querySelector('#sellForm'), sellid=form?.querySelector('input[name="sellid"]');
      if (!clone || !sellid?.value || !goldSame(goldItem(clone),tx.item)) { state.message='Esperando confirmación del objeto en el mercado.'; save(); return true; }
      const fee=goldFee(tx.price), submit=form.querySelector('input[name="anbieten"]'); let url;
      try { url=new URL(form.getAttribute('action'),location.href); } catch { goldPause('Formulario de venta no verificable.'); return false; }
      if (url.origin!==location.origin || url.pathname!=='/game/index.php' || url.searchParams.get('mod')!=='guildMarket' || String(form.method).toLowerCase()!=='post' || !visible(submit) || submit.disabled || /rub[ií]|diamant|premium/i.test(submit.outerHTML) || !Number.isSafeInteger(balance) || fee===null || balance-fee<100000) { goldPause('No se pudo verificar la tarifa de 24 horas o la reserva.'); return false; }
      tx.stage='sell'; tx.at=now; tx.sellBalance=balance; tx.fee=fee; state.message='Anunciando por '+tx.price.toLocaleString('es-ES')+' durante 24 horas.'; log(state.message,'action'); save(); submit.click(); return true;
    }
    if (tx.stage==='sell') {
      if (mod!=='guildMarket') { goldNav('#gca_shortcuts_bar a[href*="mod=guildMarket"]','guildMarket','Comprobando el anuncio pendiente.'); return true; }
      if (goldOwnCount(tx.item,tx.price)>tx.ownBefore) {
        log('Anuncio confirmado: '+tx.price.toLocaleString('es-ES')+' durante 24 horas.','success'); state.goldTx=null; state.goldCheckAt=now+60000; state.message='Paquete anunciado; esperando siguiente revisión.'; save(); return false;
      }
      state.message='Esperando confirmación de la venta de oro.'; save(); return true;
    }
    goldPause('Estado de oro no reconocido.'); return false;
  }

  // Fundición: cada efecto queda registrado antes de ejecutarse. Si no se
  // confirma, el módulo queda bloqueado sin repetir la acción.
  const smeltNames={crystal:['Servius','Manius','Gaius','Antonius','Belisarius','Titus','Quintus','Pontius','Tellus','Marcellus','Titanius','Dexterus','Valerius','Constantius','Amulius'],stamina:['Lucius','Sentarions','Fernabasts','Tantus','Korks','Leandronimus','Barbekuus','Stoybaers','Decimus','Anchorons','Appius','Trafans','Ichorus','Opiehnzas']};
  function smeltItem(el, requireSource=true) {
    if (!el || !visible(el)) return null;
    const basis=el.getAttribute('data-basis'), match=/^(\d+)-\d+$/.exec(basis || ''), type=Number(match?.[1]);
    if (!match || ![1,2,3,4,5,6,8,9].includes(type)) return null;
    const q=el.getAttribute('data-quality'), green=el.classList.contains('item-i-green') && (q===null||q==='0'), blue=el.classList.contains('item-i-blue') && q==='1';
    if (green===blue || (green && el.classList.contains('item-i-blue')) || (blue && el.classList.contains('item-i-green')) || ['item-i-purple','item-i-orange','item-i-red'].some(c=>el.classList.contains(c))) return null;
    let name; try { name=JSON.parse(el.getAttribute('data-tooltip'))?.[0]?.[0]?.[0]; } catch { return null; }
    const hash=el.getAttribute('data-hash'),width=Number(el.getAttribute('data-measurement-x')),height=Number(el.getAttribute('data-measurement-y'));
    if (typeof name!=='string' || !name.trim() || !validItemHash(hash) || !Number.isInteger(width) || !Number.isInteger(height) || width<1 || height<1) return null;
    const source=(el.parentElement?.parentElement?.textContent || '').trim();
    if (requireSource && !/^(?:Expedición|Mazmorra|Jefe de la Mazmorra)\b/i.test(source)) return null;
    return {el,hash,name:name.trim(),basis,width,height,quality:green?'green':'blue'};
  }
  function smeltNav(selector, expected, submod, message) {
    const links=[...document.querySelectorAll(selector)].filter(visible);
    for (const link of links) { try { const u=new URL(link.getAttribute('href'),location.href); if (u.origin===location.origin && u.pathname==='/game/index.php' && u.searchParams.get('mod')===expected && (!submod || u.searchParams.get('submod')===submod) && !u.searchParams.has('action')) return navigation(link,message); } catch {} }
    return false;
  }
  function smeltBlock(message) { if (state.smeltTx) {state.smeltTx.blocked=true;state.smeltTx.problem=message;} state.message='Fundición: '+message;log(state.message,'warn');save(); }
  function smeltDone(message) { state.smeltTx=null;state.smeltNextAt=Date.now()+120000;state.message=message;log(message);save(); }
  function smeltingTick() {
    const now=Date.now();
    if (!BUILD_CONFIG.modules.smelting && !state.smeltTx) return false;
    let tx=state.smeltTx;
    if (tx?.blocked) return false;
    if (!tx) { if (now<(state.smeltNextAt||0)) return false; tx=state.smeltTx={stage:'forge',at:now};save(); }
    if (now-tx.at>90000 && tx.stage==='search' && mod==='packages' && params.get('f')==='0' && params.get('fq')==='-1' && (params.get('qry')||'')===tx.query) {tx.at=now-5000;save();}
    if (now-tx.at>90000) {smeltBlock('Operación sin confirmar; revisión necesaria.');return false;}
    if (tx.stage==='forge' || tx.stage==='save' || tx.stage==='place' || tx.stage==='rent') {
      if (mod!=='forge' || sub!=='smeltery') {
        if (smeltNav('#mainmenu a[href*="submod=smeltery"],#mainnav a[href*="submod=smeltery"]','forge','smeltery','Abriendo fundición.')) return true;
        if (smeltNav('#mainmenu a.submenuswitch[href*="submod=city"]','map','city','Abriendo ciudad para fundición.')) return true;
        return true;
      }
      const slots=[...document.querySelectorAll('#forge_nav > div')], active=slots.findIndex(e=>e.classList.contains('tabActive'));
      if (slots.length!==6 || active<0) {smeltBlock('Huecos no reconocidos.');return false;}
      if (tx.stage==='rent') {
        const selectedBag=document.querySelector('#inventory_nav a.current');
        if (active===tx.slot && slots[active].classList.contains('forge_crafting') && document.querySelector('#inv') && selectedBag?.getAttribute('data-bag-number')==='513' && !inventoryItemByHash(tx.hash)) {smeltDone('Fundición iniciada: '+tx.name+'.');return true;}
        if (now-tx.actionAt>20000) {smeltBlock('Inicio de fundición sin confirmar; no repetiré el pago.');return false;} return true;
      }
      if (tx.stage==='save') {
        if (active===tx.slot && slots[active].classList.contains('forge_closed')) {tx.stage='forge';tx.at=now;save();return true;}
        if (now-tx.actionAt>20000) {smeltBlock('Recogida de recursos sin confirmar.');return false;} return true;
      }
      if (tx.stage==='forge') {
        const finished=slots.findIndex(e=>e.classList.contains('forge_finished-succeeded'));
        if (finished>=0) {
          if (active!==finished) {slots[finished].click();return true;}
          const button=document.querySelector('#slot-finished-succeeded #forge_horreum');
          if (!visible(button) || button.textContent.trim()!=='Guardar recursos') {smeltBlock('Control de recogida no reconocido.');return false;}
          tx.stage='save';tx.slot=active;tx.actionAt=now;tx.at=now;save();button.click();return true;
        }
        const free=slots.findIndex(e=>e.classList.contains('forge_closed'));
        if (free<0) {smeltDone('Sin huecos libres; continúo la rutina.');return true;}
        tx.slot=free;tx.stage='packages';tx.at=now;save();return true;
      }
      if (tx.stage==='place') {
        const bag=document.querySelector('#inventory_nav a[data-bag-number="513"]'), inv=document.querySelector('#inv');
        if (!visible(bag)||bag.getAttribute('data-available')!=='true'||!inv) {smeltBlock('Baúl II no verificable.');return false;}
        if (!bag.classList.contains('current')) {bag.click();return true;}
        if (!slots[tx.slot]?.classList.contains('forge_closed')) {smeltBlock('El hueco cambió antes de fundir.');return false;}
        if (active!==tx.slot) {slots[tx.slot].click();return true;}
        const target=document.querySelector('#slot-closed #itembox'), item=inventoryItemByHash(tx.hash), displayed=target?.querySelector('[data-hash]');
        if (!tx.dragAt) {
          const safe=smeltItem(item,false);
          if (!safe || safe.name!==tx.name || safe.basis!==tx.basis || safe.quality!==tx.quality || !visible(target) || target.querySelector('[data-basis]')) {smeltBlock('Objeto o hueco no verificable antes del arrastre.');return false;}
          tx.dragAt=now;tx.at=now;save();if(!dragFood(item,target)) smeltBlock('Arrastre no disponible.');return true;
        }
        if (!displayed || displayed.getAttribute('data-hash')!==tx.hash) {if(now-tx.dragAt>20000) smeltBlock('Arrastre a fundición sin confirmar.');return true;}
        const rent=document.querySelector('#slot-closed [data-rent="2"]'),goldIcon=rent?.querySelector('.icon_gold'),cost=parseGold(rent?.textContent),balance=goldBalance();
        const itemName=document.querySelector('#forge_item_name')?.textContent || '';
        if (!visible(rent)||!goldIcon||rent.querySelector('.icon_rubies')||!Number.isSafeInteger(cost)||cost<=0||!Number.isSafeInteger(balance)||balance-cost<100000||!itemName.includes(tx.name)) {if(now-tx.dragAt>15000) smeltBlock('Coste, saldo o vista previa no verificables.');return true;}
        tx.stage='rent';tx.actionAt=now;tx.cost=cost;tx.at=now;save();rent.click();return true;
      }
    }
    if (tx.stage==='packages' || tx.stage==='search' || tx.stage==='transfer') {
      if (mod!=='packages') {if(!smeltNav('#menue_packages','packages',null,'Buscando equipo para fundición.')) return true;return true;}
      const bag=document.querySelector('#inventory_nav a[data-bag-number="513"]'),inv=document.querySelector('#inv'),packages=document.querySelector('#packages');
      if (!visible(bag)||bag.getAttribute('data-available')!=='true'||!inv||!packages) {if(now-tx.at>15000) smeltBlock('Paquetes o baúl II no disponibles.');return true;}
      if (!bag.classList.contains('current')) {bag.click();return true;}
      const items=[...inv.querySelectorAll('.ui-draggable[data-hash]')];
      if (items.some(e=>e.getAttribute('data-container-number') && e.getAttribute('data-container-number')!=='513')) return true;
      if (tx.stage==='transfer') {
        if (items.filter(e=>e.getAttribute('data-hash')===tx.hash).length===1 && ![...packages.querySelectorAll('[data-hash]')].some(e=>e.getAttribute('data-hash')===tx.hash)) {tx.stage='place';tx.at=now;save();return true;}
        if (now-tx.actionAt>20000) {smeltBlock('Traslado a baúl II sin confirmar; no repetiré.');return false;} return true;
      }
      const priority=BUILD_CONFIG.smeltingPriority || 'crystal', names=smeltNames[priority] || [], index=Number.isInteger(state.smeltPrefixIndex)?state.smeltPrefixIndex%Math.max(names.length,1):0, query=names[index] || '';
      if (tx.stage==='packages') {
        const form=document.querySelector('#pf'), input=form?.querySelector('input[name="qry"]'),filter=form?.querySelector('select[name="f"]'),quality=form?.querySelector('select[name="fq"]'),submit=form?.querySelector('input[type="submit"],button[type="submit"]'); let u;
        try {u=new URL(form?.getAttribute('action'),location.href);} catch {}
        if(!u||u.origin!==location.origin||u.pathname!=='/game/index.php'||u.searchParams.get('mod')!=='packages'||u.searchParams.get('submod')!=='search'||String(form.method).toLowerCase()!=='post'||!input||!filter||!quality||!visible(submit)) {smeltBlock('Buscador de paquetes no verificable.');return false;}
        input.value=query;filter.value='0';quality.value='-1';tx.stage='search';tx.query=query;tx.at=now;save();submit.click();return true;
      }
      if (now-tx.at<5000) return true;
      if (params.get('f')!=='0' || params.get('fq')!=='-1' || (params.get('qry')||'')!==tx.query) {if(now-tx.at>20000) smeltBlock('Búsqueda de paquetes sin confirmar.');return true;}
      const candidates=[...packages.querySelectorAll('.ui-draggable[data-tooltip][data-hash]')].map(e=>smeltItem(e)).filter(x=>x && (priority==='green-blue'||x.name.normalize('NFKC').toLocaleLowerCase('es').split(/\s+/).includes(tx.query.toLocaleLowerCase('es'))) && x.el.hasAttribute('data-gca-flag_double-click-event'));
      const rect=inv.getBoundingClientRect(),capacity=Math.floor(rect.width/32)*Math.floor(rect.height/32);
      const occupied=items.reduce((n,e)=>n+Number(e.getAttribute('data-measurement-x'))*Number(e.getAttribute('data-measurement-y')),0);
      const hasSpace=Number.isSafeInteger(capacity)&&capacity>0&&Number.isSafeInteger(occupied)&&occupied<capacity;
      const candidate=hasSpace ? candidates.find(x=>goldSpace({inv,items},x)) : null;
      if (!candidate) {
        const next=document.querySelector('.paging_right_step');
        if (hasSpace && visible(next)) {
          let u; try {u=new URL(next.getAttribute('href'),location.href);} catch {}
          const current=Number(params.getAll('page').at(-1)||'1'), visited=Array.isArray(tx.pages)?tx.pages:[];
          if (!u || u.origin!==location.origin || u.pathname!=='/game/index.php' || u.searchParams.get('mod')!=='packages' || u.searchParams.get('f')!=='0' || u.searchParams.get('fq')!=='-1' || (u.searchParams.get('qry')||'')!==tx.query || !Number.isSafeInteger(current) || current<1 || current>=50 || visited.includes(current)) {smeltBlock('Paginación de paquetes no verificable.');return false;}
          tx.pages=[...visited,current];tx.at=now;save();u.searchParams.delete('page');u.searchParams.set('page',String(current+1));location.assign(u.href);return true;
        }
        state.smeltPrefixIndex=index+1;smeltDone('Sin equipo apto o sin espacio; continúo la rutina.');return true;
      }
      Object.assign(tx,{stage:'transfer',hash:candidate.hash,name:candidate.name,basis:candidate.basis,quality:candidate.quality,actionAt:now,at:now});save();candidate.el.dispatchEvent(new MouseEvent('dblclick',{bubbles:true,cancelable:true,view:window}));return true;
    }
    smeltBlock('Etapa desconocida.');return false;
  }
  function safeSmeltingTick() {
    try { return smeltingTick(); }
    catch (error) { smeltBlock('Error interno; revisar operación antes de continuar.'); return false; }
  }
