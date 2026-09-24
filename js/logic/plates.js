// Calculadora de anilhas e rampa de aquecimento para exercícios com barra.
import { roundTo } from './format.js';

export const DEFAULT_PLATES = [25, 20, 15, 10, 5, 2.5, 1.25];

/**
 * Anilhas por lado para montar `kg` numa barra de `bar` kg.
 * @returns {{perSide:number[], rest:number}|null}  null se a carga for menor que a barra.
 */
export function platesFor(kg, bar = 20, available = DEFAULT_PLATES) {
  if (!(kg > 0) || kg < bar) return null;
  let side = Math.round(((kg - bar) / 2) * 1000) / 1000;
  const perSide = [];
  for (const p of [...available].sort((a, b) => b - a)) {
    while (side >= p - 1e-9) { perSide.push(p); side = Math.round((side - p) * 1000) / 1000; }
  }
  return { perSide, rest: side > 0.001 ? side : 0 };
}

/** Rampa de aquecimento sugerida (≥ 40 kg): barra ×10, ~50% ×5, ~75% ×3. */
export function warmupFor(kg, bar = 20) {
  if (!(kg >= bar * 2)) return [];
  const out = [{ kg: bar, reps: 10 }];
  const half = roundTo(kg * 0.5, 2.5), three = roundTo(kg * 0.75, 2.5);
  if (half >= bar + 5) out.push({ kg: half, reps: 5 });
  if (three > half && three < kg) out.push({ kg: three, reps: 3 });
  return out;
}
