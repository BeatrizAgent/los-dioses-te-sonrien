import { readFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import vm from 'node:vm';

const source=readFileSync(new URL('../src/bot/10-core-and-missions.js',import.meta.url),'utf8');
const code=source.slice(source.indexOf('  function makeRivalIndex()'),source.indexOf('  const rivalIndex=makeRivalIndex();'));
const context=vm.createContext({}); vm.runInContext(code,context);
const median=values=>values.sort((a,b)=>a-b)[Math.floor(values.length/2)];
console.log(`Node ${process.version}; ${process.platform}/${process.arch}; 100 rivales; mediana de 7 ejecuciones`);
for (const n of [100,1000,10000]) {
  const rows=Array.from({length:n},(_,i)=>({name:`r${i%100}`,server:'s1',mode:'arena',level:50,result:i%2?'win':'loss',damageEstimate:i%100,experience:i%20}));
  const rivals=Array.from({length:100},(_,i)=>({name:`r${i}`,server:'s1',mode:'arena',level:50}));
  const oldTimes=[],coldTimes=[],warmTimes=[];
  for (let run=0;run<7;run++) {
    let start=performance.now();
    const old=rivals.map(r=>{const history=rows.filter(x=>x.name===r.name&&x.server===r.server&&x.mode===r.mode&&x.level===r.level), damages=history.map(x=>x.damageEstimate).filter(Number.isSafeInteger), experiences=history.map(x=>x.experience).filter(Number.isSafeInteger);return {wins:history.filter(x=>x.result==='win').length,losses:history.filter(x=>x.result==='loss').length,damage:damages.length?damages.reduce((a,b)=>a+b,0)/damages.length:null,experience:experiences.length?experiences.reduce((a,b)=>a+b,0)/experiences.length:null};});
    oldTimes.push(performance.now()-start);
    start=performance.now(); const index=context.makeRivalIndex(); index.sync(rows); const current=rivals.map(r=>index.combat(r)); coldTimes.push(performance.now()-start);
    if (JSON.stringify(old)!==JSON.stringify(current)) throw new Error('Resultados diferentes');
    start=performance.now(); index.sync(rows); rivals.forEach(r=>index.combat(r)); warmTimes.push(performance.now()-start);
  }
  console.log(`${n} registros: filtrado=${median(oldTimes).toFixed(3)} ms; índice inicial=${median(coldTimes).toFixed(3)} ms; índice reutilizado=${median(warmTimes).toFixed(3)} ms`);
}
