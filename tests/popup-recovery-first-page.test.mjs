import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../src/bot/40-popup-and-pve.js',import.meta.url),'utf8');

test('aviso persistente vuelve a cargar la pagina segura tras un minuto',()=>{
  let now=1000000, loads=0;
  const FakeDate={now:()=>now},state={},link={getAttribute:()=>'/game/index.php?mod=overview&sh=x'};
  const location={href:'https://s1-es.gladiatus.gameforge.com/game/index.php?mod=inventory',origin:'https://s1-es.gladiatus.gameforge.com',assign:()=>loads++};
  const ctx={state,Date:FakeDate,URL,location,params:new URLSearchParams('mod=inventory'),mod:'inventory',sub:'',document:{querySelector:()=>link},visible:()=>true,captcha:()=>false,save:()=>{},log:()=>{},stop:()=>{throw Error('unexpected stop');}};
  vm.createContext(ctx);vm.runInContext(source.slice(source.indexOf('  function recoverPopup('),source.indexOf('  function recoverUnexpectedPopup(')),ctx);
  ctx.recoverPopup('aviso');assert.equal(loads,1);now+=59000;ctx.recoverPopup('aviso');assert.equal(loads,1);now+=1000;ctx.recoverPopup('aviso');assert.equal(loads,2);
});
