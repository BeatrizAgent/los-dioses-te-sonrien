  function liveRivals() {
    if (mod !== 'arena' || !(sub === 'grouparena' || (sub === 'serverArena' && ['2','3'].includes(params.get('aType'))))) return [];
    const mode = sub === 'grouparena' ? 'turma' : params.get('aType') === '2' ? 'arena-provinciarum' : 'turma-provinciarum';
    const level = Number((document.querySelector('#header_values_level')?.textContent || '').replace(/\D/g,''));
    const table = [...document.querySelectorAll('#content table')].find(t => /Nombre\s+Nivel/.test(t.innerText));
    if (!table) return [];
    return [...table.rows].slice(1).map(row => {const cells=[...row.cells]; return {name:cells[0]?.innerText.trim(), rivalLevel:Number(cells[1]?.innerText.trim()),server:mode==='turma'?host.split('.')[0]:cells[2]?.innerText.trim(),mode,level};}).filter(r=>r.name && Number.isInteger(r.rivalLevel) && r.server);
  }
  let capturedRivalsSignature = null;
  function captureRivals() {
    const items = liveRivals();
    if (items.length) {
      const signature = JSON.stringify(items);
      if (signature !== capturedRivalsSignature || !state.rivalSnapshot) {
        state.rivalSnapshot = {at:Date.now(), items};
        capturedRivalsSignature = signature;
        save();
      }
    }
    return items;
  }
  function rivals() { const current=liveRivals(); return current.length ? current : (state.rivalSnapshot?.items || []); }
  const panel = document.createElement('aside');
  panel.id = 'axel-evento-panel';
  const root = panel.attachShadow({mode:'open'});
  root.innerHTML = `<style>${PANEL_STYLE}</style><div class="shell"><header class="head"><div class="top"><div><div class="eyebrow">Los Dioses Te Sonríen · bot</div><div class="title">Los Dioses Te Sonríen</div><div class="subtitle"></div></div><button class="min" aria-label="Minimizar panel">−</button></div></header><main class="body"><div class="status"><div class="statusline"><span class="dot"></span><span class="status-title"></span></div><p class="message"></p></div><div class="actions"><button class="btn primary toggle"></button><button class="btn go">Ir al Panteón ↗</button></div><nav class="nav" aria-label="Panel"><button class="tab active" data-tab="overview">Resumen</button><button class="tab" data-tab="rivals">Rivales</button><button class="tab" data-tab="stats">Estadísticas</button><button class="tab" data-tab="log">Actividad</button></nav><div class="content"></div><div class="footer">Sin rubíes ni reducción de tiempo · La victoria no está garantizada</div></main></div>`;
  document.body.append(panel);
  // Algunos controles del juego cancelan el clic táctil antes de que llegue al panel.
  // Activamos un toque breve una sola vez y descartamos su clic de compatibilidad.
  let touchStart=null, lastTouchClick=null;
  root.addEventListener('pointerdown', event => {
    if (event.pointerType !== 'touch' || event.isPrimary === false) return;
    const button=event.target.closest('button');
    touchStart=button && !button.disabled ? {button,id:event.pointerId,x:event.clientX,y:event.clientY} : null;
  });
  root.addEventListener('pointercancel', () => { touchStart=null; });
  root.addEventListener('pointerup', event => {
    const start=touchStart; touchStart=null;
    if (!start || event.pointerType !== 'touch' || event.pointerId !== start.id || event.target.closest('button') !== start.button || Math.hypot(event.clientX-start.x,event.clientY-start.y)>12 || start.button.disabled) return;
    start.button.click(); lastTouchClick={button:start.button,at:Date.now()};
  });
  root.addEventListener('click', event => {
    if (event.isTrusted && lastTouchClick && Date.now()-lastTouchClick.at<800 && event.target.closest('button')===lastTouchClick.button) { lastTouchClick=null; event.preventDefault(); event.stopImmediatePropagation(); }
  }, true);
  // Evita que los manejadores táctiles del juego procesen gestos hechos en el panel.
  for (const type of ['touchstart','touchmove','touchend','pointerdown','pointermove','pointerup','mousedown','mouseup','click']) {
    root.addEventListener(type, event => event.stopPropagation());
  }
  const $ = selector => root.querySelector(selector);
  if (BUILD_CONFIG.tabernaSync === true) {
    const section = document.createElement('div');
    section.className = 'card';
    const explanation = document.createElement('p');
    explanation.className = 'small';
    explanation.textContent = 'Taberna: al pulsar se envían nombre, servidor y nivel del personaje a taberna.yampi.eu. La identidad no se verifica en el servidor.';
    const button = document.createElement('button'); button.className = 'btn'; button.textContent = 'Sincronizar con la taberna';
    const feedback = document.createElement('p'); feedback.className = 'small'; feedback.setAttribute('role','status');
    section.append(explanation,button,feedback); root.querySelector('.actions').after(section);
    button.onclick = async () => {
      if (!ownerActive || !verified() || captcha()) { feedback.textContent='Abre Visión general y verifica el personaje antes de sincronizar.'; return; }
      const rawLevel = (document.querySelector('#header_values_level')?.textContent || '').trim();
      const level = /^\d{1,3}$/.test(rawLevel) ? Number(rawLevel) : 0;
      if (!level || level > 999) { feedback.textContent='No se puede leer el nivel actual. Abre Visión general.'; return; }
      const key='gladibot.taberna.v1.'+host+'.'+encodeURIComponent(accountName.normalize('NFKC').trim().toLowerCase());
      let token;
      try {
        token=localStorage.getItem(key);
        if (!/^[a-f0-9]{64}$/.test(token || '')) { const bytes=new Uint8Array(32); crypto.getRandomValues(bytes); token=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join(''); localStorage.setItem(key,token); }
      } catch { feedback.textContent='No se pudo guardar la clave local de sincronización.'; return; }
      button.disabled=true; feedback.textContent='Sincronizando…';
      try {
        const response=await fetch('https://taberna.yampi.eu/api/sync',{method:'POST',mode:'cors',credentials:'omit',referrerPolicy:'no-referrer',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:accountName,server:host.split('.')[0],level,token}),signal:AbortSignal.timeout(15000)});
        const data=await response.json();
        feedback.textContent=response.ok && data.ok === true ? 'Perfil enviado a la taberna.' : 'No se pudo sincronizar (HTTP '+response.status+').';
      } catch { feedback.textContent='No se pudo conectar. Comprueba el navegador y vuelve a intentarlo.'; }
      finally { button.disabled=false; }
    };
  }
  $('.subtitle').textContent = accountName + ' · ' + host.split('.')[0] + ' · ' + Object.entries(BUILD_CONFIG.modules).filter(([,enabled])=>enabled).map(([name])=>name).join(', ');
  const uiState = loadUI();
  let tabName = uiState.tab;
  let contentKey = '';
  let resetConfirmation = false;
  $('.shell').classList.toggle('minimized', uiState.minimized);
  $('.min').textContent = uiState.minimized ? '+' : '−';
  $('.min').setAttribute('aria-label',uiState.minimized?'Abrir panel':'Minimizar panel');
  root.querySelectorAll('.tab').forEach(x=>x.classList.toggle('active', x.dataset.tab === tabName));
  const observer = new MutationObserver(() => { if (ownerActive && !panel.isConnected && document.body) document.body.append(panel); });
  observer.observe(document.body, {childList:true});
  observer.observe(document.documentElement, {childList:true});
  function renderStatus() {
    $('.dot').classList.toggle('on', ownerActive && !!state.running && verified());
    const setText = (selector, value) => { const node=$(selector); if (node.textContent !== value) node.textContent=value; };
    setText('.status-title', !ownerActive ? 'En pausa: beta controla la cuenta' : !state.running ? 'Misiones detenidas' : !verified() ? 'Identidad pendiente' : 'Misiones y combate activos');
    setText('.message', !ownerActive ? 'El bot principal retomará el control al detener la beta.' : !verified() ? 'Visita Visión general para verificar el personaje.' : state.message || (state.running ? 'Revisando misiones disponibles.' : 'Activa la revisión cuando quieras comenzar.'));
    setText('.toggle', state.running ? 'Detener bot' : 'Activar bot');
    $('.go').classList.toggle('hidden', mod === 'quests');
    if (!uiState.minimized) renderContent();
  }
  $('.toggle').onclick = () => {
    if (!ownerActive) return;
    if (state.running) return stop('Misiones detenidas por el jugador.');
    if (!verified() || captcha()) return stop('Abre Visión general para verificar identidad; comprueba que no haya CAPTCHA.');
  state.running = true; state.lastNavigationAt = 0; state.pveWatch={}; state.message = 'Misiones y combate activados.'; log('Bot activado.'); save(); renderStatus();
    setTimeout(combatTick, 300);
  };
  $('.go').onclick = () => { const link = document.querySelector('#mainmenu a[href*="mod=quests"]'); if (link && visible(link) && !captcha() && verified()) link.click(); else stop('No se pudo abrir el Panteón. Verifica la cuenta.'); };
  $('.min').onclick = () => { const small = $('.shell').classList.toggle('minimized'); uiState.minimized=small; saveUI(uiState); $('.min').textContent = small ? '+' : '−'; $('.min').setAttribute('aria-label',small?'Abrir panel':'Minimizar panel'); if (!small) renderContent(); };
  root.querySelectorAll('.tab').forEach(button => button.onclick = () => { resetConfirmation=false; tabName = button.dataset.tab; uiState.tab=tabName; saveUI(uiState); contentKey=''; root.querySelectorAll('.tab').forEach(x=>x.classList.toggle('active',x===button)); renderContent(); });
  function textElement(tag, cls, text) { const node=document.createElement(tag); node.className=cls; node.textContent=text; return node; }
  function exportRivalHistory(records) {
    const fields=['name','server','mode','level','rivalLevel','result','gold','damageEstimate','experience','source','at'];
    const entries=records.map(record=>Object.fromEntries(fields.filter(key=>Object.hasOwn(record,key)).map(key=>[key,record[key]])));
    const url=URL.createObjectURL(new Blob([JSON.stringify({version:1,records:entries},null,2)],{type:'application/json'}));
    const link=document.createElement('a'); link.href=url; link.download='historial-rivales.json'; link.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function renderContent() {
    // Records and stats events are append-only until total reset, which clears contentKey.
    const data = tabName === 'overview' ? [state.records.length,state.goldEnabled,state.goldTx,state.goldPreviousReview,state.foodBuyTx,state.smeltTx,state.dungeonCombatUnknown,state.turmaParticipation,state.turmaCheckRequested,mod,document.querySelector('#cooldown_bar_ct')?.textContent,document.querySelector('#cooldown_bar_expedition')?.textContent,document.querySelector('#cooldown_bar_dungeon')?.textContent,document.querySelector('#quest_header_cooldown')?.textContent,(mod==='quests' ? document.querySelector('#content')?.textContent : '')?.match(/Misiones aceptadas:\s*\d+\s*\/\s*\d+/i)?.[0],document.querySelector('#mainmenu a[href*="mod=quests"]')?.textContent] : tabName === 'stats' ? [state.records.length,state.statsEvents.length,state.statsStartedAt] : tabName === 'log' ? state.logs : [state.records.length,state.rivalSnapshot,mod];
    const signature = JSON.stringify([tabName,data]);
    if (signature === contentKey || (root.activeElement && $('.content').contains(root.activeElement))) return;
    contentKey=signature;
    const content=$('.content'); content.replaceChildren();
    if (tabName === 'overview') {
      const current = mod === 'quests' ? (document.querySelector('#content')?.textContent.match(/Misiones aceptadas:\s*\d+\s*\/\s*\d+/i)?.[0] || 'Panteón abierto') : 'Abre el Panteón para gestionar misiones';
      const ct=document.querySelector('#cooldown_bar_ct')?.textContent.trim() || 'No disponible';
      const questLink=document.querySelector('#mainmenu a[href*="mod=quests"]');
      const questState=questLink?.textContent.trim() || 'Estado no visible';
      const expedition=document.querySelector('#cooldown_bar_expedition')?.textContent.trim() || 'No disponible';
      const dungeon=document.querySelector('#cooldown_bar_dungeon')?.textContent.trim() || 'No disponible';
      content.append(textElement('div','sectionlabel','Cola de tareas'),textElement('div','card name','Arena: '+(BUILD_CONFIG.modules.arenaCircus && BUILD_CONFIG.pvp?.arena!==false ? 'Activada' : 'Desactivada')),textElement('div','card name','Circo: '+(BUILD_CONFIG.modules.arenaCircus && BUILD_CONFIG.pvp?.turma!==false ? ct : 'Desactivado')),textElement('div','card name','Misiones: '+questState),textElement('div','card name','Expedición: '+expedition),textElement('div','card name','Mazmorra: '+dungeon),textElement('p','small','Alterna los encuentros disponibles y revisa misiones durante las esperas.'));
      if (BUILD_CONFIG.modules.arenaCircus && BUILD_CONFIG.pvp?.turma!==false) {
        const participation=state.turmaParticipation;
        content.append(textElement('p','small',participation ? 'Turma: '+participation.status+' · comprobado '+new Date(participation.checkedAt).toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'})+(participation.status==='pasivo' ? ' · Turma aplazado hasta nueva comprobación.' : '.') : 'Estado de Turma aún no comprobado.'));
        const recheck=textElement('button','btn','Comprobar estado de Turma');
        recheck.onclick=()=>{if(!ownerActive || !verified() || captcha())return;state.turmaCheckRequested=true;state.turmaCheckRetryAt=0;state.message='Comprobación de Turma solicitada.';save();contentKey='';recheck.blur();renderContent();if(state.running)setTimeout(combatTick,300);};
        content.append(recheck);
      }
      content.append(textElement('div','sectionlabel','Ubicación'),textElement('div','card name',current));
      if (state.dungeonCombatUnknown) content.append(textElement('p','small','Resultado de mazmorra desconocido; se reanudará automáticamente.'));
      content.append(textElement('div','sectionlabel','Paquetes de oro'),textElement('p','small',state.goldTx?.manualReview ? 'Operación sin confirmar; continuará automáticamente.' : state.goldTx?.blocked ? 'Operación pendiente: volveré a comprobarla automáticamente.' : state.goldTx ? 'Operación en curso: '+state.goldTx.stage : BUILD_CONFIG.modules.guildGold ? 'Objetos de nivel 1 por más de 100.000; sin utilizables ni bienes de forja. Reserva 100.000 más tarifa; anuncios a 24 horas.' : 'Módulo no seleccionado en esta configuración.'));
      content.append(textElement('div','sectionlabel','Vendedores excluidos'),textElement('p','small','No comprar oro ni alimento a estos jugadores. Un nombre exacto por línea; se ignoran mayúsculas. Solo para este personaje y navegador.'));
      if (BUILD_CONFIG.marketProfile==='huggin') content.append(textElement('p','small','Perfil huggin activo: '+BUILD_CONFIG.blockedMarketSellers.join(', ')+'. Estas exclusiones se mantienen mientras uses este perfil.'));
      const sellerList=document.createElement('textarea');
      sellerList.setAttribute('aria-label','Jugadores excluidos de compras'); sellerList.rows=3;
      sellerList.style.cssText='width:100%;max-width:100%;padding:8px;color:#ece6d9;background:#151b23;border:1px solid #806c4d;border-radius:6px;font:inherit';
      sellerList.value=Array.isArray(state.blockedMarketSellers) ? state.blockedMarketSellers.join('\n') : '';
      const saveSellers=textElement('button','btn','Guardar exclusiones');
      saveSellers.onclick=()=>{if(!ownerActive)return;state.blockedMarketSellers=[...new Set(sellerList.value.split(/\r?\n/).map(x=>x.trim()).filter(Boolean))];save();state.message='Exclusiones de vendedores guardadas.';contentKey='';saveSellers.blur();renderStatus();};
      content.append(sellerList,saveSellers);
      if (state.foodBuyTx?.stage==='buy') content.append(textElement('p','small','Compra de alimento pendiente: continuará automáticamente si no se confirma.'));
      if (['buy','verifyBuy'].includes(state.goldTx?.stage)) content.append(textElement('p','small','Compra pendiente: comprobaré automáticamente mercado y paquetes sin repetirla.'));
      if (BUILD_CONFIG.modules.smelting || state.smeltTx) content.append(textElement('div','sectionlabel','Fundición'),textElement('p','small',state.smeltTx?.blocked ? 'Bloqueada: '+state.smeltTx.problem : state.smeltTx ? 'Etapa: '+state.smeltTx.stage : 'Activa: '+(BUILD_CONFIG.smeltingPriority==='crystal'?'prioridad cristal':BUILD_CONFIG.smeltingPriority==='stamina'?'prioridad tintura':'equipo verde o azul')+'.'));
      if (BUILD_CONFIG.modules.repair || state.repairTx) content.append(textElement('div','sectionlabel','Reparación'),textElement('p','small',state.repairTx?.blocked ? 'Pendiente de comprobar automáticamente: '+state.repairTx.problem : state.repairTx ? 'Pieza pendiente: '+state.repairTx.item.name+' · '+state.repairTx.stage : 'Vigila refinamiento del personaje y usa baúl III.'));
      if (Array.isArray(state.goldUnresolved) && state.goldUnresolved.length) content.append(textElement('p','small',state.goldUnresolved.length+' operación(es) antiguas sin confirmar; se excluyen objetos iguales.'));
      const timer = document.querySelector('#quest_header_cooldown')?.textContent.trim();
      if (timer) content.append(textElement('p','small',timer));
      content.append(textElement('div','sectionlabel','Qué hace'),textElement('p','small','Combate en Arena, Circo, expediciones y mazmorras; revisa misiones e intenta curarse al 40 %.'));
      content.append(textElement('div','sectionlabel','Registro de combate'),textElement('p','small',`${state.records.length} resultados guardados · Consulta la pestaña Rivales en Circo Turma.`));
      content.append(textElement('div','sectionlabel','Reinicio total'));
      if (resetConfirmation) {
        content.append(textElement('p','small','Se detendrá el bot y se borrarán los ciclos pendientes, historial y estadísticas; se conservan los vendedores excluidos de este personaje en este navegador. Revisa primero compras y anuncios: el juego no se reinicia y podrían repetirse operaciones al reactivar.'));
        const confirmReset=textElement('button','btn','Confirmar reinicio total');
        confirmReset.onclick=()=>{
          if (!ownerActive) return;
          state={blockedMarketSellers:state.blockedMarketSellers,running:false,goldEnabled:false,goldAutoDefaultV1:true,records:[],logs:[],statsEvents:[],statsStartedAt:Date.now(),message:'Reinicio total completado. Revisa el juego antes de activar el bot.'};
          log('Reinicio total solicitado por el jugador.','warn'); save(); resetConfirmation=false; contentKey=''; confirmReset.blur(); renderStatus();
        };
        const cancelReset=textElement('button','btn','Cancelar reinicio');
        cancelReset.onclick=()=>{resetConfirmation=false;contentKey='';cancelReset.blur();renderContent();};
        content.append(confirmReset,cancelReset);
      } else {
        const resetAll=textElement('button','btn','Reinicio total');
        resetAll.onclick=()=>{resetConfirmation=true;contentKey='';resetAll.blur();renderContent();};content.append(resetAll);
      }
    } else if (tabName === 'stats') {
      const stats=sessionStats(), total=stats.combatGold+stats.missionGold;
      content.append(textElement('div','sectionlabel','Sesión actual'),textElement('div','card name',`${total.toLocaleString('es-ES')} oro confirmado`),textElement('p','small',`Combates: ${stats.combatGold.toLocaleString('es-ES')} · Misiones no verificadas · ${stats.unknown} recompensas desconocidas`),textElement('p','small',`${stats.wins} victorias · ${stats.losses} derrotas · Desde ${new Date(state.statsStartedAt).toLocaleString('es-ES')}`));
      const reset=textElement('button','btn','Iniciar nueva sesión');reset.onclick=()=>{state.statsStartedAt=Date.now();log('Nueva sesión de estadísticas.');save();contentKey='';reset.blur();renderContent();};content.append(reset);
      content.append(textElement('p','small','Oro de combate leído del informe. Misiones sin confirmación positiva cuentan como desconocidas. Los registros anteriores no contienen importes históricos.'));
    } else if (tabName === 'log') {
      if (!state.logs.length) content.append(textElement('div','empty','Todavía no hay actividad registrada. Activa misiones para empezar.'));
      for (const item of state.logs) {const row=textElement('div','log','');row.append(textElement('span','time',new Date(item.at).toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'})),textElement('span','logtext',item.message));content.append(row);}
    } else {
      const items=rivals();
      const exportButton=textElement('button','btn','Exportar historial');
      exportButton.disabled=!state.records.length;
      exportButton.onclick=()=>exportRivalHistory(state.records);
      content.append(exportButton,textElement('p','small','La exportación contiene nombres de rivales y resultados; guárdala en un lugar privado.'));
      if (!items.length) { content.append(textElement('div','empty','Abre Circo Turma o Circo Provinciarum para ver los rivales de la lista actual.')); return; }
      const isLive=liveRivals().length > 0;
      content.append(textElement('p','small',isLive ? 'Lista actual. Resultados confirmados y anotaciones manuales; no garantizan victorias.' : `Última lista observada ${state.rivalSnapshot?.at ? new Date(state.rivalSnapshot.at).toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'}) : ''}. La disponibilidad puede haber cambiado.`));
      rivalIndex.sync(state.records);
      for (const r of items) {
        const {wins,losses,total}=rivalIndex.get(r);
        const card=textElement('div','card',''), row=textElement('div','row',''), info=textElement('div','','');
        info.append(textElement('div','name',r.name),textElement('div','meta',`Nivel ${r.rivalLevel} · Provincia ${r.server}`)); row.append(info,textElement('span','tag',total?`${wins}V · ${losses}D · ${total} muestra${total===1?'':'s'}`:'Sin datos')); card.append(row);
        const actions=textElement('div','record','');
        for(const [label,result] of [['+ Victoria','win'],['+ Derrota','loss']]) {const b=textElement('button','',label);b.onclick=()=>{if(!verified()||captcha())return stop('Identidad no verificada o CAPTCHA.');state.records.push({...r,result,source:'manual',at:new Date().toISOString()});log(`${label.slice(2)} registrada: ${r.name}.`);save();contentKey='';b.blur();renderContent();};actions.append(b);}
        card.append(actions);content.append(card);
      }
    }
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && ownerActive) { combatTick(); renderStatus(); }
  });
  let panelTick=0;
  captureRivals(); renderStatus(); setTimeout(combatTick, 1000); setInterval(() => {
    let failed=false;
    try {combatTick();} catch (error) {
      failed=true;
      if (ownerActive && state.running && Date.now()-(state.lastRuntimeErrorLogAt||0)>=60000) {
        state.lastRuntimeErrorLogAt=Date.now();const kind=/^[A-Za-z]+Error$/.test(error?.name || '') ? error.name : 'Error';
        state.message='Error interno ('+kind+'); comprobando recuperación.';log(state.message,'warn');try {save();} catch {}
      }
    }
    stallRecoveryTick(failed);
    if (++panelTick%3===0 && document.visibilityState !== 'hidden') renderStatus();
  }, 1500);
  }
})();
