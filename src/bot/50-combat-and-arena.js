  function healthReading() {
    const text=document.querySelector('#header_values_hp_points')?.textContent || '';
    const match=text.match(/^\s*([\d.\s]+)\s*\/\s*([\d.\s]+)\s*$/);
    let current=match ? parseGold(match[1]) : null, maximum=match ? parseGold(match[2]) : null;
    if (!match) {
      const bar=document.querySelector('#header_values_hp_bar');
      const value=bar?.getAttribute('data-value'), max=bar?.getAttribute('data-max-value');
      if (/^\d+$/.test(value || '') && /^\d+$/.test(max || '')) { current=Number(value); maximum=Number(max); }
    }
    return Number.isSafeInteger(current) && Number.isSafeInteger(maximum) && maximum>0 && current>=0 && current<=maximum ? {current,maximum} : null;
  }
  function turmaListMiss(bar) {
    const now=Date.now(), retry=state.turmaListRetry || {count:0,next:0};
    if (now<retry.next) return;
    if (retry.count<2 && now-(state.lastNavigationAt||0)<3000) return;
    retry.count++; retry.next=now+15000; state.turmaListRetry=retry;
    if (retry.count>=3) {
      state.turmaSkipUntil=now+300000; delete state.turmaListRetry;
      state.message='Turma sin adversarios tras tres intentos; lo revisaré en cinco minutos.';
      log(state.message,'warn'); save(); return;
    }
    state.message='Turma sin adversarios; buscando de nuevo ('+retry.count+'/3).'; save();
    if (!navigation(document.querySelector(bar+' a'),'Actualizando lista de adversarios de Turma.')) { retry.count--; retry.next=0; save(); }
  }
  function readTurmaParticipation() {
    if (mod !== 'arena' || sub !== 'grouparena') return null;
    const matches=[...document.querySelectorAll('#content p')].map(p => {
      const text=(p.textContent || '').replace(/\s+/g,' ').trim();
      const match=text.match(/^Estado de participaci[oó]n actual:\s*(Activo|Pasivo)\s*$/i);
      return match ? match[1].toLocaleLowerCase('es') : null;
    }).filter(Boolean);
    return matches.length===1 ? matches[0] : null;
  }
  function checkTurmaParticipation() {
    const now=Date.now(), observed=readTurmaParticipation();
    if (observed) {
      if (state.turmaParticipation?.status!==observed || now-(state.turmaParticipation?.checkedAt||0)>=3600000 || state.turmaCheckRequested) {
        state.turmaParticipation={status:observed,checkedAt:now}; state.turmaCheckRequested=false;
        delete state.turmaListRetry; delete state.turmaSkipUntil;
        log('Circo Turma: participación '+observed+'.'); save();
      }
      return false;
    }
    if (now<(state.turmaCheckRetryAt||0)) return false;
    if (!state.turmaCheckRequested && now-(state.turmaParticipation?.checkedAt||0)<3600000) return false;
    if (mod==='arena' && sub==='grouparena') {
      state.turmaCheckRetryAt=now+300000; state.turmaCheckRequested=false;
      log('No se pudo leer el estado de participación de Turma; volveré a comprobarlo.','warn'); save(); return false;
    }
    if (now-(state.lastNavigationAt||0)<3000) return false;
    const link=document.querySelector('#mainmenu a[href*="mod=overview"]');
    try {
      const url=new URL(link?.getAttribute('href'),location.href);
      if (!visible(link) || url.origin!==location.origin || url.pathname!=='/game/index.php' || url.searchParams.get('mod')!=='overview' || url.searchParams.has('doll') || [...url.searchParams.keys()].some(k=>!['mod','sh'].includes(k))) return false;
      url.searchParams.set('mod','arena'); url.searchParams.set('submod','grouparena');
      state.turmaCheckRetryAt=now+300000; state.lastNavigationAt=now;
      state.message='Comprobando participación en Circo Turma.'; save(); location.assign(url.href); return true;
    } catch { return false; }
  }
  let stallObservation=null;
  function stallRecoveryTick(force=false) {
    if (!ownerActive || !state.running || captcha() || !verified()) {stallObservation=null;return false;}
    const hp=healthReading();
    if (BUILD_CONFIG.modules.healing && hp && hp.current<=hp.maximum*.4) {stallObservation=null;return false;}
    const txKeys=['goldTx','foodBuyTx','smeltTx','repairTx'];
    const pendingKeys=['pending','pendingFight','pendingPve','pendingHeal','pendingPackageFood','pendingLoot'];
    const pending=pendingKeys.some(k=>!!state[k]) || txKeys.some(k=>!!state[k]) || !!state.packageCollectTrip || !!state.packageFoodTrip;
    const readyBar=selector=>cooldownSeconds(document.querySelector(selector)?.textContent)===0;
    const pveReady=(BUILD_CONFIG.modules.expedition && readyBar('#cooldown_bar_expedition') && Number((document.querySelector('#expeditionpoints_value')?.textContent||'').trim().split('/')[0])>0) || (BUILD_CONFIG.modules.dungeon && readyBar('#cooldown_bar_dungeon') && Number((document.querySelector('#dungeonpoints_value')?.textContent||'').trim().split('/')[0])>0);
    const pvpReady=BUILD_CONFIG.modules.arenaCircus && ((BUILD_CONFIG.pvp?.arena!==false && readyBar('#cooldown_bar_arena')) || (BUILD_CONFIG.pvp?.turma!==false && state.turmaParticipation?.status!=='pasivo' && Date.now()>=(state.turmaSkipUntil||0) && readyBar('#cooldown_bar_ct')));
    if (!force && !pending && !pveReady && !pvpReady) {stallObservation=null;return false;}
    const signature=JSON.stringify([mod,sub,params.get('loc'),params.get('page'),params.get('p'),state.pveTarget,state.lastAction,state.lastPveAt,state.lastFightMode,...txKeys.map(k=>[state[k]?.stage,state[k]?.blocked,state[k]?.at,state[k]?.scan?.pages?.length,state[k]?.packageScan?.pages?.length,state[k]?.saleScan?.pages?.length]),...pendingKeys.map(k=>[state[k]?.kind,state[k]?.mode,state[k]?.at]),state.packageScan?.pages?.length]);
    const now=Date.now();
    const repeatedExpedition=mod==='location' && BUILD_CONFIG.modules.expedition && pveReady && !pending && Number.isFinite(state.expeditionMismatchSince) && now-state.expeditionMismatchSince>=90000;
    if (!repeatedExpedition) {
      if (!stallObservation || stallObservation.signature!==signature) {stallObservation={signature,since:now};return false;}
      if (now-stallObservation.since<90000) return false;
    }
    if (now-(state.stallRecoveryAt||0)<300000) return false;
    const allowed={overview:['mod','doll','sh'],location:['mod','loc','sh'],map:['mod','submod','sh'],arena:['mod','submod','aType','sh'],packages:['mod','f','fq','qry','page','sh'],guildMarket:['mod','fl','fq','f','qry','seller','s','p','sh'],forge:['mod','submod','sh'],quests:['mod','sh'],reports:['mod','submod','t','reportId','sh']};
    let url;try {url=new URL(location.href);} catch {return false;}
    if (!allowed[mod] || url.origin!==location.origin || url.pathname!=='/game/index.php' || url.searchParams.getAll('mod').length!==1 || url.searchParams.get('mod')!==mod || [...url.searchParams.keys()].some(k=>!allowed[mod].includes(k)) || allowed[mod].some(k=>url.searchParams.getAll(k).length>1)) return false;
    if (mod==='map' && !['city','country'].includes(sub)) return false;
    if (mod==='arena' && !['grouparena','serverArena'].includes(sub)) return false;
    if (mod==='reports' && (sub!=='showCombatReport' || !/^\d+$/.test(params.get('reportId')||'') || !['0','1','2','3'].includes(params.get('t')))) return false;
    if (mod==='forge' && !['forge','smeltery','workbench','storage'].includes(sub)) return false;
    state.stallRecoveryAt=now;state.message='Sin avance; recargando la página para recuperar la cola.';log(state.message,'warn');save();stallObservation=null;location.assign(url.href);return true;
  }
  function combatTick() {
    if (!ownerActive || !state.running) return;
    if (captcha()) return stop('CAPTCHA detectado. Intervención humana requerida.');
    if (!verified()) { if (renewIdentity()) return; return stop('Identidad sin verificar. Abre Visión general del personaje y reactiva.'); }
    if (typeof tabernaBusyUntil === 'number' && Date.now() < tabernaBusyUntil) return;
    if (!state.repairTx && lootTick()) return;
    const levelDialog=document.querySelector('#blackoutDialognotification');
    if (levelDialog && !visible(levelDialog)) noticeAttempts.delete(levelDialog);
    if (visible(levelDialog)) {
      if (/(?:subid[oa]|alcanzad[oa]|nuevo).{0,40}nivel|nivel.{0,40}(?:subid[oa]|alcanzad[oa]|nuevo)/i.test(levelDialog.textContent || '') && !/rub[ií]|diamant|premium|reducir tiempo/i.test(levelDialog.textContent || '')) return recoverUnexpectedPopup(levelDialog,'nivel');
      return recoverUnexpectedPopup(levelDialog,'notificación desconocida');
    }
    for (const selector of ['#blackoutDialog','#blackoutDialogLoginBonus']) {
      const dialog=document.querySelector(selector);
      if (dialog && !visible(dialog)) noticeAttempts.delete(dialog);
      if (visible(dialog)) return recoverUnexpectedPopup(dialog,'aviso desconocido');
    }
    if (mod === 'overview' && params.has('doll') && !['0','1'].includes(params.get('doll'))) {
      navigation(document.querySelector('#mainmenu a[href*="mod=overview"]'), 'Volviendo al personaje principal.'); return;
    }
    const dialog = document.querySelector('#blackoutDialogbod');
    if (visible(dialog)) {
      const header=dialog.querySelector('#header_bod')?.textContent.trim() || '';
      const text=(dialog.querySelector('#bashtext')?.textContent || '').replace(/\s+/g,' ').trim();
      const confirm=dialog.querySelector('#linkbod');
      const match=text.match(/^Hoy ya has luchado (\d+) veces contra ([\s\S]+), por lo que este sería un ataque deshonroso\. En caso de victoria, no le quitarás oro a tu adversario\.$/);
      const recognized=match && Number(match[1])>=5 && match[2].trim().length>0;
      if (!/^¿Deseas atacar de todos modos\?$/i.test(header) || !recognized || !visible(confirm) || confirm.disabled || confirm.value!=='¡Ir!' || !/^\s*startProvinciarumFightConfirmed\(\)\s*;?\s*$/.test(confirm.getAttribute('onclick') || '') || /rub[ií]|diamant|premium|reducir tiempo/i.test(dialog.textContent)) return recoverUnexpectedPopup(dialog,'combate desconocido');
      const shownRival=match[2].trim();
      if (!state.pendingFight) state.pendingFight={name:shownRival,mode:params.get('aType')==='2'?'arena-provinciarum':'turma-provinciarum',at:Date.now(),unattributed:true};
      const fight=state.pendingFight;
      if (shownRival.toLocaleLowerCase()!==String(fight.name).trim().toLocaleLowerCase()) {
        if (!fight.unattributed) log('El aviso menciona a '+shownRival+', distinto del rival pendiente '+fight.name+'; resultado sin atribuir.','warn');
        fight.unattributed=true;
      }
      const attempts=fight.confirmAttempts || (fight.confirmedAt ? 1 : 0);
      if (!attempts || (attempts<2 && Date.now()-fight.confirmedAt>=20000)) {
        fight.confirmAttempts=attempts+1; fight.confirmedAt=Date.now(); fight.at=Date.now();
        state.message=(attempts ? 'Reintentando aviso de combate contra ' : 'Confirmando combate sin botín de oro contra ')+shownRival+'.';
        log(state.message,'action'); save(); confirm.click(); return;
      }
      if (attempts>=2 && Date.now()-fight.confirmedAt>=30000) {
        const cancel=dialog.querySelector('input[onclick="blackoutDialog(false)"]');
        if (visible(cancel) && !cancel.disabled) {
          state.fightRetryAt=Date.now()+45000; discardPendingFight('El aviso siguió abierto tras dos intentos; esperaré antes de combatir.'); cancel.click();
        } else {
          state.message='Aviso sin confirmar; esperando antes de volver a comprobar.'; save();
        }
      }
      return;
    }
    // No ejecutar otras tareas mientras la ubicación del equipo siga pendiente.
    if (state.repairTx) { safeRepairTick(); return; }
    const hpText = (document.querySelector('#header_values_hp_percent')?.textContent || '').trim();
    const hpMatch = hpText.match(/^(\d{1,3})\s*%$/);
    const reading=healthReading(), current=reading?.current, maximum=reading?.maximum;
    const hp = hpMatch ? Number(hpMatch[1]) : NaN;
    if ((hpMatch && hp > 100) || current === null || !Number.isSafeInteger(current) || !Number.isSafeInteger(maximum) || maximum <= 0 || current > maximum) {
      if (state.message !== 'Esperando datos fiables de salud; volveré a comprobarlos.') { state.message='Esperando datos fiables de salud; volveré a comprobarlos.'; log(state.message,'warn'); save(); }
      return;
    }
    const healthPercent=Number.isFinite(hp) ? Math.min(hp, 100 * current / maximum) : 100 * current / maximum;
    if (pveStallTick(healthPercent)) return;
    if (state.pendingFight) {
      const isArenaPending = state.pendingFight.mode === 'arena-provinciarum';
      if (mod === 'reports' && sub === 'showCombatReport' && params.get('t') === (isArenaPending ? '2' : '3')) {
        const fight = state.pendingFight;
        if (fight.unattributed) { discardPendingFight('El aviso previo mostraba un rival distinto; resultado sin atribuir.'); return; }
        const arenaFight = fight.mode === 'arena-provinciarum';
        const defenderNode = document.querySelector('#defenderAvatar11');
        const directName = defenderNode?.childNodes ? [...defenderNode.childNodes].filter(n=>n.nodeType===3).map(n=>n.textContent).join('').trim() : '';
        const defender = defenderNode?.innerText?.split('\n').map(s=>s.trim()).find(Boolean) || directName || defenderNode?.textContent.trim() || '';
        const attackerNode = arenaFight ? document.querySelector('#attackerAvatar1') : null;
        const attacker = attackerNode?.innerText?.split('\n').map(s=>s.trim()).find(Boolean) || attackerNode?.textContent.trim() || '';
        const defenderMatches = !!defender && new RegExp('^' + fight.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?:\\s|$)', 'i').test(defender);
        if (arenaFight && (!attacker || attacker.toLocaleLowerCase() !== accountName.toLocaleLowerCase() || !defenderMatches) && Date.now() - fight.at <= 15000) return;
        if (arenaFight && attacker.toLocaleLowerCase() !== accountName.toLocaleLowerCase()) { discardPendingFight('Atacante de Arena no verificable.'); return; }
        if (!defenderMatches) { discardPendingFight('El informe corresponde a otro rival o no es reconocible.'); return; }
        const winner = [...document.querySelectorAll('#content td')].map(e => e.textContent.trim()).find(t => /^Ganador:\s*/i.test(t));
        if (!winner) { discardPendingFight('No se pudo identificar el ganador.'); return; }
        const winnerName = winner.replace(/^Ganador:\s*/i, '').trim();
        if (winnerName.toLocaleLowerCase() !== accountName.toLocaleLowerCase() && winnerName.toLocaleLowerCase() !== fight.name.toLocaleLowerCase()) { discardPendingFight('El ganador no coincide con el combate pendiente.'); return; }
        const result = winnerName.toLocaleLowerCase() === accountName.toLocaleLowerCase() ? 'win' : 'loss';
        const gold = reportGold(document.querySelector('#content')?.innerText);
        const damageEstimate = Number.isSafeInteger(fight.healthBefore) ? Math.max(0, fight.healthBefore-current) : null;
        const xp=xpReading();
        const experience = xp && fight.xpBefore && xp.maximum === fight.xpBefore.maximum && xp.current >= fight.xpBefore.current ? xp.current - fight.xpBefore.current : null;
        state.records.push({name:fight.name,server:fight.server,mode:fight.mode || 'turma-provinciarum',level:fight.level,rivalLevel:fight.rivalLevel,result,gold,damageEstimate,experience,source:'informe',at:new Date().toISOString()});
        log((result === 'win' ? 'Victoria' : 'Derrota') + ' contra ' + fight.name + '.');
        state.pendingFight = null; state.message = 'Combate registrado. Esperando disponibilidad.'; save();
      } else if (Date.now() - state.pendingFight.at > 15000) { discardPendingFight('El informe no llegó a tiempo.'); return; }
      else return;
    }
    if (state.pendingPve) {
      const p=state.pendingPve, expected=p.mode==='expedition'?'0':'1';
      if (mod==='reports' && sub==='showCombatReport' && params.get('t')===expected) {
        const attacker=(document.querySelector('#attackerAvatar1')?.innerText || document.querySelector('#attackerAvatar1')?.textContent || '').trim();
        const winner=[...document.querySelectorAll('#content div')].map(x=>x.textContent.trim()).find(x=>/^Ganador:\s*[^\n]+$/.test(x));
        const winnerName=winner?.replace(/^Ganador:\s*/i,'').trim() || '';
        const defenderNode=document.querySelector('#defenderAvatar11');
        const defender=(defenderNode?.innerText || defenderNode?.textContent || '').split('\n').map(x=>x.trim()).find(Boolean) || '';
        const normal=value=>String(value || '').normalize('NFKC').trim().toLocaleLowerCase('es');
        const attackerOK=normal(attacker)===normal(accountName);
        const defenders=[defender,...[...document.querySelectorAll('[id^="defenderAvatar"]')].map(node=>(node.innerText || node.textContent || '').split('\n').map(x=>x.trim()).find(Boolean) || '')].filter(Boolean);
        const enemyWon=defender && winnerName && normal(winnerName)!==normal(accountName) && defenders.some(name=>normal(name)===normal(winnerName));
        const result=attackerOK && winnerName && normal(winnerName)===normal(accountName) ? 'win' : attackerOK && enemyWon ? 'loss' : null;
        // El informe puede aparecer antes de que el juego termine de rellenar sus participantes.
        if (!result && Date.now()-p.at<15000) return;
        const confirmed=!!result;
        if (p.mode==='dungeon') recordDungeonOutcome(p,result,defender,params.get('reportId'));
        if (p.mode==='dungeon' && !confirmed) { state.dungeonCombatUnknown={dungeonId:p.dungeonId,at:p.at,reason:'Informe no concluyente'}; if (state.dungeonLosses) state.dungeonLosses.uncertain=true; }
        const gold=confirmed ? reportGold(document.querySelector('#content')?.innerText) : null;
        state.statsEvents.push({kind:'pve',mode:p.mode,at:Date.now(),confirmed,result,gold});
        log((p.mode==='expedition'?'Expedición':'Mazmorra')+': '+(result==='win'?'victoria':result==='loss'?'derrota':'resultado desconocido')+'.',confirmed?'success':'warn');
        state.pendingPve=null; state.pendingLoot=null; save(); return;
      }
      if (Date.now()-p.at<30000) return;
      if (p.mode==='dungeon') { state.dungeonCombatUnknown={dungeonId:p.dungeonId,at:p.at,reason:'Informe no recibido a tiempo'}; if (state.dungeonLosses) state.dungeonLosses.uncertain=true; }
      log('Resultado de '+(p.mode==='expedition'?'expedición':'mazmorra')+' desconocido.','warn'); state.pendingPve=null; save(); return;
    }
    if (state.foodBuyTx && foodMarketTick()) return;
    if (goldTick(true)) return;
    if (state.packageCollectTrip) { if (packageFoodTick()) return; }
    if (healthPercent > 40 && (state.pendingHeal || state.packageFoodTrip || state.pendingPackageFood)) {
      const p=state.pendingHeal;
      const selected=[...document.querySelectorAll('#inventory_nav a')].findIndex(a=>a.classList.contains('current'));
      const item=p && inventoryItemByHash(p.hash);
      const confirmed=p && validItemHash(p.hash) && mod==='overview' && !!document.querySelector('#inv') && Number.isInteger(p.bagIndex) && selected===p.bagIndex && !item && current>p.before;
      if (confirmed) log('Curación confirmada: '+p.name+'.','success');
      else if (p) log('Vida recuperada; resultado de la curación anterior desconocido.','warn');
      if (state.pendingPackageFood) log('Búsqueda de alimento interrumpida: vida suficiente; traslado anterior sin confirmar.','warn');
      state.pendingHeal=null; rememberUnknownPackageFood(); state.packageFoodTrip=false; state.healSkipUntil=0;
      state.message='Vida suficiente; continuando con la cola.'; log(state.message); save();
    }
    if (BUILD_CONFIG.modules.foodMarket && state.foodBuyNeeded && healthPercent<=40 && foodMarketTick()) return;
    if (state.packageFoodTrip && mod === 'packages') return packageFoodTick();
    if (state.pendingHeal || state.packageFoodTrip || state.pendingPackageFood || (BUILD_CONFIG.modules.healing && healthPercent <= 40 && Date.now() >= (state.healSkipUntil || 0))) return healTick(current, maximum);
    if (state.smeltTx && safeSmeltingTick()) return;
    if (BUILD_CONFIG.modules.repair && safeRepairTick()) return;
    if (BUILD_CONFIG.modules.guildGold && BUILD_CONFIG.modules.foodMarket && !state.goldTx && !state.goldPreviousReview) {
      const balance=goldBalance();
      if (Number.isSafeInteger(balance) && balance<=200000 && state.goldSupportSweepDone) {state.goldSupportSweepDone=false;save();}
      if (Number.isSafeInteger(balance) && balance>200000 && !state.goldSupportSweepDone && !state.foodSupportNeeded) {state.foodSupportNeeded=true;state.foodSupportCount=0;save();}
      if (state.foodSupportNeeded && Date.now()>=(state.foodBuyRetryAt||0) && foodMarketTick()) return;
    }
    // Una búsqueda de apoyo aplazada no debe bloquear el ciclo de oro; una
    // compra incierta sigue protegida por foodBuyTx dentro de goldTick.
    if (!BUILD_CONFIG.modules.foodMarket || !state.foodSupportNeeded || Date.now()<(state.foodBuyRetryAt||0)) { if (BUILD_CONFIG.modules.guildGold && goldTick()) return; }
    if (BUILD_CONFIG.modules.healing && healthPercent>40 && !state.goldTx && !state.smeltTx && !state.repairTx && Date.now()>=(state.packageCollectAt||0)) {
      state.packageCollectTrip=true; state.packageCollectAt=Date.now()+120000; delete state.packageScan; delete state.packageWaitAt; save();
      if (packageFoodTick()) return;
    }
    if (BUILD_CONFIG.modules.smelting && safeSmeltingTick()) return;
    if (mod === 'quests' && BUILD_CONFIG.modules.missions && (state.pending || Date.now() - (state.lastQuestVisit || 0) >= 30000)) {
      questTick();
      if (!state.running) return;
      if (state.running && !state.pending) {
        state.lastQuestVisit = Date.now(); save();
        if (BUILD_CONFIG.modules.arenaCircus && navigation(document.querySelector(BUILD_CONFIG.pvp?.turma===false || (BUILD_CONFIG.pvp?.arena!==false && state.turmaParticipation?.status==='pasivo') ? '#cooldown_bar_arena a' : '#cooldown_bar_ct a'), 'Volviendo a combates Provinciarum.')) return;
      }
      if (state.pending) return;
    }
    if (BUILD_CONFIG.modules.healing && healthPercent<=40) {
      if (BUILD_CONFIG.modules.missions && mod!=='quests' && Date.now()>=(state.questRetryAt||0) && Date.now()-(state.lastQuestVisit||0)>=30000 && navigation(document.querySelector('#mainmenu a[href*="mod=quests"]'),'Revisando misiones mientras recupero vida.')) return;
      if (state.message!=='Vida baja; esperando curación antes de combatir.') {state.message='Vida baja; esperando curación antes de combatir.';log(state.message,'warn');save();}
      return;
    }
    if (BUILD_CONFIG.modules.arenaCircus && BUILD_CONFIG.pvp?.turma!==false && checkTurmaParticipation()) return;
    if (pveTick()) return;
    if (BUILD_CONFIG.modules.missions && !BUILD_CONFIG.modules.arenaCircus && mod !== 'quests' && Date.now() >= (state.questRetryAt || 0) && Date.now() - (state.lastQuestVisit || 0) >= 30000) {
      if (navigation(document.querySelector('#mainmenu a[href*="mod=quests"]'), 'Revisando misiones del Panteón.')) return;
    }
    if (!BUILD_CONFIG.modules.arenaCircus) { updateMessage('Esperando disponibilidad de los módulos elegidos.'); return; }
    const identity = JSON.parse(sessionStorage.getItem(ID) || '{}');
    if (Date.now() - identity.at > 12 * 60 * 1000 && mod !== 'overview') {
      navigation(document.querySelector('#mainmenu a[href*="mod=overview"]'), 'Verificando personaje.'); return;
    }
    const ctRemaining = cooldownSeconds(document.querySelector('#cooldown_bar_ct')?.textContent);
    const arenaRemaining = cooldownSeconds(document.querySelector('#cooldown_bar_arena')?.textContent);
    const arenaReady = BUILD_CONFIG.pvp?.arena!==false && arenaRemaining === 0;
    const ctReady = BUILD_CONFIG.pvp?.turma!==false && ctRemaining === 0 && state.turmaParticipation?.status !== 'pasivo' && Date.now() >= (state.turmaSkipUntil || 0);
    const type = arenaReady && (!ctReady || state.lastFightMode !== 'arena-provinciarum') ? '2' : '3';
    const mode = type === '2' ? 'arena-provinciarum' : 'turma-provinciarum';
    const bar = type === '2' ? '#cooldown_bar_arena' : '#cooldown_bar_ct';
    const remaining = type === '2' ? arenaRemaining : ctRemaining;
    if (BUILD_CONFIG.modules.missions && !arenaReady && !ctReady && (remaining === null || remaining > 12) && Date.now() >= (state.questRetryAt || 0) && Date.now() - (state.lastQuestVisit || 0) >= 30000) {
      const quest = document.querySelector('#mainmenu a[href*="mod=quests"]');
      if (navigation(quest, 'Revisando misiones del Panteón.')) return;
    }
    if (!arenaReady && !ctReady && (state.turmaParticipation?.status === 'pasivo' || Date.now() < (state.turmaSkipUntil || 0))) { updateMessage('Turma aplazado; esperando otras tareas.'); return; }
    if (!arenaReady && !ctReady) {
      const waits=[BUILD_CONFIG.pvp?.arena!==false ? arenaRemaining : null,BUILD_CONFIG.pvp?.turma!==false ? ctRemaining : null].filter(Number.isFinite);
      updateMessage(waits.length ? 'Esperando disponibilidad: '+Math.min(...waits)+' s.' : 'Esperando tiempos de combate verificables.'); return;
    }
    if (mod !== 'arena' || sub !== 'serverArena' || params.get('aType') !== type) {
      navigation(document.querySelector(bar + ' a'), 'Abriendo ' + (type === '2' ? 'Arena' : 'Circo') + ' Provinciarum.'); return;
    }
    const cooldown = document.querySelector(bar);
    if (remaining !== 0) {
      updateMessage('Esperando disponibilidad: ' + (cooldown?.textContent.trim() || 'tiempo desconocido')); return;
    }
    captureRivals();
    const table = [...document.querySelectorAll('#content table')].find(t => /Nombre\s+Nivel/.test(t.innerText));
    const level = Number((document.querySelector('#header_values_level')?.textContent || '').replace(/\D/g,''));
    if (!table || !level) {
      if (type === '3') { turmaListMiss(bar); return; }
      state.message='Lista de rivales no disponible; volveré a comprobarla.';
      if (Date.now()-(state.lastListWarningAt || 0)>=60000) { state.lastListWarningAt=Date.now(); log(state.message,'warn'); }
      save(); return;
    }
    rivalIndex.sync(state.records);
    const candidates = [...table.rows].slice(1).map(row => {
      const cells=[...row.cells], name=cells[0]?.innerText.trim(), rivalLevel=Number(cells[1]?.innerText.trim()), server=cells[2]?.innerText.trim(), button=row.querySelector('.attack');
      const {wins,losses,damage,experience}=rivalIndex.combat({name,server,mode,level});
      return {name,rivalLevel,server,button,wins,losses,damage,experience};
    }).filter(r => realm && r.name && r.server && Number.isInteger(r.rivalLevel) && visible(r.button) && new RegExp('^startProvinciarumFight\\(this,\\s*' + type + ',\\s*\\d+,\\s*\\d+,\\s*[\'"]' + realm + '[\'"]\\);?$').test(r.button.getAttribute('onclick') || '') && !/(rub[ií]|diamant|premium)/i.test(r.button.outerHTML));
    candidates.sort((a,b) => (a.losses>0)-(b.losses>0) || (b.wins>0)-(a.wins>0) || (a.experience === null)-(b.experience === null) || (b.experience ?? 0)-(a.experience ?? 0) || (a.damage === null)-(b.damage === null) || (a.damage ?? 0)-(b.damage ?? 0) || a.rivalLevel-b.rivalLevel);
    const target=candidates[0];
    if (!target) {
      if (type === '3') { turmaListMiss(bar); return; }
      if (Date.now() - (state.emptyListReloadAt || 0) > 60000) { if (navigation(document.querySelector(bar + ' a'), 'Actualizando lista de adversarios.')) { state.emptyListReloadAt=Date.now(); save(); } return; }
      updateMessage('Sin adversarios reconocidos; volveré a revisar la lista.'); return;
    }
    if (Date.now() < (state.fightRetryAt || 0)) { updateMessage('Esperando para volver a combatir tras un aviso sin confirmar.'); return; }
    state.emptyListReloadAt=0;
    if (type === '3') { delete state.turmaListRetry; delete state.turmaSkipUntil; }
    state.pendingFight={name:target.name,server:target.server,rivalLevel:target.rivalLevel,level,mode,healthBefore:current,xpBefore:xpReading(),at:Date.now()};
    state.lastFightMode=mode;
    state.lastAction='pvp'; delete state.pvpWaitSince;
    state.message='Iniciando combate contra '+target.name+'.'; log(state.message, 'action'); save(); target.button.click();
  }

