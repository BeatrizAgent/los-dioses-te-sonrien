import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const src=await readFile(new URL('../src/bot/30-guild-market.js',import.meta.url),'utf8');
const code=src.slice(src.indexOf('  function goldBag('),src.indexOf('  // Las dimensiones'));
test('cambio a baúl I espera carga y no se trata como falta de espacio',()=>{
 let now=10000,selected=false,clicks=0,saves=0;const state={};
 const bag={classList:{contains:()=>selected},getAttribute:k=>({'data-available':'true','data-bag-number':'512'}[k]||null),click(){clicks++;selected=true;}};
 const inv={querySelectorAll:()=>[]};const ctx={state,document:{querySelector:s=>s==='#inv'?inv:bag},visible:()=>true,Date:{now:()=>now},save:()=>saves++,goldSpace:()=>true,validItemHash:()=>true,Number};
 vm.createContext(ctx);vm.runInContext(code,ctx);assert.equal(ctx.goldBag(),null);assert.equal(clicks,1);assert.equal(state.goldBagSwitchAt,10000);now+=4000;assert.equal(ctx.goldBag(),null);assert.equal(clicks,1);now+=1000;assert.ok(ctx.goldBag());assert.equal(state.goldBagSwitchAt,undefined);assert.equal(saves,2);
});

