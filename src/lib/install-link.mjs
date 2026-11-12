import { MODULE_KEYS } from './build-config.mjs';

export function configToSearch(input) {
  const params = new URLSearchParams({ v: '1', level: String(input.playerLevel), region: input.campaignRegion, modules: MODULE_KEYS.filter(key => input.modules[key]).join(',') });
  if (input.modules.expedition) { params.set('area', input.expeditionAreaId); params.set('enemy', input.expeditionEnemyId); }
  if (input.modules.dungeon) { params.set('dungeon', input.dungeonId); if (input.dungeonLossLimit != null) params.set('losses', String(input.dungeonLossLimit)); }
  if (input.modules.smelting) params.set('smelting', input.smeltingPriority || 'crystal');
  return params;
}

export function searchToConfig(params) {
  if (params.get('v') !== '1') throw new TypeError('Versión de enlace no reconocida.');
  const keys = (params.get('modules') || '').split(',').filter(Boolean);
  if (keys.some(key => !MODULE_KEYS.includes(key)) || new Set(keys).size !== keys.length) throw new TypeError('Módulos no válidos.');
  return { playerLevel: params.get('level'), campaignRegion: params.get('region'), modules: Object.fromEntries(MODULE_KEYS.map(key => [key, keys.includes(key)])), expeditionAreaId: params.get('area'), expeditionEnemyId: params.get('enemy'), dungeonId: params.get('dungeon'), dungeonLossLimit: params.has('losses') ? params.get('losses') : undefined, smeltingPriority: params.get('smelting') || 'crystal' };
}
