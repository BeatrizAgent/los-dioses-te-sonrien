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
  function packageFoodTick() {
    const inv=document.querySelector('#inv'), packages=document.querySelector('#packages');
    if (!inv || !packages) {
      if (!state.packageWaitAt) { state.packageWaitAt=Date.now(); state.message='Esperando a que carguen los paquetes.'; save(); }
      else if (Date.now()-state.packageWaitAt>15000) { state.pendingPackageFood=null; delete state.packageWaitAt; skipHealing('Paquetes no disponibles; sigo con la cola.'); }
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
    if (!bag || !visible(bag)) { state.pendingPackageFood=null; skipHealing('Baúl I no disponible; sigo con la cola.'); return true; }
    if (!bag.classList.contains('current')) { bag.click(); state.message='Seleccionando baúl I.'; save(); return true; }
    const inventory=[...inv.querySelectorAll('.ui-draggable[data-hash]')];
    if (inventory.some(x=>{
      const container=x.getAttribute('data-container-number');
      const arriving=state.pendingPackageFood && x.getAttribute('data-hash')===state.pendingPackageFood.hash;
      return container !== '512' && !(arriving && !container);
    })) { state.pendingPackageFood=null; skipHealing('No se pudo verificar el baúl I; sigo con la cola.'); return true; }
    if (state.pendingPackageFood) {
      const p=state.pendingPackageFood;
      const count=inventory.filter(x=>x.getAttribute('data-hash') === p.hash).length;
      if (count>p.before) {
        state.pendingPackageFood=null; state.packageFoodTrip=false; log('Alimento recibido en el baúl I: '+p.name+'.','success'); save();
        navigation(document.querySelector('#mainmenu a[href*="mod=overview"]'), 'Volviendo para curar.'); return true;
      }
      if (Date.now()-p.at>15000) { state.pendingPackageFood=null; skipHealing('Traslado de alimento sin confirmar; sigo con la cola.'); }
      return true;
    }
    const level=Number((document.querySelector('#header_values_level')?.textContent || '').replace(/\D/g,''));
    const pageKey=(params.get('page') || '1')+':'+params.get('f');
    if (state.packageScan?.key!==pageKey) { state.packageScan={key:pageKey,at:Date.now()}; state.message='Esperando los alimentos y el complemento de paquetes.'; save(); return true; }
    if (Date.now()-state.packageScan.at<5000) return true;
    const candidates=[...packages.querySelectorAll('.ui-draggable[data-tooltip][data-hash]')].filter(visible).map(healingFood).filter(x=>x && (x.level===null || (level>0 && x.level<=level)));
    const food=candidates.find(x=>x.item.hasAttribute('data-gca-flag_double-click-event') && validItemHash(x.item.getAttribute('data-hash')));
    if (!food) {
      const next=document.querySelector('.paging_right_step');
      if (!visible(next)) {
        const invalid=candidates.some(x=>x.item.hasAttribute('data-gca-flag_double-click-event') && !validItemHash(x.item.getAttribute('data-hash')));
        skipHealing(invalid ? 'Alimento sin identificador verificable; revisaré después.' : candidates.length ? 'Hay comida, pero Crazy Addon no habilitó su traslado; revisaré después.' : 'Sin comida utilizable en paquetes; sigo con la cola.'); return true;
      }
      let url; try { url=new URL(next.getAttribute('href'),location.href); } catch { return stop('Paginación de paquetes no reconocible.'); }
      const pages=url.searchParams.getAll('page'), nextPage=Number(pages.at(-1)), currentPage=Number(params.get('page') || 1);
      const visited=Array.isArray(state.packagePages) ? state.packagePages : [];
      if (url.origin!==location.origin || url.pathname!=='/game/index.php' || url.searchParams.get('mod')!=='packages' || url.searchParams.get('f')!=='7' || !Number.isSafeInteger(nextPage) || nextPage<=currentPage || visited.includes(nextPage) || visited.length>=50) return stop('Paginación de paquetes no verificable.');
      state.packagePages=[...visited,currentPage]; state.message='Revisando página '+nextPage+' de alimentos.'; save(); next.click(); return true;
    }
    const hash=food.item.getAttribute('data-hash');
    state.pendingPackageFood={hash,name:food.name,before:inventory.filter(x=>x.getAttribute('data-hash')===hash).length,at:Date.now()};
    state.message='Recogiendo alimento: '+food.name+'.'; log(state.message,'action'); save();
    food.item.dispatchEvent(new MouseEvent('dblclick',{bubbles:true,cancelable:true,view:window})); return true;
  }
  function skipHealing(message) {
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
    const foods=[...document.querySelectorAll('#inv .ui-draggable[data-tooltip][data-hash]')].map(healingFood).filter(x=>x && validItemHash(x.item.getAttribute('data-hash')));
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
  // Una sola operación de oro por cuenta. Las etapas con efectos se guardan antes de actuar.
  const GOLD_PRICES=[100000,300000,500000,1000000];
  const goldPageOpenedAt=Date.now();
