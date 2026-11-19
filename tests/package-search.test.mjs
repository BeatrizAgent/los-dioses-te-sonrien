import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../src/bot/30-guild-market.js',import.meta.url),'utf8');
const code=source.slice(0,source.indexOf('  // Fundición:'));
function fixture({page='1',names=['Ojo de Ra'],scan, next=false}={}) {
 const now=Date.now(), item={name:'Ojo de Ra',owner:null,soul:null,basis:'8-1',width:1,height:1}, tx={stage:'packages',at:now,loadedAt:now-6000,item,packageScan:scan,packageFilter:{query:'Ojo de Ra',type:'0',optimized:false}};
 const elements=names.map((name,i)=>({getAttribute:k=>({'data-tooltip':JSON.stringify([[[name,'white']]]),'data-hash':'hash'+i}[k]??null),closest:()=>({textContent:'Mercado'}),hasAttribute:()=>true,dispatchEvent(){throw Error('No debe mover objetos en esta prueba');}}));
 const pkg={querySelectorAll:()=>elements,textContent:''};
 const state={goldTx:tx,goldEnabled:true,goldPackageGuardV129:true,goldSafetyV1219:true}; const params=new URLSearchParams('f=0&fq=-1&qry=Ojo+de+Ra'+(page?'&page='+page:''));
 const location={origin:'https://s64-es.gladiatus.gameforge.com',href:'https://s64-es.gladiatus.gameforge.com/game/index.php?mod=packages&f=0&fq=-1&qry=Ojo+de+Ra'+(page?'&page='+page:''),assign:u=>{location.destination=u;}};
 const c={state,params,location,mod:'packages',Date,URL,Number,String,Array,JSON,document:{querySelector:s=>s==='#packages'?pkg:s==='.paging_right_step'&&next?{}:null},visible:x=>!!x,log:()=>{},save:()=>{},parseGold:()=>500000,validItemHash:x=>typeof x==='string'&&!!x,accountName:'CassiusFerox'};
 vm.createContext(c);vm.runInContext(code,c);c.goldBalance=()=>500000;c.goldBag=()=>({items:[]});c.goldSpace=()=>true;c.goldItem=el=>({ ...item,name:JSON.parse(el.getAttribute('data-tooltip'))[0][0][0] });return {c,state,tx,location};
}
test('prioriza coincidencia reciente y no visita páginas antiguas',()=>{const x=fixture({names:['Ojo de Ra','Trapos'],next:true});let moved=0;const el=x.c.document.querySelector('#packages').querySelectorAll()[0];el.dispatchEvent=()=>moved++;x.c.MouseEvent=function(){};x.c.window={};assert.equal(x.c.goldTick(),true);assert.equal(x.tx.stage,'transfer');assert.equal(moved,1);assert.equal(x.location.destination,undefined);});
test('bloquea pagina duplicada sin seguir navegando',()=>{const x=fixture({page:'20&page=1'});assert.equal(x.c.goldTick(),false);assert.equal(x.tx.manualReview,true);assert.equal(x.location.destination,undefined);});
test('bloquea paginas con contenido identico aunque cambie el numero',()=>{const x=fixture({page:'2',scan:{pages:[1],matches:[],complete:false,fingerprints:{1:'hash0'}}});assert.equal(x.c.goldTick(),false);assert.match(x.tx.problem,/repetido/);});
test('mantiene el bloqueo manual y no reintenta la compra',()=>{const x=fixture();x.tx.blocked=true;x.tx.manualReview=true;x.tx.retryAt=0;assert.equal(x.c.goldTick(),false);assert.equal(x.tx.blocked,true);});
test('continúa a la segunda página si no encuentra coincidencia reciente',()=>{const x=fixture({names:['Otro'],next:true});assert.equal(x.c.goldTick(),true);assert.equal(new URL(x.location.destination).searchParams.get('page'),'2');assert.equal(x.tx.blocked,undefined);});

