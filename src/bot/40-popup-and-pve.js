  function recoverPopup(kind) {
    if (captcha()) { stop('CAPTCHA detectado. Intervención humana requerida.'); return true; }
    const reportId=params.get('reportId'), type=params.get('t');
    const safeReport=mod==='reports' && sub==='showCombatReport' && /^\d+$/.test(reportId || '') && ['0','1'].includes(type) && [...params.keys()].every(k=>['mod','submod','reportId','t','sh'].includes(k));
    const key=kind+':' +(safeReport ? type+':'+reportId : 'overview');
    if (state.popupRecovery?.key===key && Date.now()-state.popupRecovery.at<300000) { stop('El aviso persiste tras recargar; revisión necesaria.'); return true; }
    let target;
    if (safeReport) target=location.href;
    else {
      const link=document.querySelector('#mainmenu a[href*="mod=overview"]');
      try { const u=new URL(link?.getAttribute('href'),location.href); if (visible(link) && u.origin===location.origin && u.pathname==='/game/index.php' && u.searchParams.get('mod')==='overview' && !u.searchParams.has('doll') && [...u.searchParams.keys()].every(k=>['mod','sh'].includes(k))) target=u.href; } catch {}
    }
    if (!target) { stop('No hay una página segura para recuperar el aviso.'); return true; }
    state.popupRecovery={key,at:Date.now()}; state.message='Recargando para recuperar aviso de '+kind+'; resultado anterior no confirmado.'; log(state.message,'warn'); save(); location.assign(target); return true;
  }
  function recoverUnexpectedPopup(dialog, kind) {
    const text=(dialog?.textContent || '').normalize('NFKC');
    if (captcha() || /captcha|turnstile|verificaci[oó]n|verificar.{0,30}(?:humano|identidad|cuenta)|security\s*check|human\s*verification/i.test(text)) {
      stop('Posible verificación detectada. Intervención humana requerida.'); return true;
    }
    return recoverPopup(kind);
  }
  function lootTick() {
    const dialog=document.querySelector('#blackoutDialog.loot-modal');
    if (!visible(dialog)) return false;
    const reportId=params.get('reportId'), type=params.get('t');
    const buttons=[...dialog.querySelectorAll('button')];
    const button=buttons.find(b=>b.textContent.trim()==='Búsqueda exhaustiva');
    const handler=button?.getAttribute('onclick') || '';
    if (/rub[ií]|diamant|premium|reducir tiempo/i.test(dialog.textContent+' '+(button?.outerHTML || ''))) { stop('Aviso de botín con coste no verificado; revisión necesaria.'); return true; }
    if (mod!=='reports' || sub!=='showCombatReport' || !['0','1'].includes(type) || !/^\d+$/.test(reportId || '') || !/Desvalijar a /i.test(dialog.querySelector('#header_')?.textContent || '')) return recoverUnexpectedPopup(dialog,'botín desconocido');
    if (!visible(button) || button.disabled) return recoverPopup('botín');
    const expected=new RegExp('^\\s*runAction\\(this,\\s*'+type+',\\s*'+reportId+',\\s*4,\\s*function\\s*\\(\\)\\s*\\{\\s*location\\.reload\\(\\)\\s*\\}\\)\\s*;?\\s*$');
    if (!expected.test(handler)) return recoverPopup('botín');
    if (state.pendingLoot?.reportId===reportId && state.pendingLoot?.type===type) { if (Date.now()-state.pendingLoot.at>=15000) return recoverPopup('botín'); state.message='Esperando confirmación de búsqueda exhaustiva.'; save(); return true; }
    state.pendingLoot={reportId,type,at:Date.now()}; state.message='Buscando botín de forma exhaustiva.'; log(state.message,'action'); save(); button.click(); return true;
  }
  function recordDungeonOutcome(p, result, rival, reportId) {
    const dungeonId=p.dungeonId, enemy=String(rival || '').normalize('NFKC').trim().toLocaleLowerCase('es');
    if (!dungeonId || !/^\d+$/.test(reportId || '') || !enemy || !['win','loss'].includes(result)) { state.dungeonLosses=null; return; }
    const prev=state.dungeonLosses;
    if (prev?.lastReport===reportId) return;
    if (result==='win') { state.dungeonLosses=null; return; }
    const count=prev?.dungeonId===dungeonId && prev.enemy===enemy ? prev.count+1 : 1;
    state.dungeonLosses={dungeonId,enemy,count,lastReport:reportId};
    const limit=Number.isInteger(BUILD_CONFIG.dungeon?.lossLimit) ? BUILD_CONFIG.dungeon.lossLimit : 3;
    if (count>=limit) state.dungeonReset={dungeonId,phase:'needed'};
  }
  function pveTick() {
    const definitions={expedition:{mod:'location',bar:'#cooldown_bar_expedition',points:'#expeditionpoints_value',label:'expedición'},dungeon:{mod:'dungeon',bar:'#cooldown_bar_dungeon',points:'#dungeonpoints_value',label:'mazmorra'}};
    const choices=[];
    if (BUILD_CONFIG.modules.expedition && BUILD_CONFIG.expedition) choices.push('expedition');
    if (BUILD_CONFIG.modules.dungeon && BUILD_CONFIG.dungeon) choices.push('dungeon');
    if (!choices.length) return false;
    const ready=key=>{const d=definitions[key],bar=document.querySelector(d.bar),text=document.querySelector(d.points)?.textContent.trim() || '',match=text.match(/^(\d+)(?:\s*\/\s*\d+)?$/),points=match ? Number(match[1]) : NaN;return Number.isSafeInteger(points)&&points>0&&cooldownSeconds(bar?.textContent)===0&&visible(bar?.querySelector('a'));};
    let selected=choices.includes(state.pveTarget) ? state.pveTarget : null;
    if (state.dungeonReset && choices.includes('dungeon')) selected='dungeon';
    if (!selected || (!ready(selected) && !(selected==='dungeon' && state.dungeonReset))) {
      const arenaReady=cooldownSeconds(document.querySelector('#cooldown_bar_arena')?.textContent)===0 || cooldownSeconds(document.querySelector('#cooldown_bar_ct')?.textContent)===0;
      if ((arenaReady && state.lastAction==='pve') || Date.now()-(state.lastPveAt||0)<20000) return false;
      const options=choices.filter(ready);
      selected=options.find(x=>x!==state.lastPveMode) || options[0];
      if (!selected) return false;
      state.pveTarget=selected; save();
    }
    const d=definitions[selected],link=document.querySelector(d.bar+' a');
    const chosen=selected==='expedition' ? BUILD_CONFIG.expedition : BUILD_CONFIG.dungeon;
    const area=chosen?.area;
    if (!area?.id || !area?.name || !Number.isInteger(area.entryLevel) || area.entryLevel>BUILD_CONFIG.playerLevel) {
      state.pveTarget=null; state.lastPveAt=Date.now(); state.message='Configuración PvE incompleta o por encima del nivel declarado.'; log(state.message,'warn'); save(); return true;
    }
    const links=[...document.querySelectorAll('#mainnav a, #mainmenu a')];
    const sameName=value=>String(value||'').normalize('NFKC').replace(/\s+/g,' ').trim().toLocaleLowerCase('es');
    const areaLink=links.find(a=>sameName(a.textContent)===sameName(area.name) && visible(a));
    let areaLoc=null;
    try { const u=new URL(areaLink?.getAttribute('href'),location.href); if (u.origin===location.origin && u.pathname==='/game/index.php' && u.searchParams.get('mod')==='location' && /^\d+$/.test(u.searchParams.get('loc')||'') && !u.searchParams.has('action')) areaLoc=u.searchParams.get('loc'); } catch {}
    const currentArea=links.some(a=>sameName(a.textContent)===sameName(area.name) && visible(a));
    const inConfiguredArea=currentArea && areaLoc!==null && params.get('loc')===areaLoc;
    let dungeonLink=null,dungeonLoc=null;
    if (selected==='dungeon') {
      dungeonLink=link;
      try { const u=new URL(dungeonLink?.getAttribute('href'),location.href); if (u.origin===location.origin && u.pathname==='/game/index.php' && u.searchParams.get('mod')==='dungeon' && /^\d+$/.test(u.searchParams.get('loc')||'') && !u.searchParams.has('action')) dungeonLoc=u.searchParams.get('loc'); } catch {}
    }
    if (!areaLink || areaLoc===null || (selected==='dungeon' && (!dungeonLink || dungeonLoc===null))) {
      // Tras visitar la ciudad, sus enlaces sustituyen el menú de zonas.
      // Volver al territorio solo mediante el enlace GET visible y conocido.
      if ((!areaLink || areaLoc===null) && visible(document.querySelector('#submenuhead1'))) {
        const country=[...document.querySelectorAll('#submenuhead1 a.submenuswitch')].find(a=>{
          if (!visible(a)) return false;
          try { const u=new URL(a.getAttribute('href'),location.href); return u.origin===location.origin && u.pathname==='/game/index.php' && u.searchParams.get('mod')==='map' && u.searchParams.get('submod')==='country' && [...u.searchParams.keys()].every(k=>['mod','submod','sh'].includes(k)); } catch { return false; }
        });
        if (country) { navigation(country,'Volviendo al territorio para encontrar la zona PvE.'); return true; }
      }
      state.pveTarget=null; state.lastPveAt=Date.now(); state.message='La ruta de la zona elegida no aparece o no se puede comprobar; no atacaré.'; log(state.message,'warn'); save(); return true;
    }
    if (selected==='expedition' && (mod!=='location' || !inConfiguredArea)) {
      navigation(areaLink,'Abriendo '+area.name+' para la expedición elegida.'); return true;
    }
    if (selected==='dungeon') {
      if (!inConfiguredArea || (mod!=='location' && mod!=='dungeon')) { navigation(areaLink,'Abriendo '+area.name+' para la mazmorra elegida.'); return true; }
      if (mod!=='dungeon' || params.get('loc')!==dungeonLoc) { navigation(dungeonLink,'Abriendo '+chosen.name+' ('+(chosen.difficulty==='advanced'?'avanzada':'normal')+').'); return true; }
    }
    if (selected==='expedition') {
      const enemy=BUILD_CONFIG.expedition.enemy,position=enemy?.position,loc=params.get('loc');
      const button=Number.isInteger(position)&&position>=1&&position<=4 ? document.querySelectorAll('#expedition_list .expedition_button')[position-1] : null;
      const rival=Number.isInteger(position) ? document.querySelector('#expedition_info'+position+' .expedition_name')?.textContent.trim() : '';
      const onclick=button?.getAttribute('onclick') || '';
      const call=onclick.match(/^\s*attack\(null,\s*(['"])(\d+)\1,\s*(\d+),\s*0,\s*(['"])[^'"]*\4(?:,\s*(['"])[^'"]*\5)?\)\s*;?\s*$/);
      const safeCall=call?.[2]===loc && Number(call?.[3])===position;
      if (!enemy?.name || !safeCall || !visible(button) || button.disabled || /rub[ií]|diamant|premium/i.test(button.outerHTML)) {
        state.pveTarget=null; state.lastPveAt=Date.now(); state.message='No hay un ataque válido en la posición elegida; no atacaré.'; log(state.message,'warn'); save(); return true;
      }
      state.pendingPve={mode:selected,at:Date.now(),target:rival || enemy.name,area:area.name,spawn:[enemy.levelMin,enemy.levelMax],declaredPlayerLevel:BUILD_CONFIG.playerLevel};
      state.pveTarget=null; state.lastPveAt=Date.now(); state.lastPveMode=selected; state.lastAction='pve';
      state.message='Atacando posición '+position+' · '+(rival || enemy.name)+' · rango de catálogo '+enemy.levelMin+'–'+enemy.levelMax+'.'; log(state.message,'action'); save(); button.click(); return true;
    }
    const dungeon=BUILD_CONFIG.dungeon,difficulty=dungeon.difficulty==='advanced'?'advanced':'normal',inputName=difficulty==='advanced'?'dif2':'dif1',inputLabel=difficulty==='advanced'?'Avanzado':'Normal';
    const enter=document.querySelector('#content input[type="submit"][name="'+inputName+'"]');
    const reset=state.dungeonReset;
    if (reset) {
      if (reset.dungeonId!==dungeon.id) { stop('Reinicio pendiente de otra mazmorra; revisión necesaria.'); return true; }
      if (reset.phase==='submitted') {
        if (visible(enter) && !enter.disabled) { state.dungeonReset=null; state.dungeonLosses=null; state.pveEntryAt=0; state.message='Cancelación de mazmorra confirmada; esperando para crearla de nuevo.'; log(state.message,'success'); save(); if (!ready('dungeon')) {state.pveTarget=null; save(); return true;} }
        else { if (Date.now()-reset.at>30000) stop('Cancelación de mazmorra sin confirmar; revisión necesaria.'); return true; }
      } else if (reset.phase==='needed') {
        const cancel=[...document.querySelectorAll('#content input[type="submit"]')].find(x=>x.value==='Cancelar Mazmorra' && visible(x) && !x.disabled);
        const instanceTitle=document.querySelector('#content h3')?.textContent || '';
        const titleMatches=sameName(instanceTitle).startsWith(sameName(dungeon.name)+' ');
        const form=cancel?.form; let u; try { u=new URL(form?.getAttribute('action'),location.href); } catch {}
        const id=form?.querySelector('input[type="hidden"][name="dungeonId"]');
        const csrf=form?.querySelector('input[type="hidden"][name="csrf_token"]');
        if (!titleMatches || !cancel || !form || !u || u.origin!==location.origin || u.pathname!=='/game/index.php' || u.searchParams.get('mod')!=='dungeon' || u.searchParams.get('action')!=='cancelDungeon' || u.searchParams.get('loc')!==params.get('loc') || String(form.method).toLowerCase()!=='post' || !id?.value || !csrf?.value || /rub[ií]|diamant|premium|reducir tiempo/i.test(cancel.outerHTML)) { stop('No se puede verificar el control para cancelar la mazmorra; revisión necesaria.'); return true; }
        state.dungeonReset={dungeonId:dungeon.id,phase:'submitted',at:Date.now()}; state.message='Límite de derrotas confirmado: cancelando mazmorra.'; log(state.message,'warn'); save(); cancel.click(); return true;
      } else { stop('Estado de reinicio de mazmorra desconocido; revisión necesaria.'); return true; }
    }
    if (visible(enter) && !enter.disabled) {
      const form=enter.form; let u; try { u=new URL(form.getAttribute('action'),location.href); } catch { return stop('Entrada de mazmorra no reconocida.'); }
      if (u.origin!==location.origin || u.pathname!=='/game/index.php' || u.searchParams.get('mod')!=='dungeon' || u.searchParams.has('action') || u.searchParams.get('loc')!==params.get('loc') || String(form.method).toLowerCase()!=='post' || enter.value!==inputLabel || !inConfiguredArea || sameName(area.name)!==sameName(dungeon.area.name) || /rub[ií]|diamant|premium/i.test(enter.outerHTML)) return stop('Entrada de mazmorra no coincide con la zona y dificultad configuradas.');
      if (state.pveEntryAt) { if (Date.now()-state.pveEntryAt<30000) return true; state.pveEntryAt=0; state.pveTarget=null; state.lastPveAt=Date.now(); state.message='Entrada de mazmorra sin confirmar; esperaré antes de revisar.'; log(state.message,'warn'); save(); return true; }
      state.pveEntryAt=Date.now(); state.message='Iniciando '+dungeon.name+' ('+difficulty+') · enemigos nivel '+dungeon.levelMin+'–'+dungeon.levelMax+'.'; log(state.message,'action'); save(); enter.click(); return true;
    }
    state.pveEntryAt=0;
    const fight=[...document.querySelectorAll('#content img[onclick^="startFight"]')].find(x=>visible(x) && /^\s*startFight\(\s*(['"])\d+\1\s*,\s*(['"])\d+\2\s*\)\s*;\s*showWait\(\s*\)\s*;\s*return\s+false\s*;?\s*$/.test(x.getAttribute('onclick') || '') && !/rub[ií]|diamant|premium/i.test(x.outerHTML));
    if (!fight) { state.pveTarget=null; state.lastPveAt=Date.now(); state.message='Sin encuentro reconocible en '+dungeon.name+'; no atacaré.'; log(state.message,'warn'); save(); return true; }
    state.pendingPve={mode:selected,dungeonId:dungeon.id,at:Date.now(),target:dungeon.name,boss:dungeon.boss,area:area.name,spawn:[dungeon.levelMin,dungeon.levelMax],declaredPlayerLevel:BUILD_CONFIG.playerLevel};
    state.pveTarget=null; state.lastPveAt=Date.now(); state.lastPveMode=selected; state.lastAction='pve'; state.message='Iniciando encuentro de '+dungeon.name+' · jefe '+dungeon.boss+' · nivel '+dungeon.levelMin+'–'+dungeon.levelMax+'.'; log(state.message,'action'); save(); fight.click(); return true;
  }
