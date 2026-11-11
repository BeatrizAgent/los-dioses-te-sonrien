export const MODULE_KEYS = ['arenaCircus', 'missions', 'healing', 'expedition', 'dungeon', 'guildGold'];

export const DEFAULT_CONFIG = Object.freeze({
  playerLevel: 20,
  modules: Object.freeze({
    arenaCircus: true,
    missions: true,
    healing: true,
    expedition: false,
    dungeon: false,
    guildGold: false,
  }),
  expeditionAreaId: 'af-voodoo-temple',
  expeditionEnemyId: 'af-voodoo-temple-cobra',
  dungeonId: 'dungeon-temple-perdition',
});

export function eligibleExpeditions(catalog, playerLevel) {
  return catalog.expeditions.filter(area => area.entryLevel <= playerLevel);
}

export function eligibleDungeons(catalog, playerLevel) {
  return catalog.dungeons.filter(dungeon => dungeon.entryLevel <= playerLevel);
}

export function normalizeBuildConfig(input, catalog) {
  const playerLevel = Number(input.playerLevel);
  if (!Number.isInteger(playerLevel) || playerLevel < 20 || playerLevel > 99) {
    throw new RangeError('El nivel de personaje debe estar entre 20 y 99.');
  }

  const modules = Object.fromEntries(MODULE_KEYS.map(key => [key, input.modules?.[key] === true]));
  if (!MODULE_KEYS.some(key => modules[key])) throw new TypeError('Activa al menos un módulo.');

  let expedition = null;
  if (modules.expedition) {
    const area = catalog.expeditions.find(row => row.id === input.expeditionAreaId);
    const enemy = area?.enemies.find(row => row.id === input.expeditionEnemyId);
    if (!area || !enemy) throw new TypeError('Elige una zona y un enemigo de expedición del catálogo.');
    if (area.entryLevel > playerLevel) throw new RangeError('El nivel declarado no alcanza el acceso a esa zona.');
    expedition = {
      area: { id: area.id, name: area.name, entryLevel: area.entryLevel },
      enemy: { id: enemy.id, name: enemy.name, position: enemy.position, levelMin: enemy.levelMin, levelMax: enemy.levelMax },
    };
  }

  let dungeon = null;
  if (modules.dungeon) {
    const row = catalog.dungeons.find(item => item.id === input.dungeonId);
    const area = catalog.expeditions.find(item => item.id === row?.areaId);
    if (!row || !area) throw new TypeError('Elige una mazmorra del catálogo.');
    if (row.entryLevel > playerLevel) throw new RangeError('El nivel declarado no alcanza el acceso a esa mazmorra.');
    dungeon = {
      id: row.id,
      name: row.name,
      boss: row.boss,
      area: { id: area.id, name: area.name, entryLevel: area.entryLevel },
      entryLevel: row.entryLevel,
      difficulty: row.difficulty,
      levelMin: row.levelMin,
      levelMax: row.levelMax,
      nameNote: row.nameNote || '',
    };
  }

  return { playerLevel, modules, expedition, dungeon };
}

export function buildUserscript(config, fragments) {
  if (!Array.isArray(fragments) || fragments.length !== 8 || fragments.some(fragment => typeof fragment !== 'string')) {
    throw new TypeError('Se necesitan los ocho módulos de código en el orden de compilación.');
  }
  const source = fragments.join('\n');
  const marker = '__BUILD_CONFIG__';
  if (source.split(marker).length !== 2) throw new Error('El punto de configuración debe aparecer una sola vez.');
  return source.replace(marker, JSON.stringify(config));
}