test('una transaccion de versiones anteriores requiere revision manual',()=>{const x=fixture();delete x.state.goldPackageGuardV129;assert.equal(x.c.goldTick(),false);assert.equal(x.tx.manualReview,true);assert.match(x.tx.problem,/versión anterior/);});
test('el módulo inicia automáticamente aunque el interruptor antiguo estuviera apagado',()=>{const x=fixture();x.state.goldTx=null;x.state.goldEnabled=false;x.c.mod='overview';x.c.document.querySelector=()=>({});let calls=0;x.c.goldNav=()=>{calls++;return true;};assert.equal(x.c.goldTick(),true);assert.equal(calls,1);});
test('la revisión pendiente sigue impidiendo iniciar otra compra automáticamente',()=>{const x=fixture();x.state.goldTx=null;x.state.goldEnabled=false;x.state.goldPreviousReview=true;x.c.mod='overview';let calls=0;x.c.goldNav=()=>{calls++;return true;};assert.equal(x.c.goldTick(),false);assert.equal(calls,0);});


test('elige término completo y tipo de equipo para reducir resultados',()=>{const x=fixture();const p=x.c.packageSearchPlan({name:'Botas de Placas Lulus de los Campos Elíseos',basis:'8-10'});assert.equal(p.query,'Elíseos');assert.equal(p.type,'8');assert.equal(p.optimized,true);});
test('tipos no comprobados usan Todo sin inventar categoría',()=>{const x=fixture();const p=x.c.packageSearchPlan({name:'Ojo de Ra',basis:'18-1'});assert.equal(p.query,'Ojo de Ra');assert.equal(p.type,'0');});
test('sin coincidencia en filtro preciso intenta búsqueda amplia antes de detenerse',()=>{const x=fixture({names:['Trapos']});x.tx.packageFilter={query:'Ojo',type:'8',optimized:true};x.c.params=new URLSearchParams('f=8&fq=-1&qry=Ojo&page=1');x.c.location.href='https://s64-es.gladiatus.gameforge.com/game/index.php?mod=packages&f=8&fq=-1&qry=Ojo&page=1';assert.equal(x.c.goldTick(),true);assert.equal(x.tx.packageFilter.query,'Ojo de Ra');assert.equal(x.tx.packageFilter.type,'0');assert.equal(x.tx.manualReview,undefined);});

test('operación de oro incierta se archiva automáticamente y no se atribuye éxito',()=>{const x=fixture();x.tx.blocked=true;x.tx.manualReview=true;x.tx.reviewAt=Date.now()-1;assert.equal(x.c.goldTick(),false);assert.equal(x.state.goldTx,null);assert.equal(x.state.goldUnresolved.length,1);assert.equal(x.state.goldUnresolved[0].item.name,'Ojo de Ra');});
test('operación aplazada repetidamente se archiva tras el plazo',()=>{const x=fixture();x.tx.blocked=true;x.tx.unresolvedSince=Date.now()-121000;x.tx.retryAt=Date.now()+30000;assert.equal(x.c.goldTick(),false);assert.equal(x.state.goldTx,null);assert.equal(x.state.goldUnresolved.length,1);});


