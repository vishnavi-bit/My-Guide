// Entry point: starts the HTTP server on PORT (default 3000) with the scaffold glue.
import { start } from './http/server';

start()
  .then((server) => {
    const { port } = server.address() as { port: number };
    console.log(`api listening on http://localhost:${port}`);
  })
  .catch((err) => {
    console.error('api failed to start', err);
    process.exit(1);
  });
