import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const src=await readFile(new URL('../src/bot/30-guild-market.js',import.meta.url),'utf8');
const code=src.slice(src.indexOf('  function goldMarketScan('),src.indexOf('  function goldTick('));
function run({phase='baseline',page=1,total=2,scan=null,count=0,before=0,scope='all-pages-v2',bad=false}={}) {
 let clicked=0,review='',pause='',saved=0;const tx={price:100000,item:{},at:0,ownBefore:before,ownCountScope:scope,...(scan?{saleScan:scan}:{})};const state={goldTx:tx};
 const link={getAttribute:()=>`/game/index.php?mod=guildMarket&fl=0&fq=-1&f=0&qry=&seller=&s=&p=${page===1?2:1}`,click(){clicked++;}};
 const document={body:{innerText:`Página ${bad?3:page} / ${total}`},querySelector:s=>s==='#market_item_table'?{querySelectorAll:()=>[{}]}:null,querySelectorAll:s=>s==='a[href]'?[link]:[]};
 const location={origin:'https://s64-es.gladiatus.gameforge.com',href:`https://s64-es.gladiatus.gameforge.com/game/index.php?mod=guildMarket${page===1?'':'&p='+page}`};
 const c={document,location,params:new URL(location.href).searchParams,URL,Date,Number,Object,state,goldPageOpenedAt:0,visible:x=>!!x,goldOwnCount:()=>count,save:()=>saved++,log:()=>{},goldPause:m=>pause=m,goldReview:m=>review=m};vm.createContext(c);vm.runInContext(code,c);let result=c.goldMarketScan(tx,phase);return {tx,state,clicked,review,pause,result};
}
test('recorre páginas antes de guardar referencia y acumula anuncios',()=>{const a=run({count:1});assert.equal(a.clicked,1);assert.equal(a.tx.ownCountScope,'all-pages-v2');const b=run({page:2,scan:a.tx.saleScan,count:2});assert.equal(b.tx.ownBefore,3);assert.equal(b.tx.saleScan,undefined);});
test('confirma solo incremento tras revisar todas las páginas',()=>{const a=run({phase:'verify',before:1,count:0});assert.equal(a.clicked,1);assert.ok(a.state.goldTx);const b=run({phase:'verify',page:2,scan:a.tx.saleScan,before:1,count:2});assert.equal(b.state.goldTx,null);});
test('sin incremento conserva operación y no repite venta',()=>{const x=run({phase:'verify',page:1,total:1,before:1,count:1});assert.ok(x.state.goldTx);assert.match(x.pause,/no confirmado/);});
test('paginación contradictoria exige revisión',()=>{const x=run({bad:true});assert.match(x.review,/contradictoria/);assert.equal(x.clicked,0);});
