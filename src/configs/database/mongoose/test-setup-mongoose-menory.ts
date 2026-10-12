import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

export const setupMongoMemoryServer = () => {
  let mongo: MongoMemoryServer | undefined;
  beforeAll(async () => {
    mongo = await MongoMemoryServer.create({
      instance: {
        launchTimeout: 60_000,
      },
    });
    const uri = mongo.getUri();
    await mongoose.connect(uri);
  });

  afterEach(async () => {
    const collections = await mongoose.connection.db?.collections();
    if (collections) {
      for (const collection of collections) {
        await collection.deleteMany({});
      }
    }
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongo?.stop();
  });
};
