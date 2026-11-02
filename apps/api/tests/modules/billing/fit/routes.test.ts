import { start } from '../../../../src/http/server';
import { signToken } from '../../../../src/auth/jwt';
import { withEnv } from '../../../../src/testing/testUtils';

const SECRET = 'x'.repeat(40);

// Runs the real app (glue, auth, tenant, audit, cache) on a free port against an in-memory database.
async function withServer(run: (base: string) => Promise<void>) {
  await withEnv({ DATABASE_URL: ':memory:', JWT_SECRET: SECRET, CACHE_TTL_SECONDS: '30' }, async () => {
    const server = await start(0);
    try {
      await run(`http://127.0.0.1:${(server.address() as any).port}`);
    } finally {
      await new Promise((r) => server.close(r));
    }
  });
}

const call = (base: string, method: string, path: string, token?: string, body?: unknown) =>
  fetch(`${base}${path}`, {
    method,
    headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...(body ? { 'content-type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });

describe('billing routes', () => {
  it('shows the balance to a signed-in user and refuses a caller without a tenant', async () => {
    await withServer(async (base) => {
      expect((await call(base, 'GET', '/api/billing/balance')).status).toBe(401);
      const token = await signToken({ userId: 'u1', tenantId: 'tenant-a' }, { secret: SECRET });
      const res = await call(base, 'GET', '/api/billing/balance', token);
      expect(res.status).toBe(200);
      expect(res.headers.get('cache-control')).toBe('no-store');
      expect(await res.json()).toEqual({ freeQueries: 2, bonusCredits: 0, priceCents: null });
    });
  });

  it('only an admin can switch the WhatsApp bonus on and set the price', async () => {
    await withServer(async (base) => {
      const member = await signToken({ userId: 'u2', tenantId: 'tenant-a', roles: ['member'] }, { secret: SECRET });
      const admin = await signToken({ userId: 'admin', tenantId: 'tenant-a', roles: ['admin'] }, { secret: SECRET });
      expect((await call(base, 'PUT', '/api/billing/whatsapp-bonus', member, { active: true })).status).toBe(403);
      expect((await call(base, 'PUT', '/api/billing/whatsapp-bonus', admin, { active: 'yes' })).status).toBe(422);
      expect(await (await call(base, 'PUT', '/api/billing/whatsapp-bonus', admin, { active: true })).json()).toEqual({ whatsappBonusActive: true });
      expect((await call(base, 'PUT', '/api/billing/price', admin, { cents: 1.5 })).status).toBe(422);
      expect(await (await call(base, 'PUT', '/api/billing/price', admin, { cents: 250 })).json()).toEqual({ priceCents: 250 });
      expect(await (await call(base, 'GET', '/api/billing/balance', member)).json()).toMatchObject({ priceCents: 250 });
    });
  });

  it('a WhatsApp connect is refused until a sender is configured, and verifying needs a pending code', async () => {
    await withServer(async (base) => {
      const token = await signToken({ userId: 'u3', tenantId: 'tenant-a' }, { secret: SECRET });
      expect((await call(base, 'POST', '/api/whatsapp/connect', token, { phone: '+14155550100' })).status).toBe(503);
      const verify = await call(base, 'POST', '/api/whatsapp/verify', token, { code: '123456' });
      expect(verify.status).toBe(409);
      expect(await verify.json()).toEqual({ error: 'no-pending-verification' });
      expect((await call(base, 'POST', '/api/whatsapp/connect', undefined, { phone: '+14155550100' })).status).toBe(401);
    });
  });

  it('the guest transfer needs a signed-in user and a valid guest id, moves nothing for an unknown guest, and is audited', async () => {
    await withServer(async (base) => {
      const token = await signToken({ userId: 'u4', tenantId: 'tenant-a' }, { secret: SECRET });
      const transfer = (headers: Record<string, string>) => fetch(`${base}/api/billing/transfer-guest`, { method: 'POST', headers });
      expect((await transfer({ 'x-guest-id': 'browser-unknown-1' })).status).toBe(401);
      expect((await transfer({ authorization: `Bearer ${token}`, 'x-guest-id': 'bad id' })).status).toBe(422);
      const write = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
      try {
        const ok = await transfer({ authorization: `Bearer ${token}`, 'x-guest-id': 'browser-unknown-1' });
        expect(await ok.json()).toEqual({ transferred: 0 });
        expect(write.mock.calls.map((c) => String(c[0])).some((l) => l.includes('"action":"billing.guest-transfer"'))).toBe(true);
      } finally {
        write.mockRestore();
      }
    });
  });
});
