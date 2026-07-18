import {
  connectDatabase,
  disconnectDatabase,
} from '@configs/database/mongoose/database-connection';
import { makeApp } from './app';
import envs from './configs/envs';

async function bootstrap(): Promise<void> {
  const uri = envs.mongoUri;
  if (!uri) {
    throw new Error('DATABASE_HOST environment variable is required');
  }

  const connection = await connectDatabase({ uri });
  const app = makeApp({ connection });

  const port = envs.port;
  const server = app.listen(port, () => {
    console.log(`Server listening on http://localhost:${port}`);
  });

  const shutdown = async (): Promise<void> => {
    server.close();
    await disconnectDatabase(connection);
    process.exit(0);
  };

  // Handle shutdown signals
  process.on('SIGINT', () => {
    void shutdown();
  });
  process.on('SIGTERM', () => {
    void shutdown();
  });
}

bootstrap().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
