import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../src/bot/30-guild-market.js',import.meta.url),'utf8');
const code=source.slice(source.indexOf('  function packageSearchPlan('),source.indexOf('  // Fundición:'));
function fixture({page='1',names=['Ojo de Ra'],scan, next=false}={}) {
 const now=Date.now(), item={name:'Ojo de Ra',owner:null,soul:null,basis:'8-1',width:1,height:1}, tx={stage:'packages',at:now,loadedAt:now-6000,item,packageScan:scan,packageFilter:{query:'Ojo de Ra',type:'0',optimized:false}};
 const elements=names.map((name,i)=>({getAttribute:k=>({'data-tooltip':JSON.stringify([[[name,'white']]]),'data-hash':'hash'+i}[k]??null),closest:()=>({textContent:'Mercado'}),hasAttribute:()=>true,dispatchEvent(){throw Error('No debe mover objetos en esta prueba');}}));
 const pkg={querySelectorAll:()=>elements,textContent:''};
 const state={goldTx:tx,goldEnabled:true,goldPackageGuardV129:true,goldSafetyV1219:true}; const params=new URLSearchParams('f=0&fq=-1&qry=Ojo+de+Ra'+(page?'&page='+page:''));
 const location={origin:'https://s64-es.gladiatus.gameforge.com',href:'https://s64-es.gladiatus.gameforge.com/game/index.php?mod=packages&f=0&fq=-1&qry=Ojo+de+Ra'+(page?'&page='+page:''),assign:u=>{location.destination=u;}};
 const c={state,params,location,mod:'packages',goldPageOpenedAt:now-6000,Date,URL,Number,String,Array,JSON,document:{querySelector:s=>s==='#packages'?pkg:s==='.paging_right_step'&&next?{}:null},visible:x=>!!x,log:()=>{},save:()=>{},parseGold:()=>500000,validItemHash:x=>typeof x==='string'&&!!x,accountName:'CassiusFerox'};
 vm.createContext(c);vm.runInContext(code,c);c.goldBalance=()=>500000;c.goldBag=()=>({items:[]});c.goldSpace=()=>true;c.goldItem=el=>({ ...item,name:JSON.parse(el.getAttribute('data-tooltip'))[0][0][0] });return {c,state,tx,location};
}
test('ignora objetos ajenos y recoge coincidencia reciente',()=>{const x=fixture({names:['Ojo de Ra','Trapos'],next:true});let moved=0;const el=x.c.document.querySelector('#packages').querySelectorAll()[0];el.dispatchEvent=()=>moved++;x.c.MouseEvent=function(){};x.c.window={};assert.equal(x.c.goldTick(),true);assert.equal(x.tx.stage,'transfer');assert.equal(moved,1);assert.equal(x.location.destination,undefined);});
test('bloquea pagina duplicada sin seguir navegando',()=>{const x=fixture({page:'20&page=1'});assert.equal(x.c.goldTick(),false);assert.equal(x.tx.manualReview,true);assert.equal(x.location.destination,undefined);});
test('bloquea paginas con contenido identico aunque cambie el numero',()=>{const x=fixture({page:'2',scan:{pages:[1],matches:[],complete:false,fingerprints:{1:'hash0'}}});assert.equal(x.c.goldTick(),false);assert.match(x.tx.problem,/repetido/);});
test('mantiene el bloqueo manual y no reintenta la compra',()=>{const x=fixture();x.tx.blocked=true;x.tx.manualReview=true;x.tx.retryAt=0;assert.equal(x.c.goldTick(),false);assert.equal(x.tx.blocked,true);});
test('continúa a la segunda página si no hay coincidencia reciente',()=>{const x=fixture({names:['Otro'],next:true});assert.equal(x.c.goldTick(),true);assert.equal(new URL(x.location.destination).searchParams.get('page'),'2');assert.equal(x.tx.blocked,undefined);});

test('una transaccion de versiones anteriores requiere revision manual',()=>{const x=fixture();delete x.state.goldPackageGuardV129;assert.equal(x.c.goldTick(),false);assert.equal(x.tx.manualReview,true);assert.match(x.tx.problem,/versión anterior/);});


