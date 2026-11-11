import bootstrap from '../bot/00-bootstrap.js?raw';
import core from '../bot/10-core-and-missions.js?raw';
import healing from '../bot/20-healing.js?raw';
import guildMarket from '../bot/30-guild-market.js?raw';
import pve from '../bot/40-popup-and-pve.js?raw';
import combat from '../bot/50-combat-and-arena.js?raw';
import panelTheme from '../bot/60-panel-theme.js?raw';
import panel from '../bot/60-panel.js?raw';

export const fragments = [bootstrap, core, healing, guildMarket, pve, combat, panelTheme, panel];
