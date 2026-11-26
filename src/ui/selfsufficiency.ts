import { config } from '../config';
import { remainingMachines } from '../sim';
import type { GameState } from '../sim';
import { fmt, plural } from './labels';

const FUNCTIONS = [
  { key: 'soil', label: '🧽 Čištění půdy', life: 'houby', machine: 'čističky' },
  { key: 'irrigation', label: '💧 Zavlažování', life: 'rostliny', machine: 'závlahy' },
  { key: 'river', label: '🚰 Filtrace řeky', life: 'rostliny na břehu', machine: 'filtrační stanice' },
  { key: 'pollination', label: '🌼 Opylování', life: 'včely', machine: 'rozprašovače' },
] as const;

const pct = (v: number) => `${fmt(v * 100)} %`;

function bar(v: number): string {
  return `<span class="bar"><span style="width:${(Math.max(0, Math.min(1, v)) * 100).toFixed(1)}%"></span></span>`;
}

/** Side panel section: self-sufficiency per function and the path to victory. */
export function selfSufficiencyHtml(state: GameState): string {
  const ss = state.selfSufficiency;
  const rows = FUNCTIONS.map(
    (f) => `<div class="ss-row"><span>${f.label}</span><b>${pct(ss[f.key])}</b></div>${bar(ss[f.key])}
      <div class="muted small ss-who">dělají ${f.life} místo ${f.machine}</div>`,
  ).join('');

  const r = remainingMachines(state, config);
  const machinesOk = r.running === 0 && r.poles === 0 && r.wires === 0;
  const ssOk = ss.total >= config.win.selfSufficiency;
  const left: string[] = [];
  if (r.running) left.push(`${r.running} ${plural(r.running, 'zapnutý stroj', 'zapnuté stroje', 'zapnutých strojů')}`);
  if (r.poles) left.push(`${r.poles} ${plural(r.poles, 'sloup', 'sloupy', 'sloupů')}`);
  if (r.wires) left.push(`${r.wires} ${plural(r.wires, 'drát', 'dráty', 'drátů')}`);
  const check = (ok: boolean, text: string) => `<div class="cond ${ok ? 'met' : ''}">${ok ? '✔' : '○'} ${text}</div>`;

  return `
    <div class="ss-total"><span>Celkem</span><b>${pct(ss.total)}</b></div>${bar(ss.total)}
    ${rows}
    <h3>Cesta k výhře</h3>
    ${check(machinesOk, machinesOk ? 'Všechny stroje a elektrárny vypnuté, sloupy a dráty rozebrané' : `Vypnout a rozebrat: zbývá ${left.join(', ')}`)}
    ${check(ssOk, `Soběstačnost aspoň ${fmt(config.win.selfSufficiency * 100)} % (teď ${pct(ss.total)})`)}
    ${check(
      state.stableTicks >= config.win.stableTicks || state.wonAtTick !== null,
      `Biom stabilní ${config.win.stableTicks} ticků: <b>${state.wonAtTick !== null ? config.win.stableTicks : state.stableTicks} / ${config.win.stableTicks}</b> <span class="muted">(řeka, včely ani rostliny neubývají)</span>`,
    )}`;
}
