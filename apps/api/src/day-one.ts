// Synthetic weather scenario; coefficients are for demonstration only.
export const scenario = 'dry-day-v1';
export const weather = { date:'2026-01-01', rainMm:0, dryingPoints:5, initialPct:50 };
export function simulate(initialPct:number, rainMm:number, dryingPoints:number, threshold:number) {
  const moisturePct = Math.max(0, Math.min(100, Math.round(initialPct + rainMm - dryingPoints)));
  return {moisturePct, needsWater:moisturePct < threshold};
}
