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
  const { app, keepAlive } = makeApp({ connection });

  const port = envs.port;
  const server = app.listen(port, () => {
    console.log(`Server listening on http://localhost:${port}`);
    keepAlive.start();
  });

  const shutdown = async (): Promise<void> => {
    keepAlive.stop();
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