test('elige término completo y tipo de equipo para reducir resultados',()=>{const x=fixture();const p=x.c.packageSearchPlan({name:'Botas de Placas Lulus de los Campos Elíseos',basis:'8-10'});assert.equal(p.query,'Elíseos');assert.equal(p.type,'8');assert.equal(p.optimized,true);});
test('tipos no comprobados usan Todo sin inventar categoría',()=>{const x=fixture();const p=x.c.packageSearchPlan({name:'Ojo de Ra',basis:'18-1'});assert.equal(p.query,'Ojo de Ra');assert.equal(p.type,'0');});
test('sin coincidencia en filtro preciso intenta búsqueda amplia antes de detenerse',()=>{const x=fixture({names:['Trapos']});x.tx.packageFilter={query:'Ojo',type:'8',optimized:true};x.c.params=new URLSearchParams('f=8&fq=-1&qry=Ojo&page=1');x.c.location.href='https://s64-es.gladiatus.gameforge.com/game/index.php?mod=packages&f=8&fq=-1&qry=Ojo&page=1';assert.equal(x.c.goldTick(),true);assert.equal(x.tx.packageFilter.query,'Ojo de Ra');assert.equal(x.tx.packageFilter.type,'0');assert.equal(x.tx.manualReview,undefined);});


