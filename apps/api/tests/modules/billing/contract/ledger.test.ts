import { createDb, Db } from '../../../../src/db/client';
import { migrate } from '../../../../src/db/migrate';
import { billingMigrations } from '../../../../src/billing/migrations';
import {
  FREE_QUERY_ALLOWANCE,
  WHATSAPP_BONUS_CREDITS,
  getBalance,
  getPriceCents,
  grantWhatsAppBonus,
  recordAnsweredQuery,
  setSetting,
  SETTING_BONUS_ACTIVE,
  transferGuestBalance
} from '../../../../src/billing/ledger';
import { startWhatsAppConnect, verifyWhatsAppCode } from '../../../../src/billing/whatsapp';

const guest = (id: string) => ({ kind: 'guest' as const, id });
const user = (id: string) => ({ kind: 'user' as const, id });

async function freshDb(): Promise<Db> {
  const db = createDb({ url: ':memory:' });
  await migrate(db, billingMigrations);
  return db;
}

describe('billing ledger contract', () => {
  it('a new subject starts with the free allowance and no bonus', async () => {
    const db = await freshDb();
    expect(await getBalance(db, 't1', guest('browser-1'))).toEqual({ freeQueries: FREE_QUERY_ALLOWANCE, bonusCredits: 0, priceCents: null });
  });

  it('a useful answer uses one free query each time, and the balance goes down by one', async () => {
    const db = await freshDb();
    const g = guest('browser-2');
    expect((await recordAnsweredQuery(db, 't1', g, true)).charge).toBe('free');
    const second = await recordAnsweredQuery(db, 't1', g, true);
    expect(second.charge).toBe('free');
    expect(second.balance.freeQueries).toBe(0);
  });

  it('a query without a useful plan is never charged and uses no free query', async () => {
    const db = await freshDb();
    const g = guest('browser-3');
    for (let i = 0; i < 5; i++) expect((await recordAnsweredQuery(db, 't1', g, false)).charge).toBe('not-charged');
    expect((await getBalance(db, 't1', g)).freeQueries).toBe(FREE_QUERY_ALLOWANCE);
  });

  it('after the free allowance is used, a useful answer asks for payment and charges nothing', async () => {
    const db = await freshDb();
    const g = guest('browser-4');
    await recordAnsweredQuery(db, 't1', g, true);
    await recordAnsweredQuery(db, 't1', g, true);
    expect((await recordAnsweredQuery(db, 't1', g, true)).charge).toBe('payment-required');
    expect((await getBalance(db, 't1', g)).freeQueries).toBe(0);
  });

  it('free queries and bonus credits are separate counters: bonus credits are used after the free ones', async () => {
    const db = await freshDb();
    const u = user('alice');
    await setSetting(db, 't1', SETTING_BONUS_ACTIVE, 'true');
    expect(await grantWhatsAppBonus(db, 't1', 'alice')).toBe(true);
    const before = await getBalance(db, 't1', u);
    expect(before).toMatchObject({ freeQueries: FREE_QUERY_ALLOWANCE, bonusCredits: WHATSAPP_BONUS_CREDITS });
    for (let i = 0; i < FREE_QUERY_ALLOWANCE; i++) expect((await recordAnsweredQuery(db, 't1', u, true)).charge).toBe('free');
    expect((await recordAnsweredQuery(db, 't1', u, true)).charge).toBe('bonus');
    expect((await recordAnsweredQuery(db, 't1', u, true)).balance.bonusCredits).toBe(WHATSAPP_BONUS_CREDITS - 2);
  });

  it('the price is quoted from the settings once it is configured', async () => {
    const db = await freshDb();
    expect(await getPriceCents(db, 't1')).toBeNull();
    await setSetting(db, 't1', 'query_price_cents', '250');
    expect(await getPriceCents(db, 't1')).toBe(250);
    await setSetting(db, 't1', 'query_price_cents', 'not-a-number');
    expect(await getPriceCents(db, 't1')).toBeNull();
  });

  it('guest balance moves to the account on sign-up without a reset', async () => {
    const db = await freshDb();
    const g = guest('browser-5');
    await recordAnsweredQuery(db, 't1', g, true);
    expect(await transferGuestBalance(db, 't1', 'browser-5', 'bob')).toBe(1);
    expect(await transferGuestBalance(db, 't1', 'browser-5', 'bob')).toBe(0);         // the guest row is gone: nothing moves twice
    expect((await getBalance(db, 't1', user('bob'))).freeQueries).toBe(1);
  });

  it('a guest with nothing left transfers nothing, and an account that has a balance gains the remainder on top', async () => {
    const db = await freshDb();
    expect(await transferGuestBalance(db, 't1', 'never-seen', 'carol')).toBe(0);
    await recordAnsweredQuery(db, 't1', user('carol'), true);                          // carol already has a balance (1 left)
    await recordAnsweredQuery(db, 't1', guest('browser-6'), true);
    expect(await transferGuestBalance(db, 't1', 'browser-6', 'carol')).toBe(1);
    expect((await getBalance(db, 't1', user('carol'))).freeQueries).toBe(2);
  });

  it('the WhatsApp bonus is granted only while the offer is active, and only once per user', async () => {
    const db = await freshDb();
    expect(await grantWhatsAppBonus(db, 't1', 'dan')).toBe(false);                    // offer off
    await setSetting(db, 't1', SETTING_BONUS_ACTIVE, 'true');
    expect(await grantWhatsAppBonus(db, 't1', 'dan')).toBe(true);
    expect(await grantWhatsAppBonus(db, 't1', 'dan')).toBe(false);
    expect((await getBalance(db, 't1', user('dan'))).bonusCredits).toBe(WHATSAPP_BONUS_CREDITS);
  });

  it('balances and grants are tenant-scoped', async () => {
    const db = await freshDb();
    await recordAnsweredQuery(db, 'tenant-a', guest('browser-7'), true);
    expect((await getBalance(db, 'tenant-b', guest('browser-7'))).freeQueries).toBe(FREE_QUERY_ALLOWANCE);
  });

  it('an invalid tenant is refused before anything is read or charged', async () => {
    const db = await freshDb();
    await expect(recordAnsweredQuery(db, 'bad tenant!', guest('x'), true)).rejects.toThrow(/valid tenant id/);
  });
});

