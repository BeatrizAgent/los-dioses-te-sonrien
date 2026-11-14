import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const src=readFileSync(new URL('../src/bot/10-core-and-missions.js',import.meta.url),'utf8');
const code=src.slice(src.indexOf('  function makeRivalIndex()'),src.indexOf('  const rivalIndex=makeRivalIndex();'));
function make() { const ctx=vm.createContext({}); vm.runInContext(code,ctx); return ctx.makeRivalIndex(); }
const plain=value=>JSON.parse(JSON.stringify(value));

test('índice coincide con filtrado de historial de 10.000 resultados',()=>{
  const records=Array.from({length:10000},(_,i)=>({name:'rival'+i%101,server:i%2?'s1':'s2',mode:i%3?'turma':'arena',level:i%5,result:i%4?'win':'loss'}));
  const index=make(); index.sync(records);
  for (const rival of records.filter((_,i)=>i%37===0)) {
    const rows=records.filter(x=>x.name===rival.name&&x.server===rival.server&&x.mode===rival.mode&&x.level===rival.level);
    assert.deepEqual(plain(index.get(rival)),{wins:rows.filter(x=>x.result==='win').length,losses:rows.filter(x=>x.result==='loss').length,total:rows.length});
  }
});

test('inserciones, reducción y reemplazo reconstruyen sin perder identidad estricta',()=>{
  const index=make(), records=[{name:'X',server:'s1',mode:'arena',level:1,result:'win'}];
  index.sync(records); records.push({...records[0],result:'loss'}); index.sync(records);
  assert.deepEqual(plain(index.get(records[0])),{wins:1,losses:1,total:2});
  assert.equal(index.get({...records[0],level:'1'}).total,0);
  records.pop(); index.sync(records); assert.equal(index.get(records[0]).total,1);
  index.sync([]); assert.equal(index.get(records[0]).total,0);
});

test('estadísticas para combate coinciden con filtrado e ignoran valores no enteros seguros',()=>{
  const records=Array.from({length:10000},(_,i)=>({name:'rival'+i%37,server:i%2?'s1':'s2',mode:i%3?'turma':'arena',level:i%5,result:i%4?'win':'loss',damageEstimate:i%5===0?null:i%7===0?1.5:i,experience:i%6===0?undefined:i%11===0?Number.MAX_SAFE_INTEGER+1:i%20}));
  const index=make(); index.sync(records);
  for (const rival of records.filter((_,i)=>i%97===0)) {
    const rows=records.filter(x=>x.name===rival.name&&x.server===rival.server&&x.mode===rival.mode&&x.level===rival.level);
    const average=key=>{const values=rows.map(x=>x[key]).filter(Number.isSafeInteger);return values.length ? values.reduce((a,b)=>a+b,0)/values.length : null;};
    assert.deepEqual(plain(index.combat(rival)),{wins:rows.filter(x=>x.result==='win').length,losses:rows.filter(x=>x.result==='loss').length,damage:average('damageEstimate'),experience:average('experience')});
  }
  assert.deepEqual(plain(index.combat({name:'ausente'})),{wins:0,losses:0,damage:null,experience:null});
  records.push({...records[1],damageEstimate:2,experience:4}); index.sync(records);
  const rows=records.filter(x=>x.name===records[1].name&&x.server===records[1].server&&x.mode===records[1].mode&&x.level===records[1].level);
  const damages=rows.map(x=>x.damageEstimate).filter(Number.isSafeInteger);
  assert.equal(index.combat(records[1]).damage,damages.reduce((a,b)=>a+b,0)/damages.length);
  records.splice(0); index.sync(records);
  assert.equal(index.combat({name:'rival1'}).damage,null);
});

test('exportación local conserva resultados y excluye campos ajenos al historial',()=>{
  const panel=readFileSync(new URL('../src/bot/60-panel.js',import.meta.url),'utf8');
  const code=panel.slice(panel.indexOf('  function exportRivalHistory('),panel.indexOf('  function renderContent('));
  let payload='',clicked=false,revoked=false,link;
  const context={Blob:class {constructor(parts){payload=parts.join('');}}, URL:{createObjectURL:()=> 'blob:test',revokeObjectURL:()=>{revoked=true;}},
    document:{createElement:()=>link={click:()=>{clicked=true;}}},setTimeout:fn=>fn()};
  vm.createContext(context); vm.runInContext(code,context);
  context.exportRivalHistory([{name:'Rival',server:'s1',mode:'arena',level:1,result:'win',source:'informe',at:'2026-01-01',extraPrivate:'not-exported'}]);
  assert.deepEqual(JSON.parse(payload),{version:1,records:[{name:'Rival',server:'s1',mode:'arena',level:1,result:'win',source:'informe',at:'2026-01-01'}]});
  assert.equal(link.download,'historial-rivales.json'); assert.equal(clicked,true); assert.equal(revoked,true);
});
