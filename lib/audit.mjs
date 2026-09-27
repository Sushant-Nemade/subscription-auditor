const noise = /\b(?:payment|debit|card|pos|transfer|ref|id|online|purchase|inc|ltd|gmbh|sepa)\b/gi;
const suffix = /\s+(?:\d{4,}|[A-Z0-9]{8,})$/i;

export function normalizeMerchant(value) {
  return String(value ?? '').replace(noise, ' ').replace(suffix, ' ').replace(/[^\p{L}\p{N}]+/gu, ' ').trim().toLowerCase();
}
export function parseAmount(value) {
  const raw = String(value ?? '').replace(/[^\d,.-]/g, '');
  const comma = raw.lastIndexOf(',');
  const dot = raw.lastIndexOf('.');
  const normalized = comma > dot ? raw.replaceAll('.', '').replace(',', '.') : raw.replaceAll(',', '');
  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount : NaN;
}
export function parseDate(value) {
  const raw = String(value ?? '').trim();
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null;
  if (iso) return iso;
  const european = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/.exec(raw);
  if (!european) return null;
  const [, day, month, year] = european;
  const candidate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  const date = new Date(`${candidate}T00:00:00Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === candidate ? candidate : null;
}
export function detectSubscriptions(transactions) {
  const groups = new Map();
  for (const row of transactions) {
    const amount = Math.abs(Number(row.amount));
    const date = parseDate(row.date);
    const merchant = normalizeMerchant(row.description);
    if (!date || !merchant || !Number.isFinite(amount) || amount <= 0 || Number(row.amount) >= 0) continue;
    const list = groups.get(merchant) ?? [];
    list.push({ date, amount, description: row.description });
    groups.set(merchant, list);
  }
  const results = [];
  for (const [merchant, rows] of groups) {
    const sorted = rows.sort((a, b) => a.date.localeCompare(b.date));
    if (sorted.length < 2) continue;
    const gaps = sorted.slice(1).map((r, i) => (Date.parse(r.date) - Date.parse(sorted[i].date)) / 86400000);
    const monthly = gaps.filter(g => g >= 25 && g <= 35).length;
    const annual = gaps.filter(g => g >= 350 && g <= 380).length;
    if (!monthly && !annual) continue;
    const amounts = sorted.map(r => r.amount).sort((a, b) => a - b);
    const median = amounts[Math.floor(amounts.length / 2)];
    const stable = amounts.filter(a => Math.abs(a - median) <= Math.max(1, median * 0.1)).length >= 2;
    results.push({ merchant, period: monthly >= annual ? 'monthly' : 'annual', amount: median, occurrences: sorted.length, lastDate: sorted.at(-1).date, confidence: stable ? 'high' : 'review', transactions: sorted });
  }
  return results.sort((a, b) => b.amount - a.amount);
}
