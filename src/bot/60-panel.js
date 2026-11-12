  function liveRivals() {
    if (mod !== 'arena' || !(sub === 'grouparena' || (sub === 'serverArena' && ['2','3'].includes(params.get('aType'))))) return [];
    const mode = sub === 'grouparena' ? 'turma' : params.get('aType') === '2' ? 'arena-provinciarum' : 'turma-provinciarum';
    const level = Number((document.querySelector('#header_values_level')?.textContent || '').replace(/\D/g,''));
    const table = [...document.querySelectorAll('#content table')].find(t => /Nombre\s+Nivel/.test(t.innerText));
    if (!table) return [];
    return [...table.rows].slice(1).map(row => {const cells=[...row.cells]; return {name:cells[0]?.innerText.trim(), rivalLevel:Number(cells[1]?.innerText.trim()),server:mode==='turma'?host.split('.')[0]:cells[2]?.innerText.trim(),mode,level};}).filter(r=>r.name && Number.isInteger(r.rivalLevel) && r.server);
  }
  function captureRivals() { const items = liveRivals(); if (items.length) { state.rivalSnapshot = {at:Date.now(), items}; save(); } return items; }
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
    $('.dot').classList.toggle('on', !!state.running && verified());
    const setText = (selector, value) => { const node=$(selector); if (node.textContent !== value) node.textContent=value; };
    setText('.status-title', !state.running ? 'Misiones detenidas' : !verified() ? 'Identidad pendiente' : 'Misiones y combate activos');
    setText('.message', !verified() ? 'Visita Visión general para verificar el personaje.' : state.message || (state.running ? 'Revisando misiones disponibles.' : 'Activa la revisión cuando quieras comenzar.'));
    setText('.toggle', state.running ? 'Detener bot' : 'Activar bot');
    $('.go').classList.toggle('hidden', mod === 'quests');
    renderContent();
  }
  $('.toggle').onclick = () => {
    if (!ownerActive) return;
    if (state.running) return stop('Misiones detenidas por el jugador.');
    if (!verified() || captcha()) return stop('Abre Visión general para verificar identidad; comprueba que no haya CAPTCHA.');
  state.running = true; state.lastNavigationAt = 0; state.message = 'Misiones y combate activados.'; log('Bot activado.'); save(); renderStatus();
    setTimeout(combatTick, 300);
  };
  $('.go').onclick = () => { const link = document.querySelector('#mainmenu a[href*="mod=quests"]'); if (link && visible(link) && !captcha() && verified()) link.click(); else stop('No se pudo abrir el Panteón. Verifica la cuenta.'); };
  $('.min').onclick = () => { const small = $('.shell').classList.toggle('minimized'); uiState.minimized=small; saveUI(uiState); $('.min').textContent = small ? '+' : '−'; $('.min').setAttribute('aria-label',small?'Abrir panel':'Minimizar panel'); };
  root.querySelectorAll('.tab').forEach(button => button.onclick = () => { resetConfirmation=false; tabName = button.dataset.tab; uiState.tab=tabName; saveUI(uiState); contentKey=''; root.querySelectorAll('.tab').forEach(x=>x.classList.toggle('active',x===button)); renderContent(); });
  function textElement(tag, cls, text) { const node=document.createElement(tag); node.className=cls; node.textContent=text; return node; }
  function renderContent() {
    const data = tabName === 'overview' ? [state.records.length,state.goldEnabled,state.goldTx,state.goldPreviousReview,state.smeltTx,mod,document.querySelector('#cooldown_bar_ct')?.textContent,document.querySelector('#cooldown_bar_expedition')?.textContent,document.querySelector('#cooldown_bar_dungeon')?.textContent,document.querySelector('#quest_header_cooldown')?.textContent,document.querySelector('#content')?.textContent.match(/Misiones aceptadas:\s*\d+\s*\/\s*\d+/i)?.[0],document.querySelector('#mainmenu a[href*="mod=quests"]')?.textContent] : tabName === 'stats' ? [state.statsEvents,state.statsStartedAt] : tabName === 'log' ? state.logs : [state.records,state.rivalSnapshot,mod];
    const signature = JSON.stringify([tabName,data]);
    if (signature === contentKey || (root.activeElement && $('.content').contains(root.activeElement))) return;
    contentKey=signature;
    const content=$('.content'); content.replaceChildren();
    if (tabName === 'overview') {
      const current = mod === 'quests' ? (document.querySelector('#content')?.textContent.match(/Misiones aceptadas:\s*\d+\s*\/\s*\d+/i)?.[0] || 'Panteón abierto') : 'Abre el Panteón para gestionar misiones';
      const ct=document.querySelector('#cooldown_bar_ct')?.textContent.trim() || 'No disponible';
      const questLink=[...document.querySelectorAll('#mainmenu a[href*="mod=quests"]')][0];
      const questState=questLink?.textContent.trim() || 'Estado no visible';
      const expedition=document.querySelector('#cooldown_bar_expedition')?.textContent.trim() || 'No disponible';
      const dungeon=document.querySelector('#cooldown_bar_dungeon')?.textContent.trim() || 'No disponible';
      content.append(textElement('div','sectionlabel','Cola de tareas'),textElement('div','card name','Circo: '+ct),textElement('div','card name','Misiones: '+questState),textElement('div','card name','Expedición: '+expedition),textElement('div','card name','Mazmorra: '+dungeon),textElement('p','small','Alterna los encuentros disponibles y revisa misiones durante las esperas.'));
      content.append(textElement('div','sectionlabel','Ubicación'),textElement('div','card name',current));
      content.append(textElement('div','sectionlabel','Paquetes de oro'),textElement('p','small',state.goldPreviousReview ? 'Hay una revisión anterior pendiente.' : state.goldTx?.manualReview ? 'Revisa y resuelve la operación de oro manualmente: '+(state.goldTx.problem||'resultado desconocido') : state.goldTx?.blocked ? 'Operación pendiente: volveré a comprobarla automáticamente.' : state.goldTx ? 'Operación en curso: '+state.goldTx.stage : 'Ofertas de 100.000 a 1.000.000; reserva 100.000 más tarifa. Anuncios a 24 horas.'));
      if (state.goldTx?.manualReview) { const resolved=textElement('button','btn','Ya resolví la operación de oro'); resolved.onclick=()=>{if (!verified()||captcha()||!state.goldTx?.manualReview) return;state.goldTx=null;state.goldEnabled=false;state.goldCheckAt=Date.now()+60000;log('El jugador confirmó la resolución manual de la operación de oro.');save();contentKey='';resolved.blur();renderContent();};content.append(resolved); }
      if (BUILD_CONFIG.modules.smelting || state.smeltTx) content.append(textElement('div','sectionlabel','Fundición'),textElement('p','small',state.smeltTx?.blocked ? 'Bloqueada: '+state.smeltTx.problem : state.smeltTx ? 'Etapa: '+state.smeltTx.stage : 'Activa: '+(BUILD_CONFIG.smeltingPriority==='crystal'?'prioridad cristal':BUILD_CONFIG.smeltingPriority==='stamina'?'prioridad tintura':'equipo verde o azul')+'.'));
      if (BUILD_CONFIG.modules.repair || state.repairTx) content.append(textElement('div','sectionlabel','Reparación'),textElement('p','small',state.repairTx?.blocked ? 'Revisión necesaria: '+state.repairTx.problem : state.repairTx ? 'Pieza pendiente: '+state.repairTx.item.name+' · '+state.repairTx.stage : 'Vigila refinamiento del personaje y usa baúl III.'));
      if (state.repairTx?.blocked) { const resolved=textElement('button','btn','Comprobar pieza reequipada'); resolved.onclick=()=>{if(!verified()||captcha())return; if(!repairAcknowledge()){state.message='No se pudo verificar la pieza en su ranura. Abre Visión general y revisa el equipo.';log(state.message,'warn');save();}contentKey='';resolved.blur();renderStatus();};content.append(resolved); }
      if (Array.isArray(state.goldUnresolved) && state.goldUnresolved.length) content.append(textElement('p','small',state.goldUnresolved.length+' operación(es) antiguas sin confirmar; se excluyen objetos iguales.'));
      const goldButton=textElement('button','btn',state.goldTx ? 'Operación de oro en seguimiento' : state.goldEnabled ? 'Desactivar paquetes de oro' : 'Activar paquetes de oro');
      goldButton.disabled=!!state.goldTx || state.goldPreviousReview===true; goldButton.onclick=()=>{if (!verified()||captcha()||state.goldTx||state.goldPreviousReview) return;state.goldEnabled=!state.goldEnabled;state.goldCheckAt=0;log(state.goldEnabled?'Paquetes de oro activados.':'Paquetes de oro desactivados.');save();contentKey='';goldButton.blur();renderContent();};content.append(goldButton);
      if (state.goldPreviousReview) { const checked=textElement('button','btn','Ya he comprobado la compra anterior'); checked.onclick=()=>{state.goldPreviousReview=false;state.goldEnabled=false;log('El jugador confirmó la revisión de la compra anterior.');save();contentKey='';checked.blur();renderContent();};content.append(checked); }
      const timer = document.querySelector('#quest_header_cooldown')?.textContent.trim();
      if (timer) content.append(textElement('p','small',timer));
      content.append(textElement('div','sectionlabel','Qué hace'),textElement('p','small','Combate en Arena, Circo, expediciones y mazmorras; revisa misiones e intenta curarse al 40 %.'));
      content.append(textElement('div','sectionlabel','Registro de combate'),textElement('p','small',`${state.records.length} resultados guardados · Consulta la pestaña Rivales en Circo Turma.`));
      content.append(textElement('div','sectionlabel','Reinicio total'));
      if (resetConfirmation) {
        content.append(textElement('p','small','Se detendrá el bot y se borrarán los ciclos pendientes, exclusiones, historial y estadísticas de este personaje en este navegador. Revisa primero compras y anuncios: el juego no se reinicia y podrían repetirse operaciones al reactivar.'));
        const confirmReset=textElement('button','btn','Confirmar reinicio total');
        confirmReset.onclick=()=>{
          if (!ownerActive) return;
          state={running:false,goldEnabled:false,goldAutoDefaultV1:true,records:[],logs:[],statsEvents:[],statsStartedAt:Date.now(),message:'Reinicio total completado. Revisa el juego antes de activar el bot.'};
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
      if (!items.length) { content.append(textElement('div','empty','Abre Circo Turma o Circo Provinciarum para ver los rivales de la lista actual.')); return; }
      const isLive=liveRivals().length > 0;
      content.append(textElement('p','small',isLive ? 'Lista actual. Resultados confirmados y anotaciones manuales; no garantizan victorias.' : `Última lista observada ${state.rivalSnapshot?.at ? new Date(state.rivalSnapshot.at).toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'}) : ''}. La disponibilidad puede haber cambiado.`));
      for (const r of items) {
        const records=state.records.filter(x=>x.name===r.name && x.server===r.server && x.mode===r.mode && x.level===r.level);
        const wins=records.filter(x=>x.result==='win').length, losses=records.filter(x=>x.result==='loss').length;
        const card=textElement('div','card',''), row=textElement('div','row',''), info=textElement('div','','');
        info.append(textElement('div','name',r.name),textElement('div','meta',`Nivel ${r.rivalLevel} · Provincia ${r.server}`)); row.append(info,textElement('span','tag',records.length?`${wins}V · ${losses}D · ${records.length} muestra${records.length===1?'':'s'}`:'Sin datos')); card.append(row);
        const actions=textElement('div','record','');
        for(const [label,result] of [['+ Victoria','win'],['+ Derrota','loss']]) {const b=textElement('button','',label);b.onclick=()=>{if(!verified()||captcha())return stop('Identidad no verificada o CAPTCHA.');state.records.push({...r,result,source:'manual',at:new Date().toISOString()});log(`${label.slice(2)} registrada: ${r.name}.`);save();contentKey='';b.blur();renderContent();};actions.append(b);}
        card.append(actions);content.append(card);
      }
    }
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && ownerActive) { combatTick(); renderStatus(); }
  });
  captureRivals(); renderStatus(); setTimeout(combatTick, 2500); setInterval(() => { combatTick(); renderStatus(); }, 5000);
  }
})();
