import test from 'node:test';
import assert from 'node:assert/strict';
import { smeltingCandidate, crystalRecipeEstimate, parseSmeltingEquipment } from '../src/lib/smelting-policy.mjs';

const item = { name: 'Espada Gaius de la fuerza', source: 'dungeon', reserved: false, basisType: 1, quality: 'blue' };
test('prioridad cristal reconoce prefijo completo, no coincidencia parcial', () => {
  assert.equal(smeltingCandidate(item, 'crystal'), true);
  assert.equal(smeltingCandidate({...item, name: 'Supergaius espada'}, 'crystal'), false);
  assert.equal(smeltingCandidate(item, 'stamina'), false);
});
test('protege origen ambiguo, reservas, bienes de forja y calidad superior', () => {
  for (const change of [{source:'market'}, {reserved:true}, {basisType:12}, {quality:'purple'}, {quality:'orange'}, {quality:'red'}]) {
    assert.equal(smeltingCandidate({...item,...change}, 'green-blue'), false);
  }
  assert.equal(smeltingCandidate(item, 'green-blue'), true);
});
test('receta de cristal permite ordenar candidatos sin prometer el resultado', () => {
  assert.equal(crystalRecipeEstimate(item), 31);
  assert.equal(crystalRecipeEstimate({...item, name:'Armadura Manius del triunfo'}), 42);
  assert.equal(crystalRecipeEstimate({...item, reserved:true}), 0);
  assert.equal(smeltingCandidate({...item, name:'Espada amplia Ichorus de las Artes Marciales'}, 'stamina'), true);
});
test('identifica equipo azul real y rechaza bienes de forja y calidades contradictorias', () => {
  const el = (attrs, classes) => ({getAttribute: key => attrs[key] ?? null, classList:{contains: c => classes.includes(c)}});
  const attrs = {'data-basis':'1-5','data-quality':'1','data-tooltip':JSON.stringify([[['Espada amplia Ichorus de las Artes Marciales','blue']]])};
  assert.equal(parseSmeltingEquipment(el(attrs,['item-i-blue']), 'dungeon')?.name, 'Espada amplia Ichorus de las Artes Marciales');
  assert.equal(parseSmeltingEquipment(el({...attrs,'data-basis':'18-41'},['item-i-blue']), 'dungeon'), null);
  assert.equal(parseSmeltingEquipment(el({...attrs,'data-quality':'2'},['item-i-purple']), 'dungeon'), null);
  assert.equal(parseSmeltingEquipment(el(attrs,['item-i-blue','item-i-purple']), 'dungeon'), null);
  assert.equal(parseSmeltingEquipment(el(attrs,['item-i-blue']), 'market'), null);
  assert.equal(parseSmeltingEquipment(el({...attrs,'data-basis':'7-4','data-quality':null},['item-i-green']), 'dungeon'), null);
  assert.equal(parseSmeltingEquipment(el({...attrs,'data-basis':'9-9','data-quality':null},['item-i-green']), 'dungeon')?.quality, 'green');
});