describe('WhatsApp connection contract', () => {
  const sender = () => {
    const sent: { phone: string; code: string }[] = [];
    return { sent, impl: { sendCode: async (phone: string, code: string) => { sent.push({ phone, code }); } } };
  };

  it('refuses to connect when no sender is configured', async () => {
    const db = await freshDb();
    await expect(startWhatsAppConnect(db, 't1', 'erin', '+14155550100', null)).rejects.toMatchObject({ status: 503, message: 'whatsapp-not-configured' });
  });

  it('refuses a number that is not in international format', async () => {
    const db = await freshDb();
    const s = sender();
    await expect(startWhatsAppConnect(db, 't1', 'erin', '0123', s.impl)).rejects.toMatchObject({ status: 422, message: 'invalid-phone' });
    expect(s.sent).toHaveLength(0);
  });

  it('verifies with the sent code and grants the bonus when the offer is active', async () => {
    const db = await freshDb();
    await setSetting(db, 't1', SETTING_BONUS_ACTIVE, 'true');
    const s = sender();
    await startWhatsAppConnect(db, 't1', 'frank', '+14155550101', s.impl, 1_000);
    const { code } = s.sent[0];
    expect(await verifyWhatsAppCode(db, 't1', 'frank', code, 2_000)).toEqual({ verified: true, bonusGranted: true });
    await expect(verifyWhatsAppCode(db, 't1', 'frank', code, 2_000)).rejects.toMatchObject({ status: 409 });   // used up
  });

  it('a wrong code counts as an attempt, and after five wrong codes the connection locks', async () => {
    const db = await freshDb();
    const s = sender();
    await startWhatsAppConnect(db, 't1', 'gina', '+14155550102', s.impl, 1_000);
    const real = s.sent[0].code;
    const wrong = real === '000000' ? '111111' : '000000';
    for (let i = 0; i < 5; i++) await expect(verifyWhatsAppCode(db, 't1', 'gina', wrong, 2_000)).rejects.toMatchObject({ status: 422 });
    await expect(verifyWhatsAppCode(db, 't1', 'gina', real, 2_000)).rejects.toMatchObject({ status: 429, message: 'too-many-attempts' });
  });

  it('an expired code is refused, and a restart replaces the pending code', async () => {
    const db = await freshDb();
    const s = sender();
    await startWhatsAppConnect(db, 't1', 'hank', '+14155550103', s.impl, 1_000);
    await expect(verifyWhatsAppCode(db, 't1', 'hank', s.sent[0].code, 1_000 + 11 * 60 * 1000)).rejects.toMatchObject({ status: 410 });
    await startWhatsAppConnect(db, 't1', 'hank', '+14155550103', s.impl, 2_000);
    await expect(verifyWhatsAppCode(db, 't1', 'hank', s.sent[0].code, 2_500)).rejects.toMatchObject({ status: 422 });   // replaced
    expect(await verifyWhatsAppCode(db, 't1', 'hank', s.sent[1].code, 2_500)).toEqual({ verified: true, bonusGranted: false });
  });

  it('no bonus when the offer is off, and nothing to verify without a connection', async () => {
    const db = await freshDb();
    const s = sender();
    await expect(verifyWhatsAppCode(db, 't1', 'ivy', '123456', 1)).rejects.toMatchObject({ status: 409 });
    await startWhatsAppConnect(db, 't1', 'ivy', '+14155550104', s.impl, 1_000);
    expect(await verifyWhatsAppCode(db, 't1', 'ivy', s.sent[0].code, 1_500)).toEqual({ verified: true, bonusGranted: false });
    expect((await getBalance(db, 't1', user('ivy'))).bonusCredits).toBe(0);
  });
});
