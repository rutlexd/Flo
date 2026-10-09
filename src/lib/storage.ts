import { initialTransactions, validateBackup, type Transaction } from './finance';
export interface TransactionRepository { load(): Transaction[]; save(transactions: Transaction[]): void }
export const STORAGE_KEY = 'flo.finance.v1';
// Replace this adapter with a Supabase repository when authentication and sync are added.
export class LocalTransactionRepository implements TransactionRepository {
  constructor(private storage: Storage) {}
  load() {
    const raw = this.storage.getItem(STORAGE_KEY);
    if (raw !== null) return validateBackup(JSON.parse(raw)).transactions;
    const rows = initialTransactions.map(t => ({ ...t })); this.save(rows); return rows;
  }
  save(transactions: Transaction[]) { this.storage.setItem(STORAGE_KEY, JSON.stringify(validateBackup({ version: 1, transactions }))); }
}
