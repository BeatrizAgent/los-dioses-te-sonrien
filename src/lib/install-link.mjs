import { MODULE_KEYS } from './build-config.mjs';

export function configToSearch(input) {
  const params = new URLSearchParams({ v: '1', level: String(input.playerLevel), region: input.campaignRegion, modules: MODULE_KEYS.filter(key => input.modules[key]).join(',') });
  if (input.modules.arenaCircus && input.pvp) params.set('pvp', [input.pvp.arena && 'arena',input.pvp.turma && 'turma'].filter(Boolean).join(','));
  if (input.modules.expedition) { params.set('area', input.expeditionAreaId); params.set('enemy', input.expeditionEnemyId); }
  if (input.modules.dungeon) { params.set('dungeon', input.dungeonId); if (input.dungeonLossLimit != null) params.set('losses', String(input.dungeonLossLimit)); }
  if (input.marketProfile) params.set('marketProfile', input.marketProfile);
  if (input.tabernaSync === true) params.set('taberna', '1');
  if (input.allianceChat === true) params.set('allianceChat', '1');
  if (input.modules.smelting) params.set('smelting', input.smeltingPriority || 'crystal');
  return params;
}

export function searchToConfig(params) {
  if (params.get('v') !== '1') throw new TypeError('Versión de enlace no reconocida.');
  const keys = (params.get('modules') || '').split(',').filter(Boolean);
  const pvpKeys = params.has('pvp') ? params.get('pvp').split(',').filter(Boolean) : ['arena','turma'];
  if ((params.has('pvp') && (!pvpKeys.length || !keys.includes('arenaCircus'))) || pvpKeys.some(key=>!['arena','turma'].includes(key)) || new Set(pvpKeys).size!==pvpKeys.length) throw new TypeError('Selección PvP no válida.');
  if (keys.some(key => !MODULE_KEYS.includes(key)) || new Set(keys).size !== keys.length) throw new TypeError('Módulos no válidos.');
  if (params.has('taberna') && params.get('taberna') !== '1') throw new TypeError('Selección de taberna no válida.');
  if (params.has('allianceChat') && params.get('allianceChat') !== '1') throw new TypeError('Selección de chat de alianza no válida.');
  return { tabernaSync: params.get('taberna') === '1', allianceChat: params.get('allianceChat') === '1', marketProfile: params.get('marketProfile') || '', playerLevel: params.get('level'), campaignRegion: params.get('region'), modules: Object.fromEntries(MODULE_KEYS.map(key => [key, keys.includes(key)])), pvp:{arena:pvpKeys.includes('arena'),turma:pvpKeys.includes('turma')}, expeditionAreaId: params.get('area'), expeditionEnemyId: params.get('enemy'), dungeonId: params.get('dungeon'), dungeonLossLimit: params.has('losses') ? params.get('losses') : undefined, smeltingPriority: params.get('smelting') || 'crystal' };
}
