import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const src=readFileSync(new URL('../src/bot/60-panel.js',import.meta.url),'utf8');

test('panel minimizado omite contenido y al abrirlo actualiza una vez',()=>{
  const status=src.slice(src.indexOf('  function renderStatus()'),src.indexOf("  $('.toggle').onclick"));
  const min=src.slice(src.indexOf("  $('.min').onclick"),src.indexOf("  root.querySelectorAll('.tab').forEach(button"));
  const uiState={minimized:true},nodes={},shell={classList:{toggle:()=>false}};
  let renders=0;
  const element=selector=>nodes[selector]??=(selector==='.shell'?shell:{textContent:'',classList:{toggle(){}},setAttribute(){}});
  const context={uiState,state:{running:true},mod:'overview',verified:()=>true,$:element,renderContent:()=>renders++,saveUI:()=>{}};
  vm.createContext(context);vm.runInContext(status+min,context);
  context.renderStatus();assert.equal(renders,0);
  nodes['.min'].onclick();assert.equal(uiState.minimized,false);assert.equal(renders,1);
  context.renderStatus();assert.equal(renders,2);
});
