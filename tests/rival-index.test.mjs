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
