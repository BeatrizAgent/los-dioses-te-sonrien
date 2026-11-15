import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../src/bot/30-guild-market.js',import.meta.url),'utf8');
const helpers=source.slice(source.indexOf('  function goldOfferPage()'),source.indexOf('  // Recuento completo'));
const tick=source.slice(source.indexOf('  function goldTick('),source.indexOf('  // Fundición:'));
function fixture({page=1,total=2,query='',stage=null}={}) {
  const now=Date.now();
  const href=`https://s64-es.gladiatus.gameforge.com/game/index.php?mod=guildMarket&p=${page}${query}`;
  const location={href,origin:new URL(href).origin,assign(url){this.destination=url;}};
  const state={goldPackageGuardV129:true,goldSafetyV1219:true,goldTx:stage?{stage,at:now-6000,offerPage:2,offerSort:'',offerFl:'0',price:100000,balanceBefore:600000,confirmed:true,baselineEmpty:true,offerId:'123'}:null};
  const context={state,params:new URL(href).searchParams,location,document:{body:{innerText:`Página ${page} / ${total}`},querySelector:()=>null},URL,Date,Number,Object,Array,String,JSON,mod:'guildMarket',goldPageOpenedAt:now-6000,goldBalance:()=>500000,goldBag:()=>({items:[]}),goldOffers:()=>[],goldSpace:()=>true,goldFee:()=>1000,save:()=>{},log:()=>{},captcha:()=>false,verified:()=>true,visible:()=>true};
  vm.createContext(context);vm.runInContext(helpers+tick,context);return {context,state,location};
}
test('busca siguiente página y vuelve a empezar tras última',()=>{
  const first=fixture();assert.equal(first.context.goldTick(),true);assert.equal(first.state.goldOfferScanPage,2);assert.equal(new URL(first.location.destination).searchParams.get('p'),'2');
  const last=fixture({page:2});last.state.goldOfferScanPage=2;assert.equal(last.context.goldTick(),false);assert.equal(last.state.goldOfferScanPage,1);assert.ok(last.state.goldCheckAt>Date.now());
});
test('retorna a página original antes de verificar compra',()=>{
  const x=fixture({stage:'buy'});assert.equal(x.context.goldTick(),true);assert.equal(new URL(x.location.destination).searchParams.get('p'),'2');assert.equal(x.state.goldTx.stage,'buy');
});
test('orden distinto comprueba paquetes sin repetir compra',()=>{
  const x=fixture({stage:'buy',query:'&s=pd'});assert.equal(x.context.goldTick(),true);assert.equal(x.state.goldTx.stage,'verifyBuy');assert.equal(x.location.destination,undefined);
});
test('vuelve a la página seleccionada antes de intentar comprar',()=>{
  const x=fixture({stage:'readyBuy'});assert.equal(x.context.goldTick(),true);assert.equal(new URL(x.location.destination).searchParams.get('p'),'2');assert.equal(x.state.goldTx.stage,'readyBuy');
});
test('si cambió orden antes de comprar cancela sin enviar compra',()=>{
  const x=fixture({stage:'readyBuy',query:'&s=pd'});assert.equal(x.context.goldTick(),false);assert.equal(x.state.goldTx,null);assert.equal(x.location.destination,undefined);
});
test('rechaza paginación contradictoria, filtros y parámetros duplicados',()=>{
  for(const query of ['&p=2','&f=6','&seller=alguien','&s=x&s=y']) {const x=fixture({query});assert.equal(x.context.goldOfferPage(),null);assert.equal(x.context.goldTick(),false);assert.equal(x.location.destination,undefined);}
  const x=fixture();x.context.document.body.innerText='Página 2 / 2';assert.equal(x.context.goldOfferPage(),null);
});
test('reutiliza espacio y tarifa durante la lectura de ofertas equivalentes',()=>{
  const x=fixture({total:1});let spaces=0,fees=0;
  x.context.goldOffers=()=>Array.from({length:3},()=>({price:100000,item:{width:1,height:1}}));
  x.context.goldSpace=()=>{spaces++;return true;};
  x.context.goldFee=()=>{fees++;return null;};
  assert.equal(x.context.goldTick(),false);
  assert.equal(spaces,1);assert.equal(fees,1);
});
