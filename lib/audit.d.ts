export type Transaction = { date: string; description: string; amount: number };
export type Subscription = { merchant: string; period: 'monthly' | 'annual'; amount: number; occurrences: number; lastDate: string; confidence: 'high' | 'review'; transactions: Transaction[] };
export function normalizeMerchant(value: unknown): string;
export function parseAmount(value: unknown): number;
export function parseDate(value: unknown): string | null;
export function detectSubscriptions(transactions: Transaction[]): Subscription[];
