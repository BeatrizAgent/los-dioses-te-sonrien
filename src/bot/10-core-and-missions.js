
  const host = new URL(location.href).hostname.toLowerCase();
  const realm = host.match(/^s\d+-(es)\.gladiatus\.gameforge\.com$/)?.[1] || '';
  const KEY = host === 's64-es.gladiatus.gameforge.com' && accountName.toLocaleLowerCase() === 'cassiusferox' ? 'axelbot.evento.cassius.s64.v1' : 'axelbot.evento.account.v1.' + encodeURIComponent(accountName.normalize('NFKC').toLocaleLowerCase());
  const ID = 'axelbot.evento.identity';
  const UI_KEY = 'axelbot.evento.ui.v1';
  function loadUI() { try { const u=JSON.parse(localStorage.getItem(UI_KEY)); return {tab:['overview','rivals','stats','log'].includes(u?.tab) ? u.tab : 'overview', minimized:u?.minimized === true}; } catch { return {tab:'overview',minimized:false}; } }
  function saveUI(ui) { localStorage.setItem(UI_KEY, JSON.stringify({tab:ui.tab,minimized:ui.minimized})); }
  const params = new URLSearchParams(location.search);
  const mod = params.get('mod');
  const sub = params.get('submod');
  let state;
  try { state = JSON.parse(localStorage.getItem(KEY)) || {}; } catch { state = {}; }
  state.records = Array.isArray(state.records) ? state.records : [];
  state.logs = Array.isArray(state.logs) ? state.logs : [];
  state.statsEvents = Array.isArray(state.statsEvents) ? state.statsEvents : [];
  const needsStatsStart = !Number.isFinite(state.statsStartedAt);
  if (needsStatsStart) state.statsStartedAt = Date.now();
  function log(message, type = 'info') { state.logs.unshift({at: Date.now(), message, type}); state.logs = state.logs.slice(0, 40); }
  const save = () => { if (ownerActive) localStorage.setItem(KEY, JSON.stringify(state)); };
  if (needsStatsStart) save();
  if (state.running===false && state.message==='Identificador de alimento no verificable.') {
    state.running=true; state.message='Reanudando tras corregir el identificador de alimento.'; log(state.message); save();
  }
  // Migración única: activar oro por defecto sin borrar estados que requieren revisión.
  if (state.goldAutoDefaultV1 !== true) {
    state.goldAutoDefaultV1=true;
    if (!state.goldTx?.blocked && !state.goldPreviousReview) state.goldEnabled=true;
    save();
  }
  // La antigua compra manual de CassiusFerox ya se comprobó en el mercado.
  if (host==='s64-es.gladiatus.gameforge.com' && accountName.normalize('NFKC').toLocaleLowerCase()==='cassiusferox' && state.goldPreviousReview===true) {
    state.goldPreviousReview=false;
    if (!state.goldTx) state.goldEnabled=true;
    save();
  }
  const visible = el => !!el && !el.hidden && getComputedStyle(el).display !== 'none' && getComputedStyle(el).visibility !== 'hidden' && el.getClientRects().length > 0;
  function verified() {
    try { const x = JSON.parse(sessionStorage.getItem(ID)); return x.name.normalize('NFKC').toLocaleLowerCase() === accountName.normalize('NFKC').toLocaleLowerCase() && Date.now() - x.at >= 0 && Date.now() - x.at < 15 * 60 * 1000; } catch { return false; }
  }
  function captcha() { return [...document.querySelectorAll('iframe[src*="captcha" i], iframe[src*="turnstile" i], .g-recaptcha, .h-captcha, .cf-turnstile, #recaptcha, input[name*="captcha" i], [data-sitekey]')].some(visible); }
  function stop(message) { state.running = false; state.message = message; log(message, 'warn'); save(); renderStatus(); }
  function safeLink(el, action) {
    if (!visible(el) || el.tagName !== 'A') return false;
    try { const u = new URL(el.getAttribute('href'), location.href); return u.origin === location.origin && u.pathname === '/game/index.php' && u.searchParams.get('mod') === 'quests' && u.searchParams.get('submod') === action && /^\d+$/.test(u.searchParams.get('questPos') || '') && !/(rub[ií]|diamant|premium|reducir)/i.test(el.outerHTML); } catch { return false; }
  }
  function category(slot) { return slot.parentElement?.id || ''; }
  function relevant(slot) {
    const title = slot.querySelector('.quest_slot_title')?.textContent.trim() || '';
    return (category(slot) === 'qcategory_arena' && /^arena:.*\bo lucha en la arena provinciarum$/i.test(title)) ||
      (category(slot) === 'qcategory_grouparena' && /^circo turma:/i.test(title)) ||
      (category(slot) === 'qcategory_combat' && /^vence a \d+ enemigos en expediciones, en mazmorras o en las arenas$/i.test(title));
  }
  function parseGold(text) {
    const value=String(text || '').trim();
    if (!/^(?:\d+|\d{1,3}(?:[.\s]\d{3})+)$/.test(value)) return null;
    const number=Number(value.replace(/[.\s]/g,''));
    return Number.isSafeInteger(number) && number >= 0 ? number : null;
  }
  function reportGold(text) {
    const escaped=accountName.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    const m=String(text || '').match(new RegExp(escaped+'\\s+ha conseguido:\\s*([\\d.]+)(?=\\s|$)','i'));
    return m ? parseGold(m[1]) : null;
  }
  function xpReading() {
    const text = document.querySelector('#header_values_xp_points')?.textContent || '';
    const match = text.match(/^\s*([\d.\s]+)\s*\/\s*([\d.\s]+)\s*$/);
    if (!match) return null;
    const current=parseGold(match[1]), maximum=parseGold(match[2]);
    return Number.isSafeInteger(current) && Number.isSafeInteger(maximum) && maximum > 0 && current <= maximum ? {current,maximum} : null;
  }
  function sessionStats() {
    const rows=state.records.filter(r=>r.source==='informe' && Date.parse(r.at)>=state.statsStartedAt);
    const claims=state.statsEvents.filter(e=>e.kind==='claim' && e.at>=state.statsStartedAt);
    const pve=state.statsEvents.filter(e=>e.kind==='pve' && e.at>=state.statsStartedAt);
    const known=rows.filter(r=>Number.isSafeInteger(r.gold)&&r.gold>=0), knownClaims=claims.filter(e=>e.confirmed===true && Number.isSafeInteger(e.gold)&&e.gold>=0);
    const knownPve=pve.filter(e=>e.confirmed===true && Number.isSafeInteger(e.gold) && e.gold>=0);
    return {wins:rows.filter(r=>r.result==='win').length+pve.filter(e=>e.confirmed && e.result==='win').length,losses:rows.filter(r=>r.result==='loss').length+pve.filter(e=>e.confirmed && e.result==='loss').length,combatGold:known.reduce((n,r)=>n+r.gold,0)+knownPve.reduce((n,e)=>n+e.gold,0),missionGold:knownClaims.reduce((n,e)=>n+e.gold,0),unknown:rows.length-known.length+claims.length-knownClaims.length+pve.length-knownPve.length,rows,claims};
  }
  function act(el, fingerprint) {
    state.pending = fingerprint; state.message = 'Esperando confirmación del juego…'; log(({accept:'Aceptando misión',restart:'Reiniciando misión',claim:'Cobrando misión',reroll:'Solicitando misiones nuevas'})[fingerprint.kind] + (fingerprint.title ? ': ' + fingerprint.title : ''), 'action'); save(); el.click();
  }
  function questTick() {
    if (!ownerActive || !state.running || mod !== 'quests') return;
    if (captcha()) return stop('CAPTCHA detectado. Intervención humana requerida.');
    if (!verified()) return stop('Identidad sin verificar. Abre Visión general del personaje y reactiva.');
    if (Date.now() < (state.questRetryAt || 0) && !state.pending) return;
    const slots = [...document.querySelectorAll('#content .contentboard_slot')];
    if (!document.querySelector('#qcategory_grouparena') || !document.querySelector('#quest_footer_reroll')) {
      if (state.pending?.kind === 'claim') state.statsEvents.push({kind:'claim',at:Date.now(),gold:null});
      state.pending=null;
      state.questRetryAt=Date.now()+60000; state.message='Misiones no disponibles; revisaré más tarde.'; log(state.message,'warn'); save(); return;
    }
    if (state.pending) {
      const p = state.pending;
      const same = slots.find(s => s.querySelector('.quest_slot_title')?.textContent.trim() === p.title);
      const uncertain = (p.kind === 'accept' && !same?.classList.contains('contentboard_slot_active')) ||
        (p.kind === 'restart' && (!same || !same.classList.contains('contentboard_slot_active') || category(same) === 'qcategory_restart')) ||
        (p.kind === 'claim' && same?.querySelector('.quest_slot_button_finish')) ||
        (p.kind === 'reroll' && p.signature === slots.map(s => s.querySelector('.quest_slot_title')?.textContent.trim()).join('|'));
      if (uncertain) {
        if (p.kind === 'claim') state.statsEvents.push({kind:'claim',at:Date.now(),gold:null});
        state.pending=null; state.questRetryAt=Date.now()+60000;
        state.message='Misión sin confirmar; reanudo la cola y revisaré más tarde.'; log(state.message,'warn'); save(); return;
      }
      if (p.kind === 'claim') state.statsEvents.push({kind:'claim',at:Date.now(),gold:null});
      log(({accept:'Misión aceptada',restart:'Misión reiniciada',claim:'Misión ya no visible; cobro sin confirmar',reroll:'Misiones renovadas'})[p.kind] + (p.title ? ': ' + p.title : ''), 'success');
      state.pending = null; save();
    }
    for (const slot of slots) {
      const button = slot.querySelector('a.quest_slot_button_finish');
      if (safeLink(button, 'finishQuest')) return act(button, {kind:'claim', title:slot.querySelector('.quest_slot_title')?.textContent.trim(),gold:parseGold(slot.querySelector('.quest_slot_reward_gold')?.textContent)});
    }
    for (const slot of slots.filter(s => category(s) === 'qcategory_restart')) {
      const title = slot.querySelector('.quest_slot_title')?.textContent.trim() || '';
      if (!/^circo turma:/i.test(title) && !/^arena:.*\bo lucha en la arena provinciarum$/i.test(title) && !/^vence a \d+ enemigos en expediciones, en mazmorras o en las arenas$/i.test(title)) continue;
      const button = slot.querySelector('a.quest_slot_button_restart');
      if (safeLink(button, 'restartQuest')) return act(button, {kind:'restart', title});
    }
    for (const slot of slots.filter(s => s.classList.contains('contentboard_slot_inactive') && relevant(s))) {
      const button = slot.querySelector('a.quest_slot_button_accept');
      if (safeLink(button, 'startQuest')) return act(button, {kind:'accept', title:slot.querySelector('.quest_slot_title').textContent.trim()});
    }
    const count = document.querySelector('#content')?.textContent.match(/Misiones aceptadas:\s*(\d+)\s*\/\s*(\d+)/i);
    if (!count || Number(count[1]) >= Number(count[2])) { state.message = 'Esperando: misiones completas o plazas ocupadas.'; save(); return renderStatus(); }
    const reroll = document.querySelector('#quest_footer_reroll input[type="button"]');
    const onclick = reroll?.getAttribute('onclick') || '';
    if (visible(reroll) && !reroll.disabled && reroll.value === 'Misiones nuevas' && /submod=resetQuests(?:&|&amp;)/.test(onclick) && !/(rub[ií]|diamant|premium|reducir)/i.test(reroll.outerHTML)) {
      return act(reroll, {kind:'reroll', signature:slots.map(s => s.querySelector('.quest_slot_title')?.textContent.trim()).join('|')});
    }
    state.message = 'Esperando misiones nuevas o fin de tiempo de espera.'; save(); renderStatus();
  }
  function navigation(link, purpose) {
    if (!visible(link) || captcha() || !verified()) return false;
    if (Date.now() - (state.lastNavigationAt || 0) < 8000) return false;
    state.lastNavigationAt = Date.now(); state.message = purpose; save(); link.click(); return true;
  }
  function renewIdentity() {
    let identity;
    try { identity=JSON.parse(sessionStorage.getItem(ID)); } catch { return false; }
    if (!identity?.name || identity.name.normalize('NFKC').toLocaleLowerCase() !== accountName.normalize('NFKC').toLocaleLowerCase() || !Number.isFinite(identity.at) || Date.now()-identity.at < 15*60*1000) return false;
    const link=document.querySelector('#mainmenu a[href*="mod=overview"]');
    if (!visible(link) || captcha()) return false;
    try {
      const u=new URL(link.getAttribute('href'),location.href);
      if (u.origin!==location.origin || u.pathname!=='/game/index.php' || u.searchParams.get('mod')!=='overview' || u.searchParams.has('doll')) return false;
    } catch { return false; }
    if (Date.now()-(state.lastNavigationAt || 0)<8000) { state.message='Esperando para actualizar identidad.'; save(); return true; }
    state.lastNavigationAt=Date.now(); state.message='Actualizando identidad del personaje.'; save(); link.click(); return true;
  }
