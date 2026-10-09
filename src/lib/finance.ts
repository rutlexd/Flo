export type Category = 'editing' | 'vinted' | 'other';
export type Transaction = {
  id: string; type: 'income' | 'expense'; amount: number; currency: 'PLN' | 'USD';
  amountPln: number; exchangeRate: number; category: Category; date: string;
  description: string; carriedOver: boolean; transferKey?: string;
};
export type Backup = { version: 1; transactions: Transaction[] };
export const categories: Record<Category, string> = { editing: 'Відеомонтаж', vinted: 'Vinted', other: 'Інше' };
export const categoryColors: Record<Category, string> = { editing: '#9d79ff', vinted: '#48cbb7', other: '#ed85bb' };
// All money is stored as integer minor units. Historical PLN amounts are immutable snapshots.
export const initialTransactions: Transaction[] = [
  { id: 'seed-editing', type: 'income', amount: 12000, currency: 'USD', amountPln: 45900, exchangeRate: 3.825, category: 'editing', date: '2026-10-09', description: 'Монтаж відео', carriedOver: false },
  { id: 'seed-vinted', type: 'income', amount: 6500, currency: 'PLN', amountPln: 6500, exchangeRate: 1, category: 'vinted', date: '2026-10-08', description: 'Продаж на Vinted', carriedOver: false },
  { id: 'seed-stock', type: 'expense', amount: 20000, currency: 'PLN', amountPln: 20000, exchangeRate: 1, category: 'vinted', date: '2026-10-05', description: 'Закупівля товарів для Vinted', carriedOver: false },
  { id: 'seed-carry', type: 'expense', amount: 7000, currency: 'PLN', amountPln: 7000, exchangeRate: 1, category: 'vinted', date: '2026-10-01', description: 'Закупівля з попереднього місяця', carriedOver: true, transferKey: 'vinted-stock-2026-09' },
];
export function money(cents: number, currency = 'PLN') {
  return new Intl.NumberFormat('uk-UA', { style: 'currency', currency, currencyDisplay: 'symbol', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(cents / 100).replace('PLN', 'zł').replace(/^-/, '−');
}
export function monthLabel(month: string, short = false) {
  const label = new Intl.DateTimeFormat('uk-UA', { month: short ? 'short' : 'long', ...(short ? {} : { year: 'numeric' }) }).format(new Date(`${month}-01T12:00:00`));
  return label.charAt(0).toUpperCase() + label.slice(1).replace(' р.', '');
}
export function shiftMonth(month: string, delta: number) {
  const [year, m] = month.split('-').map(Number); const d = new Date(year, m - 1 + delta, 1, 12);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
export function totals(transactions: Transaction[], month?: string) {
  const rows = month ? transactions.filter(t => t.date.startsWith(month)) : transactions;
  const income = rows.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amountPln, 0);
  const expense = rows.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amountPln, 0);
  const sources = (Object.keys(categories) as Category[]).map(category => ({ category, name: categories[category], value: rows.filter(t => t.type === 'income' && t.category === category).reduce((sum, t) => sum + t.amountPln, 0) }));
  return { income, expense, result: income - expense, count: rows.length, sources };
}
export function comparison(current: number, previous: number) { return previous > 0 ? (current - previous) / previous * 100 : null; }
export function validDate(value: string) { if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value < '1900-01-01' || value > '9999-12-31') return false; const d = new Date(`${value}T12:00:00Z`); return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value; }
export function validateBackup(data: unknown): Backup {
  if (!data || typeof data !== 'object' || (data as Backup).version !== 1 || !Array.isArray((data as Backup).transactions)) throw new Error('Непідтримуваний формат. Оберіть резервну копію FLO (версія 1).');
  const rows = (data as Backup).transactions;
  if (rows.length > 100000) throw new Error('Забагато операцій у файлі.');
  const ids = new Set<string>(), transfers = new Set<string>();
  let total = 0;
  for (const t of rows) {
    if (!t || typeof t.id !== 'string' || !t.id || ids.has(t.id) || !['income', 'expense'].includes(t.type) || !['PLN', 'USD'].includes(t.currency) || !Object.hasOwn(categories, t.category) || typeof t.date !== 'string' || !validDate(t.date) || typeof t.description !== 'string' || t.description.length > 500 || typeof t.carriedOver !== 'boolean' || !Number.isSafeInteger(t.amount) || t.amount <= 0 || !Number.isSafeInteger(t.amountPln) || t.amountPln <= 0 || !Number.isFinite(t.exchangeRate) || t.exchangeRate <= 0) throw new Error('Файл містить некоректні або повторні операції.');
    if (t.currency === 'PLN' && (t.exchangeRate !== 1 || t.amount !== t.amountPln)) throw new Error('Некоректна сума операції в PLN.');
    if (t.currency === 'USD' && Math.abs(Math.round(t.amount * t.exchangeRate) - t.amountPln) > 1) throw new Error('Курс USD не відповідає зафіксованій сумі PLN.');
    if (t.carriedOver && (t.type !== 'expense' || typeof t.transferKey !== 'string' || !t.transferKey || transfers.has(t.transferKey))) throw new Error('Перенесені витрати мають містити унікальне джерело перенесення.');
    total += t.amountPln; if (!Number.isSafeInteger(total)) throw new Error('Загальна сума перевищує допустиму точність.');
    ids.add(t.id); if (t.carriedOver) transfers.add(t.transferKey!);
  }
  return { version: 1, transactions: rows.map(t => ({ id: t.id, type: t.type, amount: t.amount, currency: t.currency, amountPln: t.amountPln, exchangeRate: t.exchangeRate, category: t.category, date: t.date, description: t.description, carriedOver: t.carriedOver, ...(t.carriedOver ? { transferKey: t.transferKey } : {}) })) };
}
export function toCsv(rows: Transaction[]) {
  const cell = (v: unknown) => { let s = String(v); if (/^[=+@\-\t\r]/.test(s)) s = `'${s}`; return `"${s.replaceAll('"', '""')}"`; };
  const data = rows.map(t => [t.date, t.type === 'income' ? 'Дохід' : 'Витрата', categories[t.category], (t.amount / 100).toFixed(2), t.currency, (t.amountPln / 100).toFixed(2), t.exchangeRate, t.description, t.carriedOver ? 'Так' : 'Ні', t.transferKey || '']);
  return '\uFEFF' + [['Дата', 'Тип', 'Категорія', 'Оригінальна сума', 'Валюта', 'Сума PLN', 'Курс', 'Опис', 'Перенесено', 'Джерело перенесення'], ...data].map(row => row.map(cell).join(';')).join('\r\n');
}
export function download(content: string, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type })); const link = document.createElement('a'); link.href = url; link.download = filename; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
