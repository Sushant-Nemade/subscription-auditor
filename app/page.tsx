'use client';
import { useMemo, useState } from 'react';
import Papa from 'papaparse';
import { detectSubscriptions, parseAmount, parseDate } from '../lib/audit.mjs';
type Transaction = { date: string; description: string; amount: number };

const sample: Transaction[] = [
  { date: '2026-01-05', description: 'Example Music', amount: -9.99 },
  { date: '2026-02-05', description: 'Example Music', amount: -9.99 },
  { date: '2026-03-05', description: 'Example Music', amount: -9.99 },
  { date: '2026-01-12', description: 'Cloud Storage', amount: -2.99 },
  { date: '2026-02-12', description: 'Cloud Storage', amount: -2.99 },
  { date: '2026-03-12', description: 'Cloud Storage', amount: -2.99 }
];
function findColumn(columns: string[], names: string[]) {
  return columns.find(column => names.some(name => column.toLowerCase().includes(name))) ?? '';
}
function parseCsv(text: string): Transaction[] {
  const result = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true });
  const fields = result.meta.fields ?? [];
  const date = findColumn(fields, ['date', 'datum', 'posted']);
  const description = findColumn(fields, ['description', 'merchant', 'payee', 'details', 'beschreibung', 'verwendungszweck']);
  const amount = findColumn(fields, ['amount', 'betrag', 'value']);
  const debit = findColumn(fields, ['debit', 'withdrawal', 'soll']);
  if (!date || !description || (!amount && !debit)) throw new Error('CSV needs date, description, and amount or debit columns.');
  return result.data.flatMap(row => {
    const parsedDate = parseDate(row[date]);
    const parsedAmount = parseAmount(row[amount || debit]);
    if (!parsedDate || !Number.isFinite(parsedAmount)) return [];
    return [{ date: parsedDate, description: row[description] ?? '', amount: amount ? parsedAmount : -Math.abs(parsedAmount) }];
  });
}
async function parsePdf(file: File): Promise<Transaction[]> {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();
  const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const rows: Transaction[] = [];
  for (let pageNo = 1; pageNo <= Math.min(doc.numPages, 50); pageNo++) {
    const page = await doc.getPage(pageNo);
    const text = await page.getTextContent();
    const lines = text.items.map(item => 'str' in item ? String(item.str) : '').join(' ');
    for (const match of lines.matchAll(/(\d{2}[./-]\d{2}[./-]\d{4}|\d{4}-\d{2}-\d{2})\s+(.{3,80}?)\s+(-?\d{1,6}[.,]\d{2})(?=\s+\d{2}[./-]\d{2}[./-]\d{4}|$)/g)) {
      const date = parseDate(match[1]);
      const amount = parseAmount(match[3]);
      if (date && Number.isFinite(amount)) rows.push({ date, description: match[2].trim(), amount });
    }
  }
  return rows;
}
export default function Page() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [message, setMessage] = useState('Choose a statement or load sample data. Files stay in this browser.');
  const subscriptions = useMemo(() => detectSubscriptions(transactions), [transactions]);
  const monthly = subscriptions.reduce((sum, item) => sum + (item.period === 'monthly' ? item.amount : item.amount / 12), 0);
  async function onFile(file?: File) {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { setMessage('File is over the 10 MiB limit.'); return; }
    try {
      const rows = file.name.toLowerCase().endsWith('.csv') ? parseCsv(await file.text()) : file.name.toLowerCase().endsWith('.pdf') ? await parsePdf(file) : [];
      if (!rows.length) throw new Error('No transactions found. For image PDFs or complex layouts, export a CSV from your bank.');
      setTransactions(rows);
      setMessage(`Parsed ${rows.length} transactions locally. Review the results before acting.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not parse file.'); }
  }
  return <main>
    <div className="topline">PRIVATE FINANCE TOOL · LOCAL PROCESSING</div>
    <header><div><h1>Subscription Auditor</h1><p>Find repeat charges in a bank statement. Your file stays in your browser.</p></div><span className="badge">No account required</span></header>
    <section className="upload"><label htmlFor="statement">Upload CSV or text-based PDF</label><input id="statement" type="file" accept=".csv,.pdf,text/csv,application/pdf" onChange={event => onFile(event.target.files?.[0])} /><button onClick={() => { setTransactions(sample); setMessage('Showing sample data.'); }}>Try sample data</button><p role="status">{message}</p></section>
    <section className="metrics"><div><small>Potential subscriptions</small><strong>{subscriptions.length}</strong></div><div><small>Estimated monthly total</small><strong>€{monthly.toFixed(2)}</strong></div><div><small>Transactions read</small><strong>{transactions.length}</strong></div></section>
    <section><h2>Recurring charges</h2>{subscriptions.length ? <div className="cards">{subscriptions.map(item => <article key={item.merchant}><div><h3>{item.merchant}</h3><span className="badge">{item.confidence === 'high' ? 'Likely' : 'Review'}</span></div><p>{item.occurrences} charges · last seen {item.lastDate}</p><strong>€{item.amount.toFixed(2)} / {item.period === 'monthly' ? 'month' : 'year'}</strong></article>)}</div> : <p className="empty">No recurring charges identified yet. At least two charges roughly a month or year apart are needed.</p>}</section>
    <footer>Detection is an estimate. Confirm any charge with your bank or provider. This app does not cancel subscriptions.</footer>
  </main>;
}
