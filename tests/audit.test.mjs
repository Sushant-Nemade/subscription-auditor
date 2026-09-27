import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { detectSubscriptions, parseAmount, parseDate } from '../lib/audit.mjs';

test('parses common European amount and date formats', () => {
  assert.equal(parseAmount('€1.234,50'), 1234.5);
  assert.equal(parseDate('27.09.2026'), '2026-09-27');
  assert.equal(parseDate('31.02.2026'), null);
});
test('finds recurring monthly debit and ignores one-off credit', () => {
  const found = detectSubscriptions([
    { date: '2026-01-05', description: 'Example Music', amount: -9.99 },
    { date: '2026-02-05', description: 'Example Music', amount: -9.99 },
    { date: '2026-03-05', description: 'Example Music', amount: -9.99 },
    { date: '2026-03-05', description: 'Refund', amount: 20 }
  ]);
  assert.equal(found.length, 1);
  assert.equal(found[0].period, 'monthly');
  assert.equal(found[0].amount, 9.99);
});
