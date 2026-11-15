import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../src/bot/40-popup-and-pve.js',import.meta.url),'utf8');
const code=source.slice(0,source.indexOf('  function lootTick()'));
function setup({captcha=false,href='/game/index.php?mod=overview',mod='guildMarket',sub=''}={}) {
 const state={running:true,goldTx:{stage:'buy'},smeltTx:{stage:'rent'}}, calls=[], location={origin:'https://s64-es.gladiatus.gameforge.com',href:'https://s64-es.gladiatus.gameforge.com/game/index.php?mod=guildMarket',assign:u=>calls.push(['nav',new URL(u).searchParams.get('mod')])};
 const link={getAttribute:()=>href};const ctx={state,params:new URLSearchParams('mod=guildMarket'),mod,sub,location,URL,Date,document:{querySelector:()=>link},visible:x=>!!x,captcha:()=>captcha,stop:m=>{state.running=false;calls.push(['stop',m])},log:()=>{},save:()=>{}};
 vm.createContext(ctx);vm.runInContext(code,ctx);return {ctx,state,calls};
}
test('aviso desconocido regresa a vision general y conserva transacciones',()=>{const x=setup();assert.equal(x.ctx.recoverUnexpectedPopup({textContent:'Aviso inesperado'},'desconocido'),true);assert.equal(x.calls[0][0],'nav');assert.equal(x.calls[0][1],'overview');assert.equal(x.state.goldTx.stage,'buy');assert.equal(x.state.smeltTx.stage,'rent');assert.equal(x.state.running,true);});
test('el aviso persistente detiene el bucle de recargas',()=>{const x=setup();x.ctx.recoverUnexpectedPopup({textContent:'Aviso'},'desconocido');x.ctx.recoverUnexpectedPopup({textContent:'Aviso'},'desconocido');assert.deepEqual(x.calls.map(c=>c[0]),['nav','stop']);});
test('CAPTCHA y aviso de verificacion no provocan recarga',()=>{for(const a of [{captcha:true,text:'Aviso'},{captcha:false,text:'Verificación de cuenta requerida'}]){const x=setup({captcha:a.captcha});x.ctx.recoverUnexpectedPopup({textContent:a.text},'desconocido');assert.equal(x.calls[0][0],'stop');assert.equal(x.state.running,false);}});
test('no navega a un destino externo o con acciones desconocidas',()=>{for(const href of ['https://ejemplo.es/game/index.php?mod=overview','/game/index.php?mod=overview&action=delete']) { const x=setup({href});x.ctx.recoverUnexpectedPopup({textContent:'Aviso'},'desconocido');assert.equal(x.calls[0][0],'stop'); }});
test('cierra aviso informativo con control de cierre verificable solo una vez',()=>{const x=setup();let clicks=0;const button={tagName:'BUTTON',disabled:false,form:null,getAttribute:()=> 'blackoutDialog(false)',click:()=>clicks++};const dialog={textContent:'Nuevo logro conseguido',querySelector:()=>button};assert.equal(x.ctx.recoverUnexpectedPopup(dialog,'logro'),true);assert.equal(x.ctx.recoverUnexpectedPopup(dialog,'logro'),true);assert.equal(clicks,1);assert.equal(x.calls.length,0);assert.equal(x.state.goldTx.stage,'buy');});
test('no pulsa controles desconocidos ni avisos con coste',()=>{for(const [text,onclick] of [['Nuevo logro','comprar()'],['Nuevo título por 10 rubíes','blackoutDialog(false)']]){const x=setup();let clicks=0;const dialog={textContent:text,querySelector:()=>({tagName:'BUTTON',getAttribute:()=>onclick,click:()=>clicks++})};x.ctx.recoverUnexpectedPopup(dialog,'aviso');assert.equal(clicks,0);assert.equal(x.calls[0][0],'nav');}});
