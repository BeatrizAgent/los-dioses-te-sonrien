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
    if (el.getAttribute('data-level')!=='1' || el.getAttribute('data-measurement-x')!=='1' || el.getAttribute('data-measurement-y')!=='1') return null;
    // Materiales, pergaminos y herramientas nunca se manipulan como paquetes de oro.
    if (/^(?:1[2-8])-/.test(basis) || /pergamino|receta|herramienta|material de forja/i.test(name)) return null;
    return {name,owner,soul:soul || null,basis};
  }
  function goldSame(a,b) { return !!a && !!b && ['name','owner','soul','basis'].every(k=>a[k]===b[k]); }
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
  function goldFee(price) {
    const form=document.querySelector('#sellForm'), input=document.querySelector('#preis'), duration=document.querySelector('#dauer'), fee=document.querySelector('#marktgebuehren');
    if (!form || !input || !duration || !fee || !GOLD_PRICES.includes(price) || !/calcDues\(\)/.test(input.getAttribute('onkeyup')||'') || !/calcDues\(\)/.test(duration.getAttribute('onchange')||'')) return null;
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
      if (!seller || seller.normalize('NFKC').toLocaleLowerCase()===accountName.normalize('NFKC').toLocaleLowerCase() || !GOLD_PRICES.includes(price) || cells[4]?.textContent.trim()!=='1' || !item || !visible(button) || button.disabled || button.value!=='Comprar') return null;
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
      if (!Number.isSafeInteger(balance) || balance<204000 || now<(state.goldCheckAt||0)) return false;
      if (mod!=='guildMarket') {
        const link=document.querySelector('#gca_shortcuts_bar a[href*="mod=guildMarket"]');
        if (!visible(link)) { state.goldCheckAt=now+60000; save(); return false; }
        if (!goldNav('#gca_shortcuts_bar a[href*="mod=guildMarket"]','guildMarket','Revisando paquetes de oro de la alianza.')) { state.goldCheckAt=now+15000; save(); return false; }
        return true;
      }
      if (now-goldPageOpenedAt<5000) { state.message='Esperando a que cargue el baúl I y el mercado.'; save(); return true; }
      if (!goldBag()) { state.goldCheckAt=now+60000; state.message='Baúl I sin espacio verificable; revisaré el oro más tarde.'; save(); return false; }
      let chosen=null, fee=null;
      for (const offer of goldOffers()) {
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
