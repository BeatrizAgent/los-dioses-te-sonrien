// Selección conservadora: solo identifica candidatos; no mueve ni funde objetos.
const PREFIXES = Object.freeze({
  crystal: ['Manius','Gaius','Antonius','Belisarius','Titus','Quintus','Pontius','Tellus','Marcellus','Titanius','Servius','Dexterus','Valerius','Constantius','Amulius'],
  stamina: ['Lucius','Sentarions','Fernabasts','Tantus','Korks','Leandronimus','Barbekuus','Stoybaers','Decimus','Anchorons','Appius','Trafans','Ichorus','Opiehnzas'],
});
// Receta del prefijo, no cantidad garantizada al fundir el objeto completo.
const CRYSTAL_RECIPE = Object.freeze([42,31,30,30,29,25,22,19,17,17,8,6,6,4,2]);

// En paquetes observados el verde carece de data-quality; azul usa 1.
// Rechazar valores numéricos contradictorios y clases de calidad superior.
export function parseSmeltingEquipment(element, source) {
  if (!element || typeof element.getAttribute !== 'function') return null;
  const basis = /^(\d+)-\d+$/.exec(element.getAttribute('data-basis') || '');
  const type = Number(basis?.[1]);
  const qualityValue = element.getAttribute('data-quality');
  const green = element.classList?.contains('item-i-green') && (qualityValue === null || qualityValue === '0');
  const blue = element.classList?.contains('item-i-blue') && qualityValue === '1';
  if (!basis || ![1,2,3,4,5,6,8,9].includes(type) || green === blue) return null;
  if (['item-i-purple','item-i-orange','item-i-red'].some(c => element.classList.contains(c))) return null;
  let tooltip;
  try { tooltip = JSON.parse(element.getAttribute('data-tooltip')); } catch { return null; }
  const name = tooltip?.[0]?.[0]?.[0];
  if (typeof name !== 'string' || !name.trim()) return null;
  const candidate = { name:name.trim(), source, basisType:type, quality:green ? 'green' : 'blue' };
  return smeltingCandidate(candidate, 'green-blue') ? candidate : null;
}

export function smeltingCandidate(item, priority) {
  if (!item || !['crystal','stamina','green-blue'].includes(priority)) return false;
  if (!['expedition','dungeon'].includes(item.source) || item.reserved === true) return false;
  if (![1,2,3,4,5,6,8,9].includes(item.basisType)) return false;
  if (!['green','blue'].includes(item.quality) || typeof item.name !== 'string') return false;
  if (priority === 'green-blue') return true;
  const name = item.name.normalize('NFKC').trim().toLocaleLowerCase('es');
  return PREFIXES[priority].some(prefix => name.split(/\s+/u).includes(prefix.toLocaleLowerCase('es')));
}

export function crystalRecipeEstimate(item) {
  if (!smeltingCandidate(item, 'crystal')) return 0;
  const words = item.name.normalize('NFKC').trim().toLocaleLowerCase('es').split(/\s+/u);
  const index = PREFIXES.crystal.findIndex(prefix => words.includes(prefix.toLocaleLowerCase('es')));
  return index < 0 ? 0 : CRYSTAL_RECIPE[index];
}
