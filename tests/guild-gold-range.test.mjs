import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
const healing=await readFile(new URL('../src/bot/20-healing.js',import.meta.url),'utf8');
const market=await readFile(new URL('../src/bot/30-guild-market.js',import.meta.url),'utf8');
const price=healing.match(/  const goldPriceAllowed=.*;/)[0];
const offers=market.slice(market.indexOf('  function goldOffers()'),market.indexOf('  function goldOwnCount'));
function run(prices){
 const rows=prices.map(price=>{const button={value:'Comprar',disabled:false,outerHTML:'<input>',form:{method:'post',getAttribute:k=>k==='action'?'/game/index.php?mod=guildMarket':null}};return {cells:[{querySelector:()=>({})},{textContent:'Aliado'},{textContent:String(price)},{textContent:'24 h'},{textContent:'1'}],textContent:'objeto',querySelector:()=>button};});
 const ctx={document:{querySelectorAll:()=>rows},goldItem:()=>({name:'Anillo',owner:null,basis:'6-1'}),parseGold:x=>/^\d+$/.test(x||'')?Number(x):null,goldPriceAllowed:null,URL,location:{href:'https://s64-es.gladiatus.gameforge.com/game/index.php',origin:'https://s64-es.gladiatus.gameforge.com'},accountName:'CassiusFerox',visible:()=>true,Number};
 return vm.runInNewContext(`${price}\n${offers}\ngoldOffers().map(o=>o.price)`,ctx);
}
test('acepta ofertas entre 100k y 1kk, ordenadas por precio',()=>{assert.deepEqual(Array.from(run([200000,300000,500000,1000000,150001,99999,1000001])),[1000000,500000,300000,200000,150001]);});
test('valida el precio tanto al comprar como al calcular la tarifa de venta',()=>{assert.equal((market.match(/!goldPriceAllowed\(price\)/g)||[]).length,2);assert.match(market,/balance-offer\.price-cost>=100000/);assert.match(market,/goldFee\(tx\.price\)/);});
const space=market.slice(market.indexOf('  function goldSpace('),market.indexOf('  function goldFee('));
function fits(width,height,items){
 const ctx={bag:{inv:{offsetWidth:128,offsetHeight:96,getBoundingClientRect:()=>({left:0,top:0,width:128,height:96})},items:items.map(({x,y,w=1,h=1})=>({getBoundingClientRect:()=>({left:x*32,top:y*32}),getAttribute:k=>String(k==='data-measurement-x'?w:h)}))},item:{width,height},visible:()=>true,Number,Math,Array};
 return vm.runInNewContext(`${space}\ngoldSpace(bag,item)`,ctx);
}
test('verifica hueco rectangular para objetos grandes y rechaza posiciones ambiguas',()=>{
 assert.equal(fits(2,2,[{x:0,y:0},{x:3,y:2}]),true);
 assert.equal(fits(2,2,[{x:0,y:1},{x:1,y:1},{x:2,y:1},{x:3,y:1}]),false);
 assert.equal(fits(2,2,[{x:0.5,y:0}]),false);
});
const itemFn=market.slice(market.indexOf('  function goldItem('),market.indexOf('  function goldSame('));
function item(name,basis,width,height){const attrs={'data-tooltip':JSON.stringify([[[name,'white']]]),'data-basis':basis,'data-level':'1','data-measurement-x':String(width),'data-measurement-y':String(height)};return vm.runInNewContext(`${itemFn}\ngoldItem(el)`,{el:{getAttribute:k=>attrs[k]??null},Number,JSON,Array});}
test('admite objetos de varias casillas y protege materiales reservados',()=>{assert.equal(item('Armadura','3-1',2,3)?.height,3);assert.equal(item('Material de forja','12-1',1,1),null);});

test('encuentra espacio con Array.from reemplazado por MooTools',()=>{
 const bag={inv:{offsetWidth:256,offsetHeight:160,getBoundingClientRect:()=>({left:0,top:0,width:256,height:160})},items:[]};
 const ArrayMoo={from:()=>[undefined,undefined,undefined,undefined,undefined]};
 assert.equal(vm.runInNewContext(`${space}\ngoldSpace(bag,item)`,{bag,item:{width:2,height:2},visible:()=>true,Number,Math,Array:ArrayMoo}),true);
});

 test('escala visual y hueco real de una casilla',()=>{
  for (const scale of [1,1.25,1.5,0.75]) {
    const bag={inv:{offsetWidth:128,offsetHeight:96,getBoundingClientRect:()=>({left:10,top:20,width:128*scale,height:96*scale})},items:[]};
    for(let y=0;y<3;y++) for(let x=0;x<4;x++) if(x!==3||y!==2) bag.items.push({getBoundingClientRect:()=>({left:10+x*32*scale,top:20+y*32*scale}),getAttribute:()=> '1'});
    const ctx={bag,item:{width:1,height:1},visible:()=>true,Number,Math,Array};
    assert.equal(vm.runInNewContext(`${space}\ngoldSpace(bag,item)`,ctx),true);
    bag.items.push({getBoundingClientRect:()=>({left:10+96*scale,top:20+64*scale}),getAttribute:()=> '1'});
    assert.equal(vm.runInNewContext(`${space}\ngoldSpace(bag,item)`,ctx),false);
    bag.items[11]=bag.items[0];
    assert.equal(vm.runInNewContext(`${space}\ngoldSpace(bag,item)`,ctx),false);
  }
 });
 test('rechaza dimensiones lógicas y posiciones no verificables',()=>{
  const bag={inv:{offsetWidth:127,offsetHeight:96,getBoundingClientRect:()=>({left:0,top:0,width:128,height:96})},items:[]};
  assert.equal(vm.runInNewContext(`${space}\ngoldSpace(bag,item)`,{bag,item:{width:1,height:1},visible:()=>true,Number,Math,Array}),false);
 });
