import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../src/bot/50-combat-and-arena.js',import.meta.url),'utf8');
const functions=source.slice(source.indexOf('  function readTurmaParticipation()'),source.indexOf('  function combatTick()'));
function setup({status='Pasivo',mod='arena',sub='grouparena',state={},now=10000000}={}) {
  const visits=[];
  const clock={now:()=>now};
  const link={getAttribute:()=>'/game/index.php?mod=overview&sh=private'};
  const context={state,mod,sub,Date:clock,URL,location:{href:'https://s1-es.gladiatus.gameforge.com/game/index.php?mod=overview',origin:'https://s1-es.gladiatus.gameforge.com',assign:u=>visits.push(u)},
    document:{querySelectorAll:()=>status===null?[]:[{textContent:`Estado de participación actual: ${status}`}],querySelector:()=>link},visible:()=>true,log(){},save(){}};
  vm.createContext(context);vm.runInContext(functions,context);
  return {context,visits,setNow:n=>{now=n;}};
}
test('lee solo estado explícito de Turma y conserva pasivo',()=>{
  const {context}=setup();assert.equal(context.checkTurmaParticipation(),false);assert.equal(context.state.turmaParticipation.status,'pasivo');
});
test('no interpreta un estado ambiguo como activo',()=>{
  const {context}=setup({status:null,state:{turmaParticipation:{status:'pasivo',checkedAt:1}}});context.checkTurmaParticipation();assert.equal(context.state.turmaParticipation.status,'pasivo');
});
test('comprueba tras una hora y permite forzar antes, sin cambiar estado',()=>{
  const state={turmaParticipation:{status:'pasivo',checkedAt:10000000}};
  const {context,visits,setNow}=setup({mod:'overview',sub:'',state});
  assert.equal(context.checkTurmaParticipation(),false);setNow(13600000);assert.equal(context.checkTurmaParticipation(),true);
  const url=new URL(visits[0]);assert.equal(url.searchParams.get('submod'),'grouparena');assert.equal(url.searchParams.has('switchStatus'),false);
  state.turmaCheckRequested=true;state.turmaCheckRetryAt=0;setNow(13610000);assert.equal(context.checkTurmaParticipation(),true);
});
test('lectura activa posterior reanuda Turma',()=>{
  const state={turmaParticipation:{status:'pasivo',checkedAt:1},turmaCheckRequested:true};const {context}=setup({status:'Activo',state});context.checkTurmaParticipation();assert.equal(state.turmaParticipation.status,'activo');assert.equal(state.turmaCheckRequested,false);
});
