import {readFileSync} from 'node:fs';
import {performance} from 'node:perf_hooks';
import vm from 'node:vm';

const source=readFileSync(new URL('../src/bot/10-core-and-missions.js',import.meta.url),'utf8');
const implementation=source.slice(source.indexOf('  function makeRivalIndex()'),source.indexOf('  const rivalIndex=makeRivalIndex();'));
const context=vm.createContext({}); vm.runInContext(implementation,context);
console.log(`Node ${process.version}; plataforma ${process.platform}/${process.arch}; 100 rivales; mediana de 7 ejecuciones`);
for (const n of [100,1000,10000]) {
  const rows=Array.from({length:n},(_,i)=>({name:`r${i%100}`,server:'s1',mode:'arena',level:100,result:i%2?'win':'loss'}));
  const rivals=Array.from({length:100},(_,i)=>({name:`r${i}`,server:'s1',mode:'arena',level:100}));
  const oldTimes=[],newTimes=[];
  for (let run=0;run<7;run++) {
    let start=performance.now();
    const old=rivals.map(r=>{const found=rows.filter(x=>x.name===r.name&&x.server===r.server&&x.mode===r.mode&&x.level===r.level);return [found.filter(x=>x.result==='win').length,found.filter(x=>x.result==='loss').length,found.length];});
    oldTimes.push(performance.now()-start);
    start=performance.now(); const index=context.makeRivalIndex(); index.sync(rows);
    const current=rivals.map(r=>{const c=index.get(r);return [c.wins,c.losses,c.total];});
    newTimes.push(performance.now()-start);
    if (JSON.stringify(old)!==JSON.stringify(current)) throw new Error('Resultados diferentes');
  }
  oldTimes.sort((a,b)=>a-b); newTimes.sort((a,b)=>a-b);
  console.log(`${n} registros: filtrado=${oldTimes[3].toFixed(3)} ms; índice y consultas=${newTimes[3].toFixed(3)} ms`);
}