test('busca en la segunda página y completa referencia previa vacía',()=>{
 const x=fixture({names:['Otro'],next:true});x.tx.stage='baseline';
 assert.equal(x.c.goldTick(),true);assert.equal(x.tx.packageScan.pages.length,1);
 x.c.params=new URLSearchParams('f=0&fq=-1&qry=Ojo+de+Ra&page=2');x.c.location.href=x.location.destination;
 x.c.document.querySelector=s=>s==='#packages'?{querySelectorAll:()=>[],textContent:''}:null;
 x.tx.loadedAt=Date.now()-6000;
 assert.equal(x.c.goldTick(),true);assert.equal(x.tx.stage,'readyBuy');assert.equal(x.tx.baselineEmpty,true);
});
test('no visita página tres y referencia solo dos páginas recientes',()=>{const x=fixture({page:'2',names:['Otro'],next:true,scan:{pages:[1],matches:[],complete:false,fingerprints:{}}});x.tx.stage='baseline';assert.equal(x.c.goldTick(),true);assert.equal(x.location.destination,undefined);assert.equal(x.tx.stage,'readyBuy');assert.equal(x.tx.baselineScope,'recent-two-pages');assert.equal(x.tx.baselineTruncated,true);});
test('no confirma compra incierta solo por paquete con referencia truncada',()=>{const x=fixture();Object.assign(x.tx,{stage:'verifyBuy',baselineEmpty:true,baselineTruncated:true});assert.equal(x.c.goldTick(),false);assert.equal(x.tx.stage,'verifyBuy');assert.equal(x.tx.blocked,true);assert.match(x.tx.problem,/referencia previa/);});
test('revisión antigua situada más allá de página dos vuelve al inicio',()=>{const x=fixture({page:'3',names:['Otro'],scan:{pages:[1,2],matches:[],complete:false,fingerprints:{}}});assert.equal(x.c.goldTick(),true);assert.equal(new URL(x.location.destination).searchParams.get('page'),'1');assert.equal(x.tx.packageScan.pages.length,0);});
test('coincidencias recientes idénticas bloquean traslado ambiguo',()=>{const x=fixture({names:['Ojo de Ra','Ojo de Ra'],next:true});assert.equal(x.c.goldTick(),false);assert.equal(x.tx.blocked,true);assert.equal(x.location.destination,undefined);});
test('búsqueda previa sin compra no excluye un objeto para siempre',()=>{
 const x=fixture();x.tx.stage='baseline';x.tx.manualReview=true;x.tx.reviewAt=Date.now()-1;
 assert.equal(x.c.goldTick(),false);assert.equal(x.state.goldTx,null);assert.equal(x.state.goldUnresolved.length,0);
});


test('operación con progreso no se archiva por un bloqueo antiguo',()=>{
 const x=fixture({names:['Otro']});x.tx.unresolvedSince=Date.now()-121000;x.tx.at=Date.now()-1000;
 x.c.goldTick();assert.ok(x.state.goldTx);assert.equal(x.state.goldUnresolved,undefined);
});
test('oferta descartada por paquete existente se salta durante cinco minutos',()=>{
 const x=fixture();Object.assign(x.tx,{stage:'baseline',offerId:'123',offerHash:'offer123'});
 assert.equal(x.c.goldTick(),false);assert.equal(x.state.goldTx,null);assert.equal(x.state.goldSkippedOffers[0].id,'123');assert.ok(x.state.goldSkippedOffers[0].until>Date.now());
});
test('espera carga de siguiente página sin repetir navegación',()=>{
 const x=fixture({names:['Otro'],next:true});let visits=0;x.c.location.assign=()=>visits++;
 assert.equal(x.c.goldTick(),true);assert.equal(visits,1);x.tx.loadedAt=Date.now()-6000;
 assert.equal(x.c.goldTick(),true);assert.equal(visits,1);
});


test('oro pendiente continúa aunque una búsqueda de alimento espere su turno',()=>{
 const x=fixture({names:['Otro']});x.state.foodBuyTx={stage:'baseline',retryAt:Date.now()-1};
 assert.equal(x.c.goldTick(true),false);assert.ok(x.state.goldTx);assert.equal(x.tx.blocked,true);
});


test('una navegación de lectura sin respuesta permite reintento posterior',()=>{
 const x=fixture({names:['Otro'],next:true});let visits=0;x.c.location.assign=()=>visits++;
 x.c.goldTick();x.tx.loadedAt=Date.now()-6000;x.tx.readNav.at-=11000;
 assert.equal(x.c.goldTick(),true);assert.equal(x.tx.blocked,true);assert.equal(x.tx.readNav,undefined);assert.equal(visits,1);
});


test('releer la misma página tras un error no reinicia plazo de aislamiento',()=>{
 const x=fixture({names:['Ojo de Ra','Ojo de Ra']});x.tx.readProgress={key:'packages:packages:0:Ojo de Ra',page:1};x.tx.unresolvedSince=Date.now()-30000;
 assert.equal(x.c.goldTick(),false);assert.equal(x.tx.blocked,true);assert.ok(x.tx.unresolvedSince<=Date.now()-30000);
});

test('una coincidencia reciente descarta la compra sin recorrer páginas antiguas',()=>{const x=fixture({next:true});x.tx.stage='baseline';assert.equal(x.c.goldTick(),false);assert.equal(x.state.goldTx,null);assert.equal(x.location.destination,undefined);});
