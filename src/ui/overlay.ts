export type OverlayMode = 'none' | 'toxicity' | 'moisture' | 'pollution' | 'pollination';

export interface OverlayInfo {
  label: string;
  legend: string;
  /** Colour ramp: value 0 → first colour, 0.5 → middle, 1 → last. */
  ramp: Array<[number, number, number]>;
}

type RGB = [number, number, number];

/** Linear interpolation along a colour ramp; v in 0–1. */
export function rampColor(ramp: RGB[], v: number): RGB {
  const clamped = Math.max(0, Math.min(1, v));
  const pos = clamped * (ramp.length - 1);
  const i = Math.min(ramp.length - 2, Math.floor(pos));
  const f = pos - i;
  const a = ramp[i];
  const b = ramp[i + 1];
  return [0, 1, 2].map((k) => Math.round(a[k] + (b[k] - a[k]) * f)) as RGB;
}

export const OVERLAYS: Record<OverlayMode, OverlayInfo> = {
  none: { label: 'Bez overlaye', legend: '', ramp: [[0, 0, 0], [0, 0, 0]] },
  toxicity: {
    label: '☣️ Toxicita',
    legend: 'Zelená = čistá půda, žlutá = středně toxická, fialová = jedovatá (0 až 100).',
    ramp: [
      [60, 170, 90],
      [235, 200, 60],
      [150, 40, 170],
    ],
  },
  moisture: {
    label: '💧 Vlhkost',
    legend: 'Písková = suchá půda, modrá = vlhká (0 až 100). Dál od řeky je sucho.',
    ramp: [
      [225, 195, 130],
      [120, 190, 200],
      [25, 80, 200],
    ],
  },
  pollution: {
    label: '🌫️ Znečištění',
    legend: 'Znečištění ovzduší je společné pro celou mapu. Čím šedší, tím horší.',
    ramp: [
      [70, 60, 55],
      [70, 60, 55],
    ],
  },
  pollination: {
    label: '🐝 Opylení',
    legend: 'Žlutá pole jsou právě opylená (rozprašovačem pylu, později včelami). Bez rostlin zatím opylení nic nedělá.',
    ramp: [
      [245, 200, 20],
      [245, 200, 20],
    ],
  },
};
