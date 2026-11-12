import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
const source=await readFile(new URL('../src/bot/30-guild-market.js',import.meta.url),'utf8');
const code=source.slice(source.indexOf('  // Fundición:'));
function setup(tx, extra={}) {
  const state={smeltTx:tx}, calls=[];
  const slots=Array.from({length:6},(_,i)=>({classList:{contains:s=>s==='tabActive'?i===2:s==='forge_crafting'?i===2:false}}));
  const document={querySelectorAll:s=>s==='#forge_nav > div'?slots:[],querySelector:s=>s==='#inv'?{}:s==='#inventory_nav a.current'?{getAttribute:()=> '513'}:null};
  const c={state,document,BUILD_CONFIG:{modules:{smelting:true},smeltingPriority:'crystal'},Date,Number,String,URL,location:{href:'https://s64-es.gladiatus.gameforge.com/game/index.php',origin:'https://s64-es.gladiatus.gameforge.com'},mod:'forge',sub:'smeltery',visible:()=>true,inventoryItemByHash:()=>null,log:(...a)=>calls.push(a),save:()=>{},validItemHash:x=>!!x,...extra};
  vm.createContext(c);vm.runInContext(code,c);return {c,state,calls};
}
const item=(quality,classes,type='5',name='Guantes Servius')=>({classList:{contains:c=>classes.includes(c)},getAttribute:k=>({'data-basis':type+'-7','data-quality':quality,'data-hash':'opaque','data-measurement-x':'2','data-measurement-y':'2','data-tooltip':JSON.stringify([[[name,'blue']]])}[k]??null),parentElement:{parentElement:{textContent:'Expedición'}}});
test('selección real protege calidades superiores, comida y materiales',()=>{
 const {c}=setup(null);assert.ok(c.smeltItem(item('1',['item-i-blue'])));for(const x of [item('2',['item-i-purple']),item('3',['item-i-orange']),...['7','11','12','13','14','15','18','19','20','21'].map(type=>item('1',['item-i-blue'],type)),item('1',['item-i-blue','item-i-purple'])]) assert.equal(c.smeltItem(x),null);
});
test('confirma fundición solo con hueco en marcha y baúl correcto',()=>{
 const {c,state}=setup({stage:'rent',slot:2,hash:'opaque',name:'Guantes',at:Date.now(),actionAt:Date.now()}); assert.equal(c.smeltingTick(),true);assert.equal(state.smeltTx,null);assert.ok(state.smeltNextAt>Date.now());
 const x=setup({stage:'rent',slot:2,hash:'opaque',name:'Guantes',at:Date.now(),actionAt:Date.now()-21000},{inventoryItemByHash:()=>({})});x.c.smeltingTick();assert.equal(x.state.smeltTx.blocked,true);
});
test('operación ya bloqueada no se repite',()=>{const {c,state}=setup({stage:'rent',blocked:true,at:Date.now()});assert.equal(c.smeltingTick(),false);assert.equal(state.smeltTx.blocked,true);});

test('configuración conserva prioridad de fundición en enlace y compilación', async () => {
  const {normalizeBuildConfig}=await import('../src/lib/build-config.mjs');
  const {configToSearch,searchToConfig}=await import('../src/lib/install-link.mjs');
  const catalog=JSON.parse(await readFile(new URL('../src/data/catalog.json',import.meta.url),'utf8'));
  const input={playerLevel:99,campaignRegion:'África',modules:{smelting:true},smeltingPriority:'crystal'};
  const roundtrip=searchToConfig(configToSearch(input));
  assert.equal(normalizeBuildConfig(roundtrip,catalog).smeltingPriority,'crystal');
  assert.equal(normalizeBuildConfig(roundtrip,catalog).modules.smelting,true);
  assert.throws(()=>normalizeBuildConfig({...input,smeltingPriority:'bad'},catalog),/Prioridad/);
});
test('no pulsa oro sin verificar vista previa, saldo y objeto',()=>{
  const tx={stage:'place',slot:2,hash:'opaque',name:'Guantes Servius',basis:'5-7',quality:'blue',at:Date.now(),dragAt:Date.now()};
  let clicks=0;
  const selected={classList:{contains:s=>s==='current'},getAttribute:k=>k==='data-available'?'true':'513'};
  const displayed={getAttribute:()=> 'opaque'};
  const target={querySelector:()=>displayed};
  const rent={querySelector:s=>s==='.icon_gold'?{}:null,textContent:'2451',click:()=>clicks++};
  const slots=Array.from({length:6},(_,i)=>({classList:{contains:s=>s==='tabActive'||s==='forge_closed'?i===2:false}}));
  const document={querySelectorAll:s=>s==='#forge_nav > div'?slots:[],querySelector:s=>s.includes('data-bag-number')?selected:s==='#inv'?{}:s==='#slot-closed #itembox'?target:s==='#slot-closed [data-rent="2"]'?rent:s==='#forge_item_name'?{textContent:'Guantes Servius'}:null};
  const x=setup(tx,{document,parseGold:()=>2451,goldBalance:()=>100000,inventoryItemByHash:()=>null});
  x.c.smeltingTick();assert.equal(clicks,0);assert.equal(x.state.smeltTx.stage,'place');
});

