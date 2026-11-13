  function cooldownSeconds(text) {
    const value = String(text || '').trim();
    if (/^(?:Al Circo Turma|Ir a la Arena|Ir a la Expedición|Ir a la Mazmorra)$/i.test(value)) return 0;
    const m = value.match(/(?:^|\s)(\d+):(\d{2})(?::(\d{2}))?/);
    if (!m) return null;
    return m[3] === undefined ? Number(m[1])*60 + Number(m[2]) : Number(m[1])*3600 + Number(m[2])*60 + Number(m[3]);
  }
  function discardPendingFight(reason) {
    const fight = state.pendingFight;
    if (!fight) return;
    state.message = 'Resultado desconocido de ' + fight.name + '. Continúo con la cola.';
    log(state.message + ' ' + reason, 'warn');
    state.pendingFight = null; save();
  }
  function validItemHash(hash) { return typeof hash==='string' && hash.length>0 && hash.length<=256 && !/[\x00-\x1f\x7f]/.test(hash); }
  function inventoryItemByHash(hash) {
    if (!validItemHash(hash)) return null;
    return [...document.querySelectorAll('#inv .ui-draggable[data-hash]')].find(el=>el.getAttribute('data-hash')===hash) || null;
  }
  function healingFood(item) {
    if (item?.getAttribute('data-content-type') !== '64') return null;
    let rows;
    try { rows = JSON.parse(item.getAttribute('data-tooltip'))?.[0]; } catch { return null; }
    if (!Array.isArray(rows)) return null;
    const texts = rows.flat(Infinity).filter(x => typeof x === 'string');
    const match = texts.map(x => x.trim().match(/^En uso:\s*Cura\s+([\d.\s\u00a0]+)\s+punto\(s\) de vida$/i)).find(Boolean);
    const binding = texts.find(x => /^Vinculado al alma de:/i.test(x));
    if (!match || (binding && binding.slice(binding.indexOf(':') + 1).trim().toLocaleLowerCase() !== accountName.toLocaleLowerCase())) return null;
    const levelText=texts.find(x => /^Nivel\s+\d+$/i.test(x));
    const amount=Number(match[1].replace(/[.\s\u00a0]/g,''));
    if (!Number.isSafeInteger(amount) || amount<=0) return null;
    return {item, amount, name:texts[0] || 'alimento', level:levelText ? Number(levelText.match(/\d+/)[0]) : null, oneCell:item.getAttribute('data-measurement-x') === '1' && item.getAttribute('data-measurement-y') === '1'};
  }
  function packageUsable(item) {
    if (item?.getAttribute('data-content-type')!=='64' || !/^7-\d+$/.test(item.getAttribute('data-basis')||'')) return null;
    let rows; try { rows=JSON.parse(item.getAttribute('data-tooltip'))?.[0]; } catch { return null; }
    const name=rows?.[0]?.[0];
    return typeof name==='string' && name.trim() ? {item,name:name.trim()} : null;
  }
  function inventorySpace(bag,item) {
    const width=item?.width ?? 1, height=item?.height ?? 1;
    if (!bag || !Number.isInteger(width) || !Number.isInteger(height) || width<1 || height<1) return false;
    const inv=bag.inv, box=inv.getBoundingClientRect();
    const cols=inv.offsetWidth/32, rows=inv.offsetHeight/32;
    if (!Number.isInteger(cols)||!Number.isInteger(rows)||cols<width||rows<height||cols>20||rows>20 || !Number.isFinite(box.width)||!Number.isFinite(box.height)||box.width<=0||box.height<=0) return false;
    const cellX=box.width/cols, cellY=box.height/rows, used=[];
    for (let row=0;row<rows;row++) { const cells=[]; for (let col=0;col<cols;col++) cells.push(false); used.push(cells); }
    for (const el of bag.items) {
      if (!visible(el)) return false;
      const w=Number(el.getAttribute('data-measurement-x')),h=Number(el.getAttribute('data-measurement-y')),rect=el.getBoundingClientRect();
      const dx=(rect.left-box.left)/cellX,dy=(rect.top-box.top)/cellY,x=Math.round(dx),y=Math.round(dy);
      if (!Number.isInteger(w)||!Number.isInteger(h)||w<1||h<1||!Number.isFinite(dx)||!Number.isFinite(dy)||Math.abs(dx-x)>.1||Math.abs(dy-y)>.1||x<0||y<0||x+w>cols||y+h>rows) return false;
      for (let j=y;j<y+h;j++) for (let i=x;i<x+w;i++) { if (used[j][i]) return false; used[j][i]=true; }
    }
    for (let y=0;y<=rows-height;y++) for (let x=0;x<=cols-width;x++) {
      let free=true; for (let j=y;j<y+height;j++) for (let i=x;i<x+width;i++) if (used[j][i]) free=false;
      if (free) return true;
    }
    return false;
  }
  function rememberUnknownPackageFood() {
    const pending=state.pendingPackageFood;
    if (pending && validItemHash(pending.hash)) {
      state.unknownPackageFood=Array.isArray(state.unknownPackageFood) ? state.unknownPackageFood : [];
      if (!state.unknownPackageFood.includes(pending.hash)) state.unknownPackageFood.push(pending.hash);
    }
    state.pendingPackageFood=null;
  }
  function packageFoodTick() {
    const collecting=state.packageCollectTrip===true;
    if (collecting && mod!=='packages') {
      if (!goldNav('#menue_packages','packages','Buscando utilizables en paquetes.')) {state.packageCollectTrip=false;state.packageCollectAt=Date.now()+120000;save();return false;}
      return true;
    }
    const inv=document.querySelector('#inv'), packages=document.querySelector('#packages');
    if (!inv || !packages) {
      if (!state.packageWaitAt) { state.packageWaitAt=Date.now(); state.message='Esperando a que carguen los paquetes.'; save(); }
      else if (Date.now()-state.packageWaitAt>15000) { rememberUnknownPackageFood(); delete state.packageWaitAt; skipHealing('Paquetes no disponibles; sigo con la cola.'); }
      return true;
    }
    if (state.packageWaitAt) { delete state.packageWaitAt; save(); }
    if (!state.pendingPackageFood && params.get('f') !== '7') {
      const filter=document.querySelector('#mainnav a[href*="mod=packages"][href*="f=7"]');
      if (!visible(filter)) { skipHealing('Filtro de paquetes no disponible; sigo con la cola.'); return true; }
      let url; try { url=new URL(filter.getAttribute('href'),location.href); } catch { return stop('Filtro de paquetes no reconocible.'); }
      if (url.origin!==location.origin || url.pathname!=='/game/index.php' || url.searchParams.get('mod')!=='packages' || url.searchParams.get('f')!=='7') return stop('Filtro de paquetes no reconocido.');
      state.packagePages=[]; save(); filter.click(); return true;
    }
    const bag=document.querySelector('#inventory_nav a');
    if (!bag || !visible(bag)) { rememberUnknownPackageFood(); skipHealing('Baúl I no disponible; sigo con la cola.'); return true; }
    if (!bag.classList.contains('current')) { delete state.packageScan; bag.click(); state.message='Seleccionando baúl I.'; save(); return true; }
    if (bag.getAttribute?.('data-bag-number') && bag.getAttribute('data-bag-number')!=='512') { rememberUnknownPackageFood(); skipHealing('Baúl I no verificable.'); return true; }
    const inventory=[...inv.querySelectorAll('.ui-draggable')];
    if (inventory.some(x=>!validItemHash(x.getAttribute('data-hash')))) { rememberUnknownPackageFood(); skipHealing('Objetos del baúl sin identificar; revisaré después.'); return true; }
    if (inventory.some(x=>{
      const container=x.getAttribute('data-container-number');
      const arriving=state.pendingPackageFood && x.getAttribute('data-hash')===state.pendingPackageFood.hash;
      return container !== '512' && !(arriving && !container);
    })) { rememberUnknownPackageFood(); skipHealing('No se pudo verificar el baúl I; sigo con la cola.'); return true; }
    if (state.pendingPackageFood) {
      const p=state.pendingPackageFood;
      const count=inventory.filter(x=>x.getAttribute('data-hash') === p.hash).length;
      if (count>p.before) {
        state.pendingPackageFood=null; state.packageFoodTrip=false;
        if (collecting) {state.packageCollectTrip=false;state.packageCollectAt=Date.now()+120000;log('Utilizable recibido en el baúl I: '+p.name+'.','success');save();return true;}
        log('Alimento recibido en el baúl I: '+p.name+'.','success'); save();
        navigation(document.querySelector('#mainmenu a[href*="mod=overview"]'), 'Volviendo para curar.'); return true;
      }
      if (Date.now()-p.at>15000) { rememberUnknownPackageFood(); skipHealing('Traslado de alimento sin confirmar; sigo con la cola.'); }
      return true;
    }
    const level=Number((document.querySelector('#header_values_level')?.textContent || '').replace(/\D/g,''));
    const pageKey=(params.get('page') || '1')+':'+params.get('f');
    if (state.packageScan?.key!==pageKey) { state.packageScan={key:pageKey,at:Date.now()}; state.message='Esperando los alimentos y el complemento de paquetes.'; save(); return true; }
    if (Date.now()-state.packageScan.at<5000) return true;
    const candidates=[...packages.querySelectorAll('.ui-draggable[data-tooltip][data-hash]')].filter(visible).map(collecting ? packageUsable : healingFood).filter(x=>x && (collecting || x.level===null || (level>0 && x.level<=level)));
    const available=candidates.filter(x=>x.item.hasAttribute('data-gca-flag_double-click-event') && validItemHash(x.item.getAttribute('data-hash')) && !(Array.isArray(state.unknownPackageFood) && state.unknownPackageFood.includes(x.item.getAttribute('data-hash'))));
    const food=available.find(x=>inventorySpace({inv,items:inventory},{width:Number(x.item.getAttribute('data-measurement-x')),height:Number(x.item.getAttribute('data-measurement-y'))}));
    if (!food && available.length) { skipHealing('Baúl I lleno o espacio no verificable para '+(collecting?'utilizables':'alimentos')+'; revisaré después.'); return true; }
    if (!food) {
      const next=document.querySelector('.paging_right_step');
      if (!visible(next)) {
        const invalid=candidates.some(x=>x.item.hasAttribute('data-gca-flag_double-click-event') && !validItemHash(x.item.getAttribute('data-hash')));
        if (!collecting && BUILD_CONFIG.modules.foodMarket && !invalid && !candidates.length && !state.foodBuyTx && Date.now()>=(state.foodBuyRetryAt||0)) state.foodBuyNeeded=true;
        skipHealing(collecting ? 'Sin utilizables trasladables en paquetes; revisaré después.' : invalid ? 'Alimento sin identificador verificable; revisaré después.' : candidates.length ? 'Hay comida, pero Crazy Addon no habilitó su traslado; revisaré después.' : 'Sin comida utilizable en paquetes; revisaré el mercado de la alianza.'); return true;
      }
      let url; try { url=new URL(next.getAttribute('href'),location.href); } catch { return stop('Paginación de paquetes no reconocible.'); }
      const pages=url.searchParams.getAll('page'), nextPage=Number(pages.at(-1)), currentPage=Number(params.get('page') || 1);
      const visited=Array.isArray(state.packagePages) ? state.packagePages : [];
      if (url.origin!==location.origin || url.pathname!=='/game/index.php' || url.searchParams.get('mod')!=='packages' || url.searchParams.get('f')!=='7' || !Number.isSafeInteger(nextPage) || nextPage<=currentPage || visited.includes(nextPage) || visited.length>=50) return stop('Paginación de paquetes no verificable.');
      state.packagePages=[...visited,currentPage]; state.message='Revisando página '+nextPage+' de alimentos.'; save(); next.click(); return true;
    }
    const hash=food.item.getAttribute('data-hash');
    state.pendingPackageFood={hash,name:food.name,before:inventory.filter(x=>x.getAttribute('data-hash')===hash).length,at:Date.now()};
    state.message='Recogiendo '+(collecting?'utilizable: ':'alimento: ')+food.name+'.'; log(state.message,'action'); save();
    food.item.dispatchEvent(new MouseEvent('dblclick',{bubbles:true,cancelable:true,view:window})); return true;
  }
  function skipHealing(message) {
    if (state.packageCollectTrip) {state.packageCollectTrip=false;state.packageCollectAt=Date.now()+120000;delete state.packageScan;delete state.packageWaitAt;state.message=message;log(message,'warn');save();return;}
    state.pendingHeal=null; state.packageFoodTrip=false; delete state.packageScan; delete state.packageWaitAt; state.healSkipUntil=Date.now()+60000;
    state.message=message; log(message,'warn'); save();
  }
  function dragFood(item, target, useTouch=false) {
    const a=item.getBoundingClientRect(), b=target.getBoundingClientRect();
    const from={x:a.left+a.width/2,y:a.top+a.height/2}, to={x:b.left+b.width/2,y:b.top+b.height/2};
    if (![a.width,a.height,b.width,b.height,from.x,from.y,to.x,to.y].every(Number.isFinite) || a.width<=0 || a.height<=0 || b.width<=0 || b.height<=0) return false;
    if (useTouch && window.navigator?.maxTouchPoints > 0 && typeof window.Touch === 'function' && typeof window.TouchEvent === 'function') {
      let start,move,end,cancel;
      try {
        const point=p=>new window.Touch({identifier:1,target:item,clientX:p.x,clientY:p.y,pageX:p.x+(window.scrollX||0),pageY:p.y+(window.scrollY||0),screenX:p.x,screenY:p.y});
        const first=point(from),last=point(to);
        const event=(type,touches,changed)=>new window.TouchEvent(type,{bubbles:true,cancelable:true,view:window,touches,targetTouches:touches,changedTouches:changed});
        start=event('touchstart',[first],[first]); move=event('touchmove',[last],[last]); end=event('touchend',[],[last]); cancel=event('touchcancel',[],[first]);
      } catch { return dragFood(item,target,false); }
      const pending=state.pendingHeal;
      item.dispatchEvent(start);
      setTimeout(() => {
        if (!ownerActive || !state.running || state.pendingHeal!==pending || !item.isConnected || !target.isConnected || captcha()) { item.dispatchEvent(cancel); return; }
        item.dispatchEvent(move);
        setTimeout(() => {
          if (!ownerActive || !state.running || state.pendingHeal!==pending || !item.isConnected || !target.isConnected || captcha()) { item.dispatchEvent(cancel); return; }
          item.dispatchEvent(end);
        },100);
      },350);
      return true;
    }
    const mouse=(type,p,buttons=1)=>new MouseEvent(type,{bubbles:true,cancelable:true,view:window,clientX:p.x,clientY:p.y,button:0,buttons});
    item.dispatchEvent(mouse('mousedown',from));
    document.dispatchEvent(mouse('mousemove',{x:from.x+6,y:from.y+6}));
    for (let i=1;i<=4;i++) document.dispatchEvent(mouse('mousemove',{x:from.x+(to.x-from.x)*i/4,y:from.y+(to.y-from.y)*i/4}));
    document.dispatchEvent(mouse('mouseup',to,0));
    return true;
  }
  function healTick(current, maximum) {
    const selectedBag=[...document.querySelectorAll('#inventory_nav a')].findIndex(a=>a.classList.contains('current'));
    if (mod === 'overview' && selectedBag !== 0) {
      const bag=document.querySelector('#inventory_nav a');
      if (!visible(bag)) { skipHealing('No se encuentra el baúl I; continuando con la cola.'); return true; }
      bag.click(); state.message='Seleccionando baúl I.'; save(); return true;
    }
    if (state.pendingHeal) {
      const p=state.pendingHeal;
      if (!validItemHash(p.hash)) { skipHealing('Curación anterior no identificable; sigo con la cola.'); return true; }
      const item=inventoryItemByHash(p.hash);
      if (mod === 'overview' && document.querySelector('#inv') && Number.isInteger(p.bagIndex) && p.bagIndex === selectedBag && !item && current > p.before) {
        log('Curación confirmada: ' + p.name + '.', 'success'); state.pendingHeal=null; save(); return true;
      }
      if (current > maximum * .40 && Date.now()-p.at > 15000) {
        log('Vida recuperada; resultado de la curación anterior desconocido.', 'warn');
        state.pendingHeal=null; save(); return true;
      }
      if (mod === 'overview' && !p.refreshRequestedAt && Date.now()-p.at >= 5000) {
        const link=document.querySelector('#mainmenu a[href*="mod=overview"]');
        if (visible(link)) {
          p.refreshRequestedAt=Date.now(); save();
          if (!navigation(link,'Actualizando salud tras la curación.')) { delete p.refreshRequestedAt; save(); }
          return true;
        }
      }
      if (Date.now()-p.at > 15000) {
        const target=document.querySelector('#avatar');
        if ((p.attempt || 1) < 2 && p.refreshRequestedAt && p.bagIndex === 0 && selectedBag === 0 && item && visible(item) && visible(target) && healingFood(item)) {
          p.attempt=2; p.at=Date.now(); p.before=current; p.bagIndex=0; delete p.refreshRequestedAt;
          state.message='Segundo intento de curación con '+p.name+'.'; log(state.message,'action'); save(); if (!dragFood(item,target)) skipHealing('No se pudieron calcular las posiciones de curación.'); return true;
        }
        skipHealing('Curación sin confirmar; continúo con la cola y revisaré más tarde.');
      }
      return true;
    }
    if (mod !== 'overview') {
      const link=document.querySelector('#mainmenu a[href*="mod=overview"]');
      if (!visible(link)) { stop('No se encuentra la entrada al baúl para curar.'); return true; }
      if (!navigation(link, 'Volviendo al baúl para curar.')) {
        state.message='Esperando para abrir el baúl y curar.'; save();
      }
      return true;
    }
    const target=document.querySelector('#avatar');
    const playerLevel=Number((document.querySelector('#header_values_level')?.textContent || '').replace(/\D/g,''));
    const foods=[...document.querySelectorAll('#inv .ui-draggable[data-tooltip][data-hash]')].map(healingFood).filter(x=>x && validItemHash(x.item.getAttribute('data-hash')) && (x.level===null || (playerLevel>0 && x.level<=playerLevel)));
    foods.sort((a,b)=>Number(b.oneCell)-Number(a.oneCell) || Math.abs(maximum-current-a.amount)-Math.abs(maximum-current-b.amount));
    const food=foods[0], hash=food?.item.getAttribute('data-hash');
    if (!food) {
      const link=document.querySelector('#menue_packages');
      if (!visible(link)) { stop('No se encuentra la entrada a paquetes.'); return true; }
      state.packageFoodTrip=true; delete state.packageScan; delete state.packageWaitAt; save(); navigation(link,'Buscando alimentos en paquetes.'); return true;
    }
    if (!visible(target)) { skipHealing('No se reconoce el destino de curación; sigo con la cola.'); return true; }
    if (selectedBag < 0) { stop('No se reconoce el baúl seleccionado para la curación.'); return true; }
    state.pendingHeal={hash,name:food.name,before:current,bagIndex:selectedBag,attempt:1,at:Date.now()}; state.message='Intentando curar con ' + food.name + '.'; log(state.message,'action'); save();
    if (!dragFood(food.item,target,true)) skipHealing('No se pudo preparar el gesto de curación.');
    return true;
  }
  // La compra de alimento no comparte estado con la compraventa de paquetes de oro.
  function foodMarketOffers(support=false) {
    const level=Number((document.querySelector('#header_values_level')?.textContent||'').replace(/\D/g,''));
    return [...document.querySelectorAll('#market_item_table tr')].map(row=>{
      const cells=[...(row.cells||[])], seller=cells[1]?.textContent.trim(), price=parseGold(cells[2]?.textContent);
      const food=healingFood(cells[0]?.querySelector('[data-tooltip][data-content-type]'));
      const button=row.querySelector('input[name="buy"]'),form=button?.form;
      let url; try { url=new URL(form?.getAttribute('action'),location.href); } catch { return null; }
      const listedLevel=cells[4]?.textContent.trim() || '';
      if (!seller || seller.normalize('NFKC').toLocaleLowerCase()===accountName.normalize('NFKC').toLocaleLowerCase() || !Number.isSafeInteger(price) || price<=0 || !food || (!support && food.level!==null && (!level || food.level>level)) || !/^\d+$/.test(listedLevel) || (food.level!==null && Number(listedLevel)!==food.level) || !visible(button) || button.disabled || button.value!=='Comprar') return null;
      const notice=form.getAttribute('data-confirm-message');
      if (url.origin!==location.origin || url.pathname!=='/game/index.php' || url.searchParams.get('mod')!=='guildMarket' || String(form.method).toLowerCase()!=='post' || (notice!==null && notice!=='Este objeto está vinculado al alma') || /rub[ií]|diamant|premium/i.test(button.outerHTML+' '+row.textContent)) return null;
      return {seller,price,food,button,notice};
    }).filter(Boolean).sort((a,b)=>a.price-b.price);
  }
  function foodMarketGoPage(target) {
    if (!Number.isSafeInteger(target)||target<1||target>100) return false;
    const allowed=['mod','fl','fq','f','qry','seller','s','p','sh'];
    const here=new URL(location.href),defaults={fl:'0',fq:'-1',f:'0',qry:'',seller:'',s:''};
    const link=[...document.querySelectorAll('a[href]')].find(a=>{try{const u=new URL(a.getAttribute('href'),location.href);return u.origin===location.origin&&u.pathname==='/game/index.php'&&u.searchParams.get('mod')==='guildMarket'&&u.searchParams.getAll('p').length===1&&u.searchParams.get('p')===String(target)&&[...u.searchParams.keys()].every(k=>allowed.includes(k))&&Object.keys(defaults).every(k=>(u.searchParams.get(k)??defaults[k])===(here.searchParams.get(k)??defaults[k]));}catch{return false;}});
    if(!visible(link))return false;state.message='Revisando página '+target+' de alimentos de alianza.';save();link.click();return true;
  }
  function foodMarketTick() {
    const tx=state.foodBuyTx;
    if (tx) {
      const now=Date.now();
      if (!['baseline','readyBuy','buy','verify'].includes(tx.stage)) return false;
      if (Number.isFinite(tx.retryAt)) {
        if (now<tx.retryAt) return false;
        delete tx.retryAt; delete tx.scan; delete tx.loadedAt; tx.at=now; save();
      }
      const deferFoodCheck=message=>{tx.retryAt=Date.now()+60000;delete tx.scan;delete tx.loadedAt;state.message=message;save();return false;};
      if (tx.stage==='baseline' || tx.stage==='verify') {
        if (mod!=='packages') { goldNav('#menue_packages','packages','Comprobando paquetes de alimento.'); return true; }
        const packages=document.querySelector('#packages');
        if (!packages) return true;
        if (params.get('f')!=='7' || params.get('fq')!=='-1' || params.get('qry')!==tx.name) {
          const form=document.querySelector('#pf'),input=form?.querySelector('input[name="qry"]'),filter=form?.querySelector('select[name="f"]'),quality=form?.querySelector('select[name="fq"]'),submit=form?.querySelector('[type="submit"]'); let u;
          try {u=new URL(form?.getAttribute('action'),location.href);} catch {}
          if(!u||u.origin!==location.origin||u.pathname!=='/game/index.php'||u.searchParams.get('mod')!=='packages'||u.searchParams.get('submod')!=='search'||String(form.method).toLowerCase()!=='post'||!input||!filter||!quality||!visible(submit)||submit.disabled) return deferFoodCheck('No se pudo verificar el buscador de alimento; volveré a comprobarlo.');
          input.value=tx.name;filter.value='7';quality.value='-1';if(filter.value!=='7'||quality.value!=='-1')return deferFoodCheck('Filtro de alimento no verificable; volveré a comprobarlo.');
          tx.scan={pages:[],matches:0,fingerprints:{}};tx.loadedAt=0;tx.at=now;save();submit.click();return true;
        }
        if(!tx.scan)tx.scan={pages:[],matches:0,fingerprints:{}};
        if(!tx.loadedAt){tx.loadedAt=now;save();return true;} if(now-tx.loadedAt<5000)return true;
        const values=params.getAll('page'),page=Number(values[0]||'1'),scan=tx.scan;
        if(values.length>1||!Number.isSafeInteger(page)||page<1||page>100||!scan) return deferFoodCheck('Paginación de alimento ambigua; volveré a comprobarla.');
        const go=n=>{let u;try{u=new URL(location.href);}catch{return false;}if(u.origin!==location.origin||u.pathname!=='/game/index.php'||u.searchParams.get('mod')!=='packages'||u.searchParams.get('f')!=='7'||u.searchParams.get('fq')!=='-1'||u.searchParams.get('qry')!==tx.name||[...u.searchParams.keys()].some(k=>!['mod','f','fq','qry','sh','page'].includes(k))||n<1||n>100)return false;u.searchParams.delete('page');u.searchParams.set('page',String(n));tx.loadedAt=0;tx.at=Date.now();save();location.assign(u.href);return true;};
        const expected=scan.pages.length?scan.pages.at(-1)+1:1;if(page!==expected)return go(expected) || deferFoodCheck('No se pudo revisar la página de alimento; volveré a comprobarla.');
        const listed=[...packages.querySelectorAll('.ui-draggable[data-tooltip][data-hash]')].filter(visible),fp=listed.map(e=>e.getAttribute('data-hash')).filter(validItemHash).sort().join('|');
        if(fp&&Object.entries(scan.fingerprints).some(([p,v])=>Number(p)!==page&&v===fp))return deferFoodCheck('Página de alimento repetida; volveré a comprobarla.');
        if(fp)scan.fingerprints[page]=fp;
        scan.matches+=listed.filter(e=>{const food=healingFood(e);return food && food.name===tx.name && food.amount===tx.amount && food.level===tx.level && e.getAttribute('data-basis')===tx.basis && (e.getAttribute('data-soulbound-to')||null)===tx.soul && /\bMercado\b/i.test(e.closest('.packageItem')?.textContent||'');}).length;
        scan.pages.push(page);tx.at=now;save();if(visible(document.querySelector('.paging_right_step')))return go(page+1) || deferFoodCheck('No se pudo revisar la página siguiente de alimento; volveré a comprobarla.');
        if(tx.stage==='baseline') {
          if(scan.matches!==0 && !tx.support){state.foodBuyTx=null;state.foodBuyNeeded=false;state.healSkipUntil=0;state.packageFoodTrip=true;delete state.packageScan;state.message='Ya hay alimento en paquetes; intentaré recogerlo.';save();return true;}
          tx.baselineCount=scan.matches;tx.baselineComplete=true;tx.baselineEmpty=scan.matches===0;tx.stage='readyBuy';tx.at=now;delete tx.scan;delete tx.loadedAt;save();return true;
        }
        const expectedMatches=tx.support && Number.isSafeInteger(tx.baselineCount) ? tx.baselineCount+1 : 1;
        if(scan.matches!==expectedMatches)return deferFoodCheck('Compra de alimento sin identificar de forma única; volveré a comprobarla sin repetir.');
        const support=tx.support===true;state.foodBuyTx=null;state.foodBuyNeeded=false;state.healSkipUntil=0;
        if (support) { state.foodSupportNeeded=true; state.message='Compra de alimento confirmada; revisaré más ofertas.'; }
        else {state.packageFoodTrip=true;delete state.packageScan;state.message='Compra de alimento confirmada; recogiendo comida.';}
        log(state.message,'success');save();return true;
      }
      if(tx.stage==='readyBuy') {
        if(mod!=='guildMarket'){goldNav('#gca_shortcuts_bar a[href*="mod=guildMarket"]','guildMarket','Volviendo a la oferta de alimento.');return true;}
        if(now-goldPageOpenedAt<5000)return true;
        if (tx.support && Number(params.get('p')||'1')!==tx.offerPage) {if (!foodMarketGoPage(tx.offerPage)) return deferFoodCheck('No se pudo volver a la oferta de alimento.');return true;}
        const offers=foodMarketOffers(tx.support===true).filter(o=>o.price===tx.price&&o.seller===tx.seller&&o.food.name===tx.name&&o.food.amount===tx.amount&&o.food.level===tx.level&&o.food.item.getAttribute('data-basis')===tx.basis&&o.food.item.getAttribute('data-hash')===tx.offerHash&&/^\d+$/.test(tx.offerId||'')&&o.food.item.getAttribute('data-item-id')===tx.offerId);
        const balance=goldBalance();if(offers.length!==1||!Number.isSafeInteger(balance)||balance<tx.price){state.foodBuyTx=null;state.foodBuyRetryAt=now+60000;save();return false;}
        const offer=offers[0],original=window.confirm; if(typeof original!=='function')return false;
        tx.stage='buy';tx.at=now;tx.balanceBefore=balance;tx.confirmed=!offer.notice;save();
        try {window.confirm=message=>{if(offer.notice&&!tx.confirmed&&/^Este objeto está vinculado al alma\s+¿Realmente quieres comprar este objeto\?$/.test(String(message).trim())){tx.confirmed=true;save();return true;}tx.rejected=true;save();return false;};offer.button.click();}
        catch {state.message='Compra de alimento incierta; no repetiré.';save();} finally {window.confirm=original;} return true;
      }
      if(tx.stage==='buy') {
        if(mod!=='guildMarket')return false;
        if(now-goldPageOpenedAt<5000 || now-tx.at<5000)return true;
        if(tx.support && Number(params.get('p')||'1')!==tx.offerPage){if(foodMarketGoPage(tx.offerPage))return true;state.message='Compra de alimento incierta; no repetiré.';save();return false;}
        const still=foodMarketOffers(tx.support===true).some(o=>o.price===tx.price&&o.seller===tx.seller&&o.food.name===tx.name&&o.food.item.getAttribute('data-hash')===tx.offerHash&&o.food.item.getAttribute('data-item-id')===tx.offerId);
        if(/^\d+$/.test(tx.offerId||'')&&!still&&(tx.support===true || tx.baselineEmpty===true)&&tx.confirmed&&!tx.rejected&&Number.isSafeInteger(tx.balanceBefore)&&goldBalance()===tx.balanceBefore-tx.price){
          if(tx.support){state.foodBuyTx=null;state.foodSupportNeeded=true;state.message='Compra de alimento confirmada en mercado; revisaré más ofertas.';log(state.message,'success');save();return true;}
          tx.stage='verify';tx.at=now;delete tx.scan;delete tx.loadedAt;save();return true;
        }
        state.message='Compra de alimento incierta; no repetiré.';save();return false;
      }
    }
    const support=state.foodSupportNeeded===true;
    if ((!state.foodBuyNeeded && !support) || state.goldPreviousReview || state.goldTx || (state.smeltTx && !state.smeltTx.blocked) || state.repairTx) return false;
    if (mod!=='guildMarket') {
      if (!goldNav('#gca_shortcuts_bar a[href*="mod=guildMarket"]','guildMarket','Buscando alimento en el mercado de la alianza.')) { state.foodBuyNeeded=false; state.foodBuyRetryAt=Date.now()+60000; save(); return false; }
      return true;
    }
    if (Date.now()-goldPageOpenedAt<5000) return true;
    const balance=goldBalance(), offer=foodMarketOffers(support).find(x=>Number.isSafeInteger(balance) && x.price<=balance);
    if (!offer) {
      if (support) {const page=Number(params.get('p')||'1'),text=document.body?.innerText||'',match=text.match(/Página\s+(\d+)\s*\/\s*(\d+)/i);if(!match || Number(match[1])!==page){state.foodBuyRetryAt=Date.now()+60000;state.message='Paginación de alimentos no verificable.';save();return false;}if(page<Number(match[2])) {if(foodMarketGoPage(page+1))return true;state.foodBuyRetryAt=Date.now()+60000;state.message='No se pudo revisar la siguiente página de alimentos.';save();return false;}state.foodSupportNeeded=false;state.goldSupportSweepDone=true;state.message='Alimentos asequibles revisados; continúo con el oro.';save();return false;}
      state.foodBuyNeeded=false; state.foodBuyRetryAt=Date.now()+60000; state.message='Sin alimento asequible y verificable en la alianza.'; log(state.message,'warn'); save(); return false; }
    const item=offer.food.item,hash=item.getAttribute('data-hash'),basis=item.getAttribute('data-basis'),offerId=item.getAttribute('data-item-id');
    if(!validItemHash(hash)||!/^\d+-\d+$/.test(basis||'')||!/^\d+$/.test(offerId||'')){state.foodBuyNeeded=false;state.foodBuyRetryAt=Date.now()+60000;save();return false;}
    state.foodBuyTx={stage:support?'readyBuy':'baseline',support,offerPage:support?Number(params.get('p')||'1'):1,name:offer.food.name,amount:offer.food.amount,level:offer.food.level,basis,soul:item.getAttribute('data-soulbound-to')||null,offerHash:hash,offerId,price:offer.price,seller:offer.seller,at:Date.now()};
    state.foodBuyNeeded=false;state.message=support?'Preparando compra de alimento de alianza.':'Comprobando paquetes antes de comprar alimento.';save();
    return true;
  }
  // Una sola operación de oro por cuenta. Las etapas con efectos se guardan antes de actuar.
  const goldPriceAllowed=price=>Number.isSafeInteger(price) && price>=100000 && price<=1000000;
  const goldPageOpenedAt=Date.now();

