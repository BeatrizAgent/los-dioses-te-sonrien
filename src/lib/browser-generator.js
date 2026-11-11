import catalog from '../data/catalog.json';
import { fragments } from './userscript-fragments.js';
import { buildUserscript, DEFAULT_CONFIG, eligibleDungeons, eligibleExpeditions, normalizeBuildConfig } from './build-config.mjs';

const moduleKeys = ['arenaCircus', 'missions', 'healing', 'expedition', 'dungeon', 'guildGold'];
let currentObjectUrl = '';

function option(select, value, label) {
  const item = document.createElement('option');
  item.value = value;
  item.textContent = label;
  select.append(item);
}

export function initializeGenerator() {
  const form = document.querySelector('#bot-form');
  if (!form) return;
  const level = document.querySelector('#player-level');
  const regionSelect = document.querySelector('#campaign-region');
  const expeditionToggle = document.querySelector('#module-expedition');
  const dungeonToggle = document.querySelector('#module-dungeon');
  const areaSelect = document.querySelector('#expedition-area');
  const enemySelect = document.querySelector('#expedition-enemy');
  const dungeonSelect = document.querySelector('#dungeon-select');
  const result = document.querySelector('#generation-result');
  const error = document.querySelector('#form-error');
  const download = document.querySelector('#download-link');
  const preview = document.querySelector('#script-preview');

  for (const region of catalog.scope.regions) option(regionSelect, region, region);
  regionSelect.value = DEFAULT_CONFIG.campaignRegion;

  function refreshCatalog() {
    const playerLevel = Number(level.value);
    error.hidden = true;
    result.hidden = true;
    const region = regionSelect.value;
    const areas = Number.isInteger(playerLevel)
      ? eligibleExpeditions(catalog, playerLevel, region)
      : [];
    const previousArea = areaSelect.value;
    areaSelect.replaceChildren();
    for (const area of areas) option(areaSelect, area.id, `${area.region} · ${area.name} · acceso ${area.entryLevel}`);
    if (areas.some(area => area.id === previousArea)) areaSelect.value = previousArea;

    const area = areas.find(item => item.id === areaSelect.value) || areas[0];
    if (area && areaSelect.value !== area.id) areaSelect.value = area.id;
    const enemies = area?.enemies || [];
    const previousEnemy = enemySelect.value;
    enemySelect.replaceChildren();
    for (const enemy of enemies) option(enemySelect, enemy.id, `${enemy.position} · ${enemy.name}${enemy.boss ? ' · jefe' : ''} · ${enemy.levelMin}–${enemy.levelMax}`);
    if (enemies.some(enemy => enemy.id === previousEnemy)) enemySelect.value = previousEnemy;
    const enemy = enemies.find(item => item.id === enemySelect.value) || enemies[0];
    if (enemy && enemySelect.value !== enemy.id) enemySelect.value = enemy.id;
    document.querySelector('#expedition-note').textContent = enemy
      ? `Personaje declarado nivel ${playerLevel}. Acceso a ${area.name}: ${area.entryLevel}. ${enemy.name}: aparece entre nivel ${enemy.levelMin} y ${enemy.levelMax}${enemy.boss ? ' · jefe' : ''}.`
      : 'No hay una zona desbloqueada para ese nivel.';

    const dungeons = Number.isInteger(playerLevel)
      ? eligibleDungeons(catalog, playerLevel, region)
      : [];
    const previousDungeon = dungeonSelect.value;
    dungeonSelect.replaceChildren();
    for (const dungeon of dungeons) {
      const parent = catalog.expeditions.find(item => item.id === dungeon.areaId);
      const difficulty = dungeon.difficulty === 'advanced' ? 'avanzada' : 'normal';
      option(dungeonSelect, dungeon.id, `${dungeon.region} · acceso ${dungeon.entryLevel} · ${dungeon.name} · ${difficulty} · jefe ${dungeon.boss} (${dungeon.levelMin}–${dungeon.levelMax})`);
      dungeonSelect.lastElementChild.dataset.area = parent?.name || '';
    }
    if (dungeons.some(dungeon => dungeon.id === previousDungeon)) dungeonSelect.value = previousDungeon;
    const dungeon = dungeons.find(item => item.id === dungeonSelect.value) || dungeons[0];
    if (dungeon && dungeonSelect.value !== dungeon.id) dungeonSelect.value = dungeon.id;
    const parent = dungeon && catalog.expeditions.find(item => item.id === dungeon.areaId);
    document.querySelector('#dungeon-note').textContent = dungeon
      ? `${parent?.name || dungeon.region} · ${dungeon.difficulty === 'advanced' ? 'modo avanzado' : 'modo normal'} · nivel de acceso ${dungeon.entryLevel}. El jefe ${dungeon.boss} aparece en nivel ${dungeon.levelMin}–${dungeon.levelMax}.`
      : 'No hay una mazmorra disponible para ese nivel.';
  }

  function updateModuleControls() {
    const expOn = expeditionToggle.checked;
    const dungeonOn = dungeonToggle.checked;
    document.querySelector('#expedition-fields').classList.toggle('inactive', !expOn);
    document.querySelector('#dungeon-fields').classList.toggle('inactive', !dungeonOn);
    document.querySelector('#expedition-status').textContent = expOn ? 'ACTIVA' : 'APAGADA';
    document.querySelector('#dungeon-status').textContent = dungeonOn ? 'ACTIVA' : 'APAGADA';
    document.querySelector('#expedition-status').classList.toggle('on', expOn);
    document.querySelector('#dungeon-status').classList.toggle('on', dungeonOn);
    for (const control of [areaSelect, enemySelect]) control.disabled = !expOn;
    dungeonSelect.disabled = !dungeonOn;
  }

  level.addEventListener('input', refreshCatalog);
  level.addEventListener('change', refreshCatalog);
  regionSelect.addEventListener('change', refreshCatalog);
  areaSelect.addEventListener('change', refreshCatalog);
  enemySelect.addEventListener('change', refreshCatalog);
  dungeonSelect.addEventListener('change', refreshCatalog);
  expeditionToggle.addEventListener('change', updateModuleControls);
  dungeonToggle.addEventListener('change', updateModuleControls);
  for (const key of moduleKeys) {
    const checkbox = form.querySelector(`input[name="${key}"]`);
    checkbox?.addEventListener('change', () => {
      error.hidden = true;
      result.hidden = true;
    });
  }
  refreshCatalog();
  updateModuleControls();

  form.addEventListener('submit', event => {
    event.preventDefault();
    error.hidden = true;
    try {
      const modules = Object.fromEntries(moduleKeys.map(key => [key, form.querySelector(`input[name="${key}"]`).checked]));
      const config = normalizeBuildConfig({
        playerLevel: level.value,
        campaignRegion: regionSelect.value,
        modules,
        expeditionAreaId: areaSelect.value,
        expeditionEnemyId: enemySelect.value,
        dungeonId: dungeonSelect.value,
      }, catalog);
      const userscript = buildUserscript(config, fragments);
      const blob = new Blob([userscript], { type: 'text/javascript;charset=utf-8' });
      if (currentObjectUrl) URL.revokeObjectURL(currentObjectUrl);
      currentObjectUrl = URL.createObjectURL(blob);
      download.href = currentObjectUrl;
      preview.textContent = userscript;
      document.querySelector('#result-title').textContent = 'Userscript generado';
      const enabled = Object.values(config.modules).filter(Boolean).length;
      const pveRegion = config.modules.expedition || config.modules.dungeon ? ` · región PvE ${config.campaignRegion}` : '';
      document.querySelector('#result-detail').textContent = `${enabled} módulo(s) activo(s) · nivel declarado ${config.playerLevel}${pveRegion} · ${Math.ceil(userscript.length / 1024)} KB`;
      result.hidden = false;
      result.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } catch (cause) {
      error.textContent = cause instanceof Error ? cause.message : 'No se pudo generar la configuración.';
      error.hidden = false;
      result.hidden = true;
    }
  });

  window.addEventListener('pagehide', () => {
    if (currentObjectUrl) URL.revokeObjectURL(currentObjectUrl);
  }, { once: true });
}
