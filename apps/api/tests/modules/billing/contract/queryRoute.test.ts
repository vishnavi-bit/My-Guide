import { AddressInfo } from 'net';
import { createApp } from '../../../../src/http/app';
import { createDb, Db } from '../../../../src/db/client';
import { migrate } from '../../../../src/db/migrate';
import { billingMigrations } from '../../../../src/billing/migrations';
import { FREE_QUERY_ALLOWANCE, setSetting } from '../../../../src/billing/ledger';
import { createQueryRoute } from '../../../../src/billing/queryRoute';
import { stubQueryEngine, QueryEngine } from '../../../../src/billing/queryEngine';

const GUEST = 'browser-query-1';

async function withApp(engine: QueryEngine, run: (base: string, db: Db) => Promise<void>) {
  const db = createDb({ url: ':memory:' });
  await migrate(db, billingMigrations);
  const app = createApp({
    routes: [createQueryRoute({ engine })],
    middleware: [{ id: 'tenant', handler: (req: any, _res: any, next: () => void) => { req.tenantId = 't1'; next(); } }],
    providers: [{ id: 'db', register: (a: any) => a.set('db', db) }]
  } as any);
  const server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  try {
    await run(`http://127.0.0.1:${(server.address() as AddressInfo).port}`, db);
  } finally {
    await new Promise((r) => server.close(r));
  }
}

const ask = (base: string, body: unknown, guest: string | null = GUEST) =>
  fetch(`${base}/api/billing/query`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(guest ? { 'x-guest-id': guest } : {}) },
    body: JSON.stringify(body)
  });

const usefulEngine = (useful: boolean): QueryEngine => ({ answer: async () => ({ text: 'an answer', useful }) });

describe('query endpoint contract', () => {
  it('answers and charges a free query for a useful answer', async () => {
    await withApp(usefulEngine(true), async (base) => {
      const res = await ask(base, { question: 'how do I start?' });
      expect(res.status).toBe(200);
      expect(await res.json()).toMatchObject({ answer: 'an answer', charge: 'free', balance: { freeQueries: FREE_QUERY_ALLOWANCE - 1 } });
    });
  });

  it('the request cannot claim that an answer is useful: a body field is ignored', async () => {
    await withApp(usefulEngine(false), async (base) => {
      const res = await ask(base, { question: 'hi', useful: true });
      expect(await res.json()).toMatchObject({ charge: 'not-charged', balance: { freeQueries: FREE_QUERY_ALLOWANCE } });
    });
  });

  it('after the allowance is used, the answer is withheld and the exact price is quoted', async () => {
    await withApp(usefulEngine(true), async (base, db) => {
      await setSetting(db, 't1', 'query_price_cents', '250');
      for (let i = 0; i < FREE_QUERY_ALLOWANCE; i++) await ask(base, { question: 'q' });
      const res = await ask(base, { question: 'one more' });
      const body = await res.json();
      expect(res.status).toBe(402);
      expect(body).toEqual({
        error: 'payment-required',
        quote: { priceCents: 250, receives: { answeredQueries: 1 } },
        balance: { freeQueries: 0, bonusCredits: 0, priceCents: 250 }
      });
      expect(body.answer).toBeUndefined();
    });
  });

  it('no price is quoted when none is configured, and nothing is charged', async () => {
    await withApp(usefulEngine(true), async (base) => {
      for (let i = 0; i < FREE_QUERY_ALLOWANCE; i++) await ask(base, { question: 'q' });
      const res = await ask(base, { question: 'one more' });
      expect(res.status).toBe(503);
      expect(await res.json()).toEqual({ error: 'price-not-configured' });
    });
  });

  it('the stub engine answers 503 and nothing is charged', async () => {
    await withApp(stubQueryEngine, async (base, db) => {
      const res = await ask(base, { question: 'anything' });
      expect(res.status).toBe(503);
      expect(await res.json()).toEqual({ error: 'query-engine-not-configured' });
      const { getBalance } = await import('../../../../src/billing/ledger');
      expect((await getBalance(db, 't1', { kind: 'guest', id: GUEST })).freeQueries).toBe(FREE_QUERY_ALLOWANCE);
    });
  });

  it('every answered query writes one audit entry with the charge kind the engine decided', async () => {
    const write = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    let written: string[] = [];
    try {
      await withApp(usefulEngine(true), async (base) => { await ask(base, { question: 'q' }); });
      await withApp(usefulEngine(false), async (base) => { await ask(base, { question: 'hi', useful: true }); });
      written = write.mock.calls.map((c) => String(c[0]));
    } finally {
      write.mockRestore();
    }
    const lines = written.filter((l) => l.includes('"action":"billing.charge"'));
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain('"charge":"free"');
    expect(lines[1]).toContain('"charge":"not-charged"');
  });

  it('a question is required, and a guest must identify its browser', async () => {
    await withApp(usefulEngine(true), async (base) => {
      expect((await ask(base, {})).status).toBe(422);
      expect((await ask(base, { question: '   ' })).status).toBe(422);
      expect((await ask(base, { question: 'x'.repeat(2001) })).status).toBe(422);
      expect((await ask(base, { question: 'hi' }, null)).status).toBe(401);
    });
  });
});