test('ciclo simulado confirma recogida, traslado, arrastre y pago una sola vez',()=>{
  let now=1000000, page='forge', stage='finished', inventory=[], packageItems=[], boxItem=null, clicks=[];
  const itemEl=item('1',['item-i-blue'],'5','Guantes Servius');
  itemEl.hasAttribute=()=>true;itemEl.dispatchEvent=()=>clicks.push('transfer');
  const slots=Array.from({length:6},(_,i)=>({classList:{contains:s=>s==='tabActive'?i===2:s==='forge_finished-succeeded'?i===2&&stage==='finished':s==='forge_closed'?i===2&&stage==='closed':s==='forge_crafting'?i===2&&stage==='crafting':false},click:()=>{}}));
  const bag={classList:{contains:()=>true},getAttribute:()=> 'true'};
  const inv={getBoundingClientRect:()=>({width:256,height:160}),querySelectorAll:()=>inventory};
  const packages={querySelectorAll:s=>s.includes('data-tooltip')?packageItems:packageItems};
  const saveButton={textContent:'Guardar recursos',click:()=>clicks.push('save')};
  const target={querySelector:s=>boxItem};
  const rent={textContent:'2451',querySelector:s=>s==='.icon_gold'?{}:null,click:()=>clicks.push('rent')};
  const doc={querySelectorAll:s=>s==='#forge_nav > div'?slots:[],querySelector:s=>({'#slot-finished-succeeded #forge_horreum':saveButton,'#inventory_nav a[data-bag-number="513"]':bag,'#inv':inv,'#packages':packages,'#slot-closed #itembox':target,'#slot-closed [data-rent="2"]':rent,'#forge_item_name':{textContent:'Guantes Servius'},'#inventory_nav a.current':{getAttribute:()=> '513'}}[s]||null)};
  const clock=class extends Date {static now(){return now;}};
  const {c,state}=setup({stage:'forge',at:now},{document:doc,Date:clock,params:new URLSearchParams('f=0&fq=-1&qry=Servius'),parseGold:()=>2451,goldBalance:()=>120000,goldSpace:()=>true,dragFood:()=>{clicks.push('drag');return true;},inventoryItemByHash:()=>inventory[0]||null,MouseEvent:class {},window:{}});
  c.smeltingTick();assert.deepEqual(clicks,['save']);assert.equal(state.smeltTx.stage,'save');
  stage='closed';c.smeltingTick();c.smeltingTick();assert.equal(state.smeltTx.stage,'packages');
  state.smeltTx.stage='search';state.smeltTx.query='Servius';state.smeltTx.at=now-6000;c.mod='packages';c.sub=null;packageItems=[itemEl];c.smeltingTick();assert.deepEqual(clicks,['save','transfer']);
  inventory=[itemEl];packageItems=[];c.smeltingTick();assert.equal(state.smeltTx.stage,'place');
  c.mod='forge';c.sub='smeltery';c.smeltingTick();assert.deepEqual(clicks,['save','transfer','drag']);
  boxItem=itemEl;c.smeltingTick();assert.deepEqual(clicks,['save','transfer','drag','rent']);assert.equal(state.smeltTx.stage,'rent');
  stage='crafting';inventory=[];c.smeltingTick();assert.equal(state.smeltTx,null);
});


test('revisa páginas consecutivas sin seguir rutas externas',()=>{
 let destination='';const now=Date.now();const bag={classList:{contains:()=>true},getAttribute:()=> 'true'};const inv={querySelectorAll:()=>[],getBoundingClientRect:()=>({width:256,height:160})};const packages={querySelectorAll:()=>[]};
 const next={getAttribute:()=>'/game/index.php?mod=packages&f=0&fq=-1&qry=Servius&page=3'};
 const document={querySelectorAll:()=>[],querySelector:s=>s.includes('data-bag-number')?bag:s==='#inv'?inv:s==='#packages'?packages:s==='.paging_right_step'?next:null};
 const x=setup({stage:'search',query:'Servius',at:now-6000},{mod:'packages',sub:null,document,params:new URLSearchParams('f=0&fq=-1&qry=Servius&page=1'),location:{origin:'https://s64-es.gladiatus.gameforge.com',href:'https://s64-es.gladiatus.gameforge.com/game/index.php?mod=packages',assign:u=>destination=u}});
 x.c.smeltingTick();assert.equal(new URL(destination).searchParams.get('page'),'2');assert.equal(x.state.smeltTx.stage,'search');
});

test('excepción del módulo bloquea fundición sin romper la cola',()=>{
 const {c,state}=setup({stage:'place',slot:2,at:Date.now()},{document:{querySelectorAll:()=>{throw Error('DOM')}}});
 assert.equal(c.safeSmeltingTick(),false);assert.equal(state.smeltTx.blocked,true);assert.match(state.smeltTx.problem,/Error interno/);
});
test('búsqueda antigua se reanuda solo en la página correspondiente',()=>{
 const now=Date.now(),tx={stage:'search',query:'Servius',at:now-100000};
 const {c,state}=setup(tx,{mod:'packages',params:new URLSearchParams('f=0&fq=-1&qry=Otro'),document:{querySelector:()=>null,querySelectorAll:()=>[]}});
 assert.equal(c.smeltingTick(),false);assert.equal(state.smeltTx.blocked,true);
});
