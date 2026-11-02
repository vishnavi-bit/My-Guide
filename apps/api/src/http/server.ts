import { Server } from 'http';
import { createApp } from './app';
import { routes } from '../glue/routes';
import { middleware } from '../glue/middleware';
import { providers } from '../glue/providers';
import { migrate } from '../db/migrate';
import { Db } from '../db/client';
import { billingMigrations } from '../billing/migrations';

// Starts the app on PORT (default 3000). Pass 0 to get a free port (tests). Migrations run before the port opens.
export async function start(port: number = Number(process.env.PORT ?? 3000)): Promise<Server> {
  const app = createApp({ routes, middleware, providers } as any);
  await migrate(app.get('db') as Db, billingMigrations);
  return new Promise((resolve, reject) => {
    // Express 5 passes a listen error (e.g. EADDRINUSE) to this callback; Express 4 only emitted it on the server.
    const server = app.listen(port, (err?: Error) => (err ? reject(err) : resolve(server)));
    server.on('error', reject);
  });
}
