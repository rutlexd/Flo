import { describe, it, expect } from 'vitest';
import { totals, initialTransactions, validateBackup, shiftMonth, comparison, validDate, toCsv, type Transaction } from '../src/lib/finance';
import { LocalTransactionRepository, STORAGE_KEY } from '../src/lib/storage';
const clone = () => structuredClone(initialTransactions);
class MemoryStorage implements Storage { data = new Map<string, string>(); get length() { return this.data.size; } clear() { this.data.clear(); } getItem(k: string) { return this.data.get(k) ?? null; } setItem(k: string, v: string) { this.data.set(k, v); } removeItem(k: string) { this.data.delete(k); } key(i: number) { return [...this.data.keys()][i] ?? null; } }
describe('Розрахунки FLO', () => {
  it('обчислює точні початкові підсумки та джерела', () => { const t = totals(clone(), '2026-10'); expect([t.income, t.expense, t.result, t.count]).toEqual([52400,27000,25400,4]); expect(t.sources.map(s => s.value)).toEqual([45900,6500,0]); });
  it('не враховує перенесення у вересні', () => { expect(totals(clone(), '2026-09').expense).toBe(0); expect(clone().find(t => t.carriedOver)?.amountPln).toBe(7000); });
  it('показує порожній місяць без вигаданих значень', () => { expect(totals(clone(), '2027-01')).toMatchObject({ income: 0, expense: 0, result: 0, count: 0 }); });
  it('правильно обчислює від’ємний результат', () => { expect(totals(clone().filter(t => t.type === 'expense')).result).toBe(-27000); });
  it('редагування і видалення оновлюють підсумки', () => { const rows = clone(); rows[0].amountPln = 50000; expect(totals(rows).income).toBe(56500); expect(totals(rows.filter(t => t.id !== 'seed-vinted')).income).toBe(50000); });
  it('переходить між роками та перевіряє календарні дати', () => { expect(shiftMonth('2026-01', -1)).toBe('2025-12'); expect(shiftMonth('2026-12',1)).toBe('2027-01'); expect(validDate('2026-02-29')).toBe(false); expect(validDate('2028-02-29')).toBe(true); expect(validDate('2026-99-99')).toBe(false); });
  it('не ділить на нуль у порівнянні', () => { expect(comparison(52400,0)).toBeNull(); expect(comparison(150,100)).toBe(50); expect(comparison(0,100)).toBe(-100); });
});
describe('Резервні копії та збереження', () => {
  it('засіває один раз та зберігає редагування після перезавантаження', () => { const s = new MemoryStorage(); const repo = new LocalTransactionRepository(s); const rows = repo.load(); repo.save(rows.filter(t => t.id !== 'seed-vinted')); expect(new LocalTransactionRepository(s).load()).toHaveLength(3); });
  it('не повертає видалені операції у порожнє сховище', () => { const s = new MemoryStorage(); const repo = new LocalTransactionRepository(s); repo.load(); repo.save([]); expect(repo.load()).toEqual([]); });
  it('зберігає оригінальний USD, курс і фактичний PLN', () => { const data = validateBackup(JSON.parse(JSON.stringify({version:1,transactions:clone()}))); expect(data.transactions[0]).toMatchObject({amount:12000,currency:'USD',amountPln:45900,exchangeRate:3.825}); });
  it('відхиляє дублікати ID та джерела перенесення', () => { const rows = clone(); expect(() => validateBackup({version:1,transactions:[...rows,rows[0]]})).toThrow(); const carry = {...rows[3],id:'new-id'}; expect(() => validateBackup({version:1,transactions:[...rows,carry]})).toThrow(); });
  it('відхиляє некоректні суми, дати та курси', () => { for(const patch of [{amountPln:-1},{date:'2026-02-30'},{exchangeRate:4},{amountPln:1.2}]) { const rows=clone(); Object.assign(rows[0],patch); expect(() => validateBackup({version:1,transactions:rows})).toThrow(); } });
  it('не перезаписує пошкоджені дані початковими', () => { const s=new MemoryStorage(); s.setItem(STORAGE_KEY,'broken'); expect(() => new LocalTransactionRepository(s).load()).toThrow(); expect(s.getItem(STORAGE_KEY)).toBe('broken'); });
  it('CSV захищає формули та екранує лапки і переноси', () => { const row:Transaction={...clone()[0],description:'=HYPERLINK("x")\nline'}; const csv=toCsv([row]); expect(csv).toContain('"\'=HYPERLINK(""x"")\nline"'); expect(csv).toContain('"459.00"'); });
});
