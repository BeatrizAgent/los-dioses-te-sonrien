import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const foodSource=readFileSync(new URL('../src/bot/20-healing.js',import.meta.url),'utf8');
const goldSource=readFileSync(new URL('../src/bot/30-guild-market.js',import.meta.url),'utf8');
function food(stage) {
 const state={blockedMarketSellers:['  ÁLIADO  '],foodBuyNeeded:!stage};
 const item={getAttribute:k=>({'data-hash':'hash','data-basis':'7-1','data-item-id':'123'}[k]??null)};
 const offer={seller:'áliado',price:100,food:{name:'Pan',amount:1,level:1,item},button:{click(){throw Error('No debe comprar');}}};
 if(stage) state.foodBuyTx={stage,seller:'áliado',price:100,name:'Pan',amount:1,level:1,basis:'7-1',offerHash:'hash',offerId:'123',at:Date.now()-10000,balanceBefore:200,confirmed:true,baselineEmpty:true};
 const c={state,Date,Number,String,URL,mod:'guildMarket',goldPageOpenedAt:0,goldBalance:()=>stage==='buy'?100:200,save(){},log(){},foodMarketOffers:()=>[offer],location:{origin:'https://s64-es.gladiatus.gameforge.com',href:'https://s64-es.gladiatus.gameforge.com/game/index.php'},accountName:'Cassius',visible:()=>true,window:{confirm(){}}};
 vm.createContext(c);vm.runInContext(foodSource.slice(foodSource.indexOf('  function foodMarketOffers('),foodSource.indexOf('  // Una sola operación de oro')),c);c.foodMarketOffers=()=>[offer];return c;
}
function gold(stage) {
 const now=Date.now(), state={blockedMarketSellers:['ALIADO'],goldPackageGuardV129:true,goldSafetyV1219:true};
 const el={getAttribute:k=>({'data-item-id':'123','data-hash':'hash'}[k]??null)};
 const offer={seller:'aliado',price:100000,item:{name:'Anillo'},button:{closest:()=>({querySelector:()=>el}),click(){throw Error('No debe comprar');}}};
 if(stage)state.goldTx={stage,at:now-6000,seller:'aliado',price:100000,item:offer.item,offerId:'123',offerHash:'hash',balanceBefore:600000,confirmed:true,baselineEmpty:true};
 const c={state,params:new URLSearchParams('mod=guildMarket'),location:{href:'https://s64-es.gladiatus.gameforge.com/game/index.php?mod=guildMarket',origin:'https://s64-es.gladiatus.gameforge.com'},document:{},Date,Number,Object,Array,String,JSON,mod:'guildMarket',goldPageOpenedAt:0,goldBalance:()=>500000,goldBag:()=>({items:[]}),goldOffers:()=>[offer],goldOfferPage:()=>({page:1,total:1}),goldSpace:()=>true,goldFee:()=>1000,goldSame:()=>true,save(){},log(){},visible:()=>true};
 vm.createContext(c);vm.runInContext(goldSource.slice(goldSource.indexOf('  function goldTick('),goldSource.indexOf('  // Fundición:')),c);return c;
}
test('omite vendedor excluido al elegir alimento',()=>{const c=food();assert.equal(c.foodMarketTick(),false);assert.equal(c.state.foodBuyTx,undefined);});
test('cancela alimento si vendedor se excluye antes de comprar',()=>{const c=food('readyBuy');assert.equal(c.foodMarketTick(),false);assert.equal(c.state.foodBuyTx,null);});
test('compra de alimento ya enviada sigue su verificación',()=>{const c=food('buy');assert.equal(c.foodMarketTick(),false);assert.equal(c.state.foodBuyTx.stage,'buy');});
test('omite vendedor excluido al elegir oro',()=>{const c=gold();assert.equal(c.goldTick(),false);assert.equal(c.state.goldTx,undefined);});
test('cancela oro si vendedor se excluye antes de comprar',()=>{const c=gold('readyBuy');assert.equal(c.goldTick(),false);assert.equal(c.state.goldTx,null);});
test('compra de oro ya enviada sigue su verificación',()=>{const c=gold('buy');assert.equal(c.goldTick(),false);assert.equal(c.state.goldTx.stage,'buy');});

test('perfil generado excluye alimento sin lista manual',()=>{const c=food();c.state.blockedMarketSellers=[];c.BUILD_CONFIG={blockedMarketSellers:['ÁLIADO']};assert.equal(c.foodMarketTick(),false);assert.equal(c.state.foodBuyTx,undefined);});
test('perfil generado excluye oro sin lista manual',()=>{const c=gold();c.state.blockedMarketSellers=[];c.BUILD_CONFIG={blockedMarketSellers:['ALIADO']};assert.equal(c.goldTick(),false);assert.equal(c.state.goldTx,undefined);});
