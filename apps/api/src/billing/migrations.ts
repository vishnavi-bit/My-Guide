// Schema of the billing feature (WI-004). Every table is tenant-scoped: the tenant column leads every key.
import type { Migration } from '../db/migrate';

export const billingMigrations: Migration[] = [
  {
    id: '0001-billing',
    sql: `
      CREATE TABLE billing_balances (tenant_id TEXT NOT NULL, subject_id TEXT NOT NULL, free_queries INTEGER NOT NULL, bonus_credits INTEGER NOT NULL, PRIMARY KEY (tenant_id, subject_id));
      CREATE TABLE billing_bonus_grants (tenant_id TEXT NOT NULL, user_id TEXT NOT NULL, granted_at TEXT NOT NULL, PRIMARY KEY (tenant_id, user_id));
      CREATE TABLE billing_whatsapp (tenant_id TEXT NOT NULL, user_id TEXT NOT NULL, phone TEXT NOT NULL, code_hash TEXT NOT NULL, code_expires_at INTEGER NOT NULL, attempts INTEGER NOT NULL, verified_at INTEGER, PRIMARY KEY (tenant_id, user_id));
      CREATE TABLE billing_settings (tenant_id TEXT NOT NULL, key TEXT NOT NULL, value TEXT NOT NULL, PRIMARY KEY (tenant_id, key))
    `
  }
];
