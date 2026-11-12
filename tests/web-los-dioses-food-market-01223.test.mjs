import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
const src=fs.readFileSync(new URL('../src/bot/20-healing.js',import.meta.url),'utf8');
const code=src.slice(src.indexOf('  function foodMarketOffers()'),src.indexOf('  // Una sola operación de oro'));
function setup() {
 let clicks=0; const state={foodBuyNeeded:true}; const food={name:'Pan',amount:1000,level:1};
 const c={state,Date,Number,String,URL,mod:'guildMarket',goldPageOpenedAt:0,goldBalance:()=>2000000,goldNav:()=>true,save:()=>{},log:()=>{},window:{confirm:()=>false},foodMarketOffers:()=>[],location:{origin:'https://s64-es.gladiatus.gameforge.com',href:'https://s64-es.gladiatus.gameforge.com/game/index.php'},accountName:'Cassius',visible:()=>true};
 vm.createContext(c);vm.runInContext(code,c);
 c.foodMarketOffers=()=>[{price:1500000,food,seller:'Aliado',notice:null,button:{click(){clicks++;}}}];
 return {c,state,get clicks(){return clicks}};
}
test('compra alimento asequible sin límite artificial de precio y nunca repite operación incierta',()=>{const x=setup();assert.equal(x.c.foodMarketTick(),true);assert.equal(x.clicks,1);assert.equal(x.state.foodBuyTx.price,1500000);x.state.foodBuyNeeded=true;for(let i=0;i<3;i++)assert.equal(x.c.foodMarketTick(),false);assert.equal(x.clicks,1);});
test('no compra alimento si hay operación de oro pendiente',()=>{const x=setup();x.state.goldTx={stage:'buy'};assert.equal(x.c.foodMarketTick(),false);assert.equal(x.clicks,0);});
test('no compra si no puede pagarlo',()=>{const x=setup();x.c.goldBalance=()=>100;assert.equal(x.c.foodMarketTick(),false);assert.equal(x.clicks,0);});
test('solo admite ofertas de alimentos compatibles, excluye las propias y ordena por precio',()=>{
 const x=setup(); const make=(seller,price,isFood,level=1)=>{const button={value:'Comprar',disabled:false,outerHTML:'',form:{method:'post',getAttribute:k=>k==='action'?'/game/index.php?mod=guildMarket':null}};return {cells:[{querySelector:()=>isFood?{level}:null},{textContent:seller},{textContent:String(price)},{textContent:'24 h'},{textContent:'1'}],textContent:'',querySelector:()=>button};};
 const rows=[make('Aliado',900000,true),make('Aliado',300000,true),make('Cassius',1,true),make('Aliado',2,false),make('Aliado',3,true,101)];
 x.c.document={querySelector:()=>({textContent:'96'}),querySelectorAll:()=>rows};x.c.parseGold=Number;x.c.healingFood=el=>el?{name:'Pan',amount:100,level:el.level}:null;
 vm.runInContext(code,x.c);const offers=x.c.foodMarketOffers();assert.deepEqual(Array.from(offers,o=>o.price),[300000,900000]);
});