test('compra incierta no se confirma por saldo ni se repite',()=>{const x=fixture();x.tx.stage='buy';x.tx.at=Date.now()-6000;x.tx.balanceBefore=800000;x.tx.price=300000;x.tx.confirmed=true;x.c.mod='guildMarket';x.c.goldOffers=()=>[];for(let i=0;i<3;i++)assert.equal(x.c.goldTick(),false);assert.equal(x.tx.stage,'buy');});
test('línea base sin coincidencias permite comprobar la oferta',()=>{const x=fixture({names:['Trapos']});x.tx.stage='baseline';assert.equal(x.c.goldTick(),true);assert.equal(x.tx.stage,'readyBuy');assert.equal(x.tx.baselineEmpty,true);});
test('una coincidencia anterior impide comprar',()=>{const x=fixture();x.tx.stage='baseline';assert.equal(x.c.goldTick(),false);assert.equal(x.state.goldTx,null);});
test('una coincidencia anterior descarta compra sin recorrer páginas restantes',()=>{const x=fixture({next:true});x.tx.stage='baseline';assert.equal(x.c.goldTick(),false);assert.equal(x.state.goldTx,null);assert.equal(x.location.destination,undefined);});
test('sin oferta y con saldo y línea base verificados busca paquete, sin repetir compra',()=>{const x=fixture();Object.assign(x.tx,{stage:'buy',at:Date.now()-6000,baselineEmpty:true,balanceBefore:800000,price:300000,confirmed:true,offerId:'123'});x.c.mod='guildMarket';x.c.goldOffers=()=>[];assert.equal(x.c.goldTick(),true);assert.equal(x.tx.stage,'packages');});
test('una oferta antigua aún presente impide atribuir el saldo a la compra',()=>{const x=fixture();Object.assign(x.tx,{stage:'buy',at:Date.now()-6000,baselineEmpty:true,balanceBefore:800000,price:300000,confirmed:true,seller:'Otro',offerHash:'h',offerId:'123'});x.c.mod='guildMarket';let include=false;x.c.goldOffers=all=>{include=all;return [{price:300000,seller:'Otro',item:x.tx.item,button:{closest:()=>({querySelector:()=>({getAttribute:k=>k==='data-item-id'?'123':'h'})})}}];};assert.equal(x.c.goldTick(),false);assert.equal(include,true);assert.equal(x.tx.stage,'buy');});
test('saldo incierto inicia comprobación automática de paquetes sin repetir compra',()=>{const x=fixture();Object.assign(x.tx,{stage:'buy',at:Date.now()-6000,baselineEmpty:true,balanceBefore:900000,price:300000,confirmed:true,offerId:'123'});x.c.mod='guildMarket';x.c.goldOffers=()=>[];assert.equal(x.c.goldTick(),true);assert.equal(x.tx.stage,'verifyBuy');assert.equal(x.tx.manualReview,undefined);});
test('si oferta sigue visible actualiza mercado con intervalo sin volver a comprar',()=>{const x=fixture();Object.assign(x.tx,{stage:'buy',at:Date.now()-11000,baselineEmpty:true,confirmed:true,offerId:'123',offerHash:'h',price:300000,seller:'Otro'});x.c.mod='guildMarket';x.c.goldOffers=()=>[{price:300000,seller:'Otro',item:x.tx.item,button:{closest:()=>({querySelector:()=>({getAttribute:k=>k==='data-item-id'?'123':'h'})})}}];let navigations=0;x.c.goldNav=()=>{navigations++;return true;};assert.equal(x.c.goldTick(),true);assert.equal(x.tx.stage,'buy');assert.equal(navigations,1);assert.equal(x.c.goldTick(),false);assert.equal(navigations,1);});
test('paquete único tras línea base vacía permite traslado automático',()=>{const x=fixture();Object.assign(x.tx,{stage:'verifyBuy',baselineEmpty:true,confirmed:true,offerId:'123'});let moved=0;const pkg=x.c.document.querySelector('#packages');const el=pkg.querySelectorAll()[0];el.dispatchEvent=()=>{moved++;};x.c.document.querySelector=s=>s==='#packages'?{...pkg,querySelectorAll:()=>[el]}:null;x.c.MouseEvent=function(){};x.c.window={};assert.equal(x.c.goldTick(),true);assert.equal(x.tx.stage,'transfer');assert.equal(moved,1);});
test('paquete ausente o duplicado aplaza comprobación sin repetir compra',()=>{for(const names of [['Trapos'],['Ojo de Ra','Ojo de Ra']]){const x=fixture({names});Object.assign(x.tx,{stage:'verifyBuy',baselineEmpty:true,confirmed:true,offerId:'123'});assert.equal(x.c.goldTick(),false);assert.equal(x.tx.stage,'verifyBuy');assert.equal(x.tx.blocked,true);assert.equal(x.tx.manualReview,undefined);}});
test('paginación ambigua durante verificación aplaza sin exigir confirmación',()=>{const x=fixture({page:'20&page=1'});Object.assign(x.tx,{stage:'verifyBuy',baselineEmpty:true,confirmed:true,offerId:'123'});assert.equal(x.c.goldTick(),false);assert.equal(x.tx.stage,'verifyBuy');assert.equal(x.tx.blocked,true);assert.equal(x.tx.manualReview,undefined);});
test('no comprueba por paquetes sin línea base previa ni confirmación de compra',()=>{for(const changes of [{baselineEmpty:false,confirmed:true},{baselineEmpty:true,confirmed:false},{baselineEmpty:true,confirmed:true,rejected:true}]){const x=fixture();Object.assign(x.tx,{stage:'buy',at:Date.now()-6000,price:300000,offerId:'123'},changes);x.c.mod='guildMarket';x.c.goldOffers=()=>[];assert.equal(x.c.goldTick(),false);assert.equal(x.tx.stage,'buy');}});
test('actualizacion exige revisión de operación anterior',()=>{const x=fixture();delete x.state.goldSafetyV1219;assert.equal(x.c.goldTick(),false);assert.equal(x.tx.manualReview,true);assert.equal(x.state.goldEnabled,false);});
test('revisión repetida reinicia recorrido ambiguo',()=>{const x=fixture();x.tx.blocked=true;x.tx.retryAt=0;x.tx.packageScan={pages:[1,2],matches:[{hash:'a',page:1}],complete:false};assert.equal(x.c.goldTick(),true);assert.equal(x.tx.packageScan,undefined);});
test('venta antigua no se confirma automáticamente',()=>{const x=fixture();x.c.mod='guildMarket';x.tx.stage='sell';x.tx.price=300000;x.tx.ownBefore=0;x.c.goldOwnCount=()=>1;assert.equal(x.c.goldTick(),false);assert.equal(x.state.goldTx,x.tx);assert.equal(x.tx.manualReview,true);});
test('anuncios de duración restante corta cuentan en referencia',()=>{const x=fixture();const row={cells:[{querySelector:()=>({})},{textContent:'CassiusFerox'},{textContent:'300000'},{textContent:'12:30 h'}],querySelector:()=>({})};x.c.document.querySelectorAll=()=>[row];x.c.parseGold=Number;x.c.goldItem=()=>x.tx.item;assert.equal(x.c.goldOwnCount(x.tx.item,300000),1);});


test('busca en la segunda página y completa referencia previa vacía',()=>{
 const x=fixture({names:['Otro'],next:true});x.tx.stage='baseline';
 assert.equal(x.c.goldTick(),true);assert.equal(x.tx.packageScan.pages.length,1);
 x.c.params=new URLSearchParams('f=0&fq=-1&qry=Ojo+de+Ra&page=2');x.c.location.href=x.location.destination;
 x.c.document.querySelector=s=>s==='#packages'?{querySelectorAll:()=>[],textContent:''}:null;
 x.tx.loadedAt=Date.now()-6000;
 assert.equal(x.c.goldTick(),true);assert.equal(x.tx.stage,'readyBuy');assert.equal(x.tx.baselineEmpty,true);
});
test('búsqueda previa sin compra no excluye un objeto para siempre',()=>{
 const x=fixture();x.tx.stage='baseline';x.tx.manualReview=true;x.tx.reviewAt=Date.now()-1;
 assert.equal(x.c.goldTick(),false);assert.equal(x.state.goldTx,null);assert.equal(x.state.goldUnresolved.length,0);
});
