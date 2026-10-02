/**
 * Series and Batch Derivation Utilities for CSE Alumni Directory
 */

export function getSeries(id?: string): string | null {
  const m = String(id || '').trim().match(/^(\d{2})/);
  return m ? String(Number(m[1])).padStart(2, '0') : null;   // "99406" → "99"
}

export function getBatchNumberFromSeries(series?: string | number | null): number | null {
  if (series === undefined || series === null) return null;
  const s = Number(series);
  if (!Number.isFinite(s) || s < 0 || s > 99) return null;
  if (s >= 19) return s;              // 19..99 → batch 19..99
  else if (s >= 11) return s + 1;     // 11..18 → batch 12..19
  return ((s - 99 + 100) % 100) + 1;  // 0..10 → batch 1..11
}

export function getOrdinalSuffix(num: number): string {
  const mod10 = num % 10;
  const mod100 = num % 100;
  if (mod10 === 1 && mod100 !== 11) return 'st';
  if (mod10 === 2 && mod100 !== 12) return 'nd';
  if (mod10 === 3 && mod100 !== 13) return 'rd';
  return 'th';
}

export function deriveSeriesAndBatch(studentId?: string): { series: string; batch: string } {
  const s = getSeries(studentId);
  if (!s) return { series: 'N/A', batch: 'N/A' };
  
  const b = getBatchNumberFromSeries(s);
  if (b === null) return { series: `${s} Series`, batch: 'N/A' };

  const suffix = getOrdinalSuffix(b);
  return {
    series: `${s} Series`,
    batch: `${b}${suffix} Batch`,
  };
}
