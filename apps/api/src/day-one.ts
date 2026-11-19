// Synthetic weather scenario; coefficients are for demonstration only.
export const scenario = 'dry-day-v1';
export const weather = { date:'2026-01-01', rainMm:0, dryingPoints:5, initialPct:50 };
export function simulate(initialPct:number, rainMm:number, dryingPoints:number, threshold:number) {
  const moisturePct = Math.max(0, Math.min(100, Math.round(initialPct + rainMm - dryingPoints)));
  return {moisturePct, needsWater:moisturePct < threshold};
}

// Fixed synthetic January fixture: rain (mm) and daily drying (percentage points).
export const days = [
  [0,5],[0,4],[15,2],[2,3],[0,5],[0,6],[8,2],[0,4],[0,5],[12,2],
  [0,4],[0,6],[0,5],[4,3],[18,2],[0,4],[0,5],[0,6],[0,5],[6,3],
  [0,4],[13,2],[0,5],[0,4],[0,6],[3,3],[10,2],[0,4],[0,5],[7,3]
].map(([rainMm,dryingPoints],i)=>({date:'2026-01-'+String(i+1).padStart(2,'0'),rainMm,dryingPoints}));
