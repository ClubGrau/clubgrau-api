import mongoose, { Connection } from 'mongoose';

export type ConnectDatabaseOptions = {
  uri: string;
};

/**
 * Abre uma Connection Mongoose isolada (não usa o singleton default).
 * Ideal para injetar em modules (ex.: makeEmployeesModule({ connection })).
 */
export async function connectDatabase({
  uri,
}: ConnectDatabaseOptions): Promise<Connection> {
  if (!uri?.trim()) {
    throw new Error(
      'MongoDB URI is required to establish a database connection',
    );
  }

  const connection = mongoose.createConnection(uri);

  connection.on('error', (error: Error) => {
    console.error('[mongoose] connection error:', error.message);
  });

  await connection.asPromise();

  console.log(`[MONGOOSE] connected to ${connection.name}`);

  return connection;
}

export async function disconnectDatabase(
  connection: Connection,
): Promise<void> {
  if (connection.readyState !== 0) {
    await connection.close();
  }
}
