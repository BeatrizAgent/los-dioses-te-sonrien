import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const source = readFileSync(new URL('../src/bot/60-panel.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');

test('guarda lista de rivales solo al cambiar o tras reiniciar', () => {
  const code = source.slice(source.indexOf('  let capturedRivalsSignature'), source.indexOf('  function rivals()'));
  let items = [{name:'Rival', rivalLevel:10}], writes = 0;
  const context = {state:{}, liveRivals:()=>items, save:()=>writes++, Date, JSON};
  vm.createContext(context);
  vm.runInContext(code, context);
  context.captureRivals();
  const first = context.state.rivalSnapshot;
  context.captureRivals();
  assert.equal(writes, 1);
  assert.equal(context.state.rivalSnapshot, first);
  items = [{name:'Otro', rivalLevel:10}];
  context.captureRivals();
  assert.equal(writes, 2);
  context.state.rivalSnapshot = null;
  context.captureRivals();
  assert.equal(writes, 3);
});

test('pestaña oculta conserva ciclo de juego y refresca panel al volver', () => {
  const code = source.slice(source.indexOf("  document.addEventListener('visibilitychange'"), source.lastIndexOf('  }\n})();'));
  let tick = 0, renders = 0, onVisibility, interval;
  const document = {visibilityState:'hidden', addEventListener:(_event, fn)=>{onVisibility=fn;}};
  const context = {document, ownerActive:true, combatTick:()=>tick++, renderStatus:()=>renders++, captureRivals:()=>{}, setTimeout:()=>{}, setInterval:fn=>{interval=fn;}};
  vm.runInNewContext(code, context);
  interval();
  assert.equal(tick, 1);
  assert.equal(renders, 1);
  document.visibilityState='visible';
  onVisibility();
  assert.equal(tick, 2);
  assert.equal(renders, 2);
  interval();
  assert.equal(renders, 2);
  interval();
  assert.equal(renders, 3);
});

test('cambios de historial actualizan estadísticas sin serializar registros', () => {
  const line = source.split(/\r?\n/).find(value => value.includes("const data = tabName === 'overview'"));
  const code = line.replace('const data =', 'data =');
  const state = {records:[], statsEvents:[], statsStartedAt:1, rivalSnapshot:null};
  const context = {state, tabName:'stats', mod:'arena', document:{querySelector:()=>null}, data:null};
  vm.createContext(context);
  const signature = () => { vm.runInContext(code, context); return JSON.stringify(context.data); };
  const before = signature();
  state.records.push({toJSON(){ throw new Error('no serializar historial'); }});
  const afterFight = signature();
  assert.notEqual(afterFight, before);
  context.tabName = 'rivals';
  assert.doesNotThrow(signature);
  context.tabName = 'stats';
  state.statsEvents.push({toJSON(){ throw new Error('no serializar eventos'); }});
  assert.notEqual(signature(), afterFight);
});

test('no vuelve a guardar un mensaje de espera idéntico', () => {
  const core=readFileSync(new URL('../src/bot/10-core-and-missions.js',import.meta.url),'utf8');
  const code=core.slice(core.indexOf('  function updateMessage('),core.indexOf('  function verified()'));
  let writes=0;const state={message:'Esperando'};const context={state,save:()=>writes++};
  vm.runInNewContext(code,context);context.updateMessage('Esperando');context.updateMessage('Listo');context.updateMessage('Listo');
  assert.equal(writes,1);assert.equal(state.message,'Listo');
});

test('resumen no lee contenido entero fuera del Panteón', () => {
  const line=source.split(/\r?\n/).find(value=>value.includes("const data = tabName === 'overview'"));
  const state={records:[],statsEvents:[]};const context={state,tabName:'overview',mod:'arena',document:{querySelector:s=>{if(s==='#content')throw Error('lectura innecesaria');return null;}},data:null};
  vm.runInNewContext(line.replace('const data =','data ='),context);
  assert.ok(context.data);
});


test('planificador revisa cada 1,5 segundos y panel cada 4,5',()=>{
 const code=source.slice(source.indexOf("  document.addEventListener('visibilitychange'"),source.lastIndexOf('  }\n})();'));
 let interval,delay,renders=0,ticks=0;
 const context={document:{visibilityState:'visible',addEventListener(){}},ownerActive:true,combatTick:()=>ticks++,renderStatus:()=>renders++,captureRivals(){},setTimeout(){},setInterval:(fn,ms)=>{interval=fn;delay=ms;}};
 vm.runInNewContext(code,context);assert.equal(delay,1500);interval();assert.equal(ticks,1);assert.equal(renders,1);interval();assert.equal(ticks,2);assert.equal(renders,1);interval();assert.equal(ticks,3);assert.equal(renders,2);
});

test('navegación espera tres segundos antes de otro clic',()=>{
 const core=readFileSync(new URL('../src/bot/10-core-and-missions.js',import.meta.url),'utf8');
 const code=core.slice(core.indexOf('  function navigation('),core.indexOf('  function renewIdentity('));let now=8000,clicks=0;
 const context={state:{lastNavigationAt:6000},Date:{now:()=>now},visible:()=>true,captcha:()=>false,verified:()=>true,save(){},link:{click:()=>clicks++}};
 vm.createContext(context);vm.runInContext(code,context);assert.equal(context.navigation(context.link,'Prueba'),false);now=9000;assert.equal(context.navigation(context.link,'Prueba'),true);assert.equal(clicks,1);
});
