// ==UserScript==
// @name         Los Dioses Te Sonríen - Asistente Gladiatus
// @namespace    axelbot.evento
// @version      0.12.85
// @description  Bot configurable para Gladiatus. Revisa los módulos elegidos antes de activarlo.
// @match        https://*.gladiatus.gameforge.com/game/index.php*
// @grant        none
// ==/UserScript==
(() => {
  'use strict';
  const BUILD_CONFIG = Object.freeze(__BUILD_CONFIG__);
  if (!/^(?:s\d+-es|s35-pt)\.gladiatus\.gameforge\.com$/i.test(new URL(location.href).hostname)) return;
  if (window.screen?.width <= 600 && !document.querySelector('meta[name="viewport"]') && document.head) {
    const viewport=document.createElement('meta'); viewport.name='viewport'; viewport.content='width=device-width, initial-scale=1'; document.head.append(viewport);
  }
  const ID = 'axelbot.evento.identity';
  const character = document.querySelector('.playername_achievement, .playername.ellipsis, .player_name_bg .playername, .playername, #header_values_name, #header_values_playername, #avatar .char_name');
  let accountName = '';
  const initialParams = new URLSearchParams(location.search);
  if (initialParams.get('mod') === 'overview' && (!initialParams.has('doll') || ['0','1'].includes(initialParams.get('doll')))) {
    if (character?.textContent.trim() && character.getClientRects().length) {
      accountName = character.textContent.trim();
      sessionStorage.setItem(ID, JSON.stringify({name:accountName,at:Date.now()}));
    }
  } else {
    try { const identity=JSON.parse(sessionStorage.getItem(ID)); if (identity?.name && Date.now()-identity.at >= 0 && Date.now()-identity.at < 15*60*1000) accountName=identity.name; } catch {}
  }
  let waitingNotice = null;
  let ownerActive = false, ownerStarted = false, ownerRelease = null;
  let ownerCanYield = () => false;
  const betaControlKey = 'gladibot.beta.control.v1.'+location.hostname.toLowerCase()+'.'+encodeURIComponent(accountName.normalize('NFKC').trim().toLocaleLowerCase('es'));
  function betaWantsControl() {
    try {const x=JSON.parse(localStorage.getItem(betaControlKey));return typeof x?.id==='string' && Number.isFinite(x.until) && x.until>Date.now() && x.until<=Date.now()+60000;} catch {return false;}
  }
  window.addEventListener('pageshow', event => {
    if (event.persisted && !ownerActive) {
      document.querySelector('#axel-evento-panel')?.remove();
      const verification=[...document.querySelectorAll('iframe[src*="captcha" i], iframe[src*="turnstile" i], .g-recaptcha, .h-captcha, .cf-turnstile, #recaptcha, input[name*="captcha" i], [data-sitekey]')].some(el=>el.getClientRects().length);
      if (verification) { showWaiting('CAPTCHA detectado. Intervención humana requerida.'); return; }
      const link=document.querySelector('#mainmenu a[href*="mod=overview"]');
      try {
        const url=new URL(link?.getAttribute('href'),location.href);
        if (link?.getClientRects().length && url.origin===location.origin && url.pathname==='/game/index.php' && url.searchParams.get('mod')==='overview' && !url.searchParams.has('doll')) { link.click(); return; }
      } catch {}
      showWaiting('Vuelve a Visión general para reanudar el bot.');
    }
  });
  function showWaiting(message) {
    if (!waitingNotice) {
      waitingNotice = document.createElement('aside');
      waitingNotice.id = 'axel-evento-waiting';
      waitingNotice.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:2147483000;background:#211b18;color:#f5e6c7;padding:14px;border:1px solid #a88150;border-radius:10px;font:13px system-ui;max-width:320px';
      document.body.append(waitingNotice);
    }
    waitingNotice.textContent = message;
  }
  function acquireOwner() {
    if (!accountName) {
      const verification=[...document.querySelectorAll('iframe[src*="captcha" i], iframe[src*="turnstile" i], .g-recaptcha, .h-captcha, .cf-turnstile, #recaptcha, input[name*="captcha" i], [data-sitekey]')].some(el=>el.getClientRects().length);
      if (verification) { showWaiting('CAPTCHA detectado. Intervención humana requerida.'); return; }
      const link=document.querySelector('#mainmenu a[href*="mod=overview"]');
      if ((initialParams.get('mod') !== 'overview' || (initialParams.has('doll') && !['0','1'].includes(initialParams.get('doll')))) && link?.getClientRects().length) {
        try {
          const url=new URL(link.getAttribute('href'),location.href);
          if (url.origin===location.origin && url.pathname==='/game/index.php' && url.searchParams.get('mod')==='overview' && !url.searchParams.has('doll')) {
            showWaiting('Identificando personaje automáticamente…'); link.click(); return;
          }
        } catch {}
      }
      showWaiting('No se pudo identificar el personaje en esta página.'); return;
    }
    if (!navigator.locks || !window.isSecureContext) {
      showWaiting('Bot detenido: este navegador no permite proteger los datos entre pestañas.');
      return;
    }
    if (betaWantsControl()) {showWaiting('Beta activa o esperando control; el bot principal reanudará después.');setTimeout(acquireOwner,3000);return;}
    const lockName = 'axelbot.evento.owner.' + encodeURIComponent(accountName.normalize('NFKC').toLocaleLowerCase());
    navigator.locks.request(lockName, {mode:'exclusive', ifAvailable:true}, lock => {
      if (!lock) {
        showWaiting('Otra pestaña controla Axelbot. Esperando para evitar sobrescribir datos.');
        setTimeout(acquireOwner, 3000);
        return;
      }
      if (betaWantsControl()) {showWaiting('Beta esperando control.');setTimeout(acquireOwner,3000);return;}
      waitingNotice?.remove();
      ownerActive = true;
      try { if (!ownerStarted) { startBot(); ownerStarted=true; } } catch (error) {
        ownerActive = false;
        document.querySelector('#axel-evento-panel')?.remove();
        const kind = /^[A-Za-z]+Error$/.test(error?.name || '') ? error.name : 'Error';
        showWaiting('Error al iniciar el panel (' + kind + '). El bot no está activo; revisa la consola.');
        console.error('[Los Dioses Te Sonríen] Error al iniciar el panel:', kind);
        return;
      }
      return new Promise(resolve => {
        let done=false; const finish=()=>{if(done)return;done=true;clearInterval(check);ownerRelease=null;ownerActive=false;resolve();};
        ownerRelease=finish;
        const check=setInterval(()=>{if(betaWantsControl() && ownerCanYield()) {showWaiting('Beta activa; el bot principal reanudará al terminar.');finish();setTimeout(acquireOwner,3000);}},1000);
        window.addEventListener('pagehide',finish,{once:true});
      });
    }).catch(error => { ownerActive = false; const kind = /^[A-Za-z]+Error$/.test(error?.name || '') ? error.name : 'Error'; showWaiting('Error del bloqueo (' + kind + '). El bot no está activo.'); });
  }
  acquireOwner();
  function startBot() {
