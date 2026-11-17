import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../src/bot/50-combat-and-arena.js',import.meta.url),'utf8');
const code=source.slice(source.indexOf('  let stallObservation='),source.indexOf('  function combatTick()'));
function setup({href='https://s1-es.gladiatus.gameforge.com/game/index.php?mod=location&loc=7',captchaFlag=false,running=true,ready=true}={}){
 let now=1000000,visits=0;const u=new URL(href),state={running};const c={state,URL,Date:{now:()=>now},Number,JSON,ownerActive:true,mod:u.searchParams.get('mod'),sub:u.searchParams.get('submod'),params:u.searchParams,location:{href,origin:u.origin,assign:()=>visits++},BUILD_CONFIG:{modules:{expedition:true}},captcha:()=>captchaFlag,verified:()=>true,healthReading:()=>({current:100,maximum:100}),cooldownSeconds:()=>ready?0:30,document:{querySelector:s=>s==='#expeditionpoints_value'?{textContent:'1'}:null},save(){},log(){}};
 vm.createContext(c);vm.runInContext(code,c);return {c,state,advance:ms=>{now+=ms},get visits(){return visits}};
}
test('recarga GET una vez tras 90 segundos sin avance y limita reintentos',()=>{const x=setup();assert.equal(x.c.stallRecoveryTick(),false);x.advance(89999);assert.equal(x.c.stallRecoveryTick(),false);x.advance(1);assert.equal(x.c.stallRecoveryTick(),true);assert.equal(x.visits,1);x.c.stallRecoveryTick();x.advance(90000);assert.equal(x.c.stallRecoveryTick(),false);assert.equal(x.visits,1);});
test('no recarga acciones, captcha, bot detenido ni espera normal',()=>{for(const opts of [{href:'https://s1-es.gladiatus.gameforge.com/game/index.php?mod=location&loc=7&action=attack'},{captchaFlag:true},{running:false},{ready:false}]){const x=setup(opts);x.c.stallRecoveryTick();x.advance(91000);assert.equal(x.c.stallRecoveryTick(),false);assert.equal(x.visits,0);}});
test('cambio de fase reinicia cuenta y conserva operación pendiente',()=>{const x=setup();x.state.goldTx={stage:'buy',at:123};x.c.stallRecoveryTick();x.advance(80000);x.state.goldTx.stage='verifyBuy';x.c.stallRecoveryTick();x.advance(20000);assert.equal(x.c.stallRecoveryTick(),false);assert.equal(x.state.goldTx.stage,'verifyBuy');});


test('error interno activa vigilancia aun sin tareas listas',()=>{const x=setup({ready:false});x.c.stallRecoveryTick(true);x.advance(90000);assert.equal(x.c.stallRecoveryTick(true),true);assert.equal(x.visits,1);});


test('desajustes repetidos de expedición permiten recuperar aunque haya navegaciones',()=>{const x=setup();x.state.expeditionMismatchSince=910000;assert.equal(x.c.stallRecoveryTick(),true);assert.equal(x.visits,1);});
test('desajuste de expedición no interrumpe una transacción pendiente',()=>{const x=setup();x.state.expeditionMismatchSince=910000;x.state.goldTx={stage:'buy',at:999999};assert.equal(x.c.stallRecoveryTick(),false);assert.equal(x.visits,0);});
