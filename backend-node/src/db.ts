import mongoose from 'mongoose';
import { config } from './config';

export async function connectDb(): Promise<void> {
  mongoose.set('strictQuery', false);
  await mongoose.connect(config.mongodbUri, {
    dbName: config.dbName,
    maxPoolSize: 20,
    minPoolSize: 5,
    maxIdleTimeMS: 30_000,
    serverSelectionTimeoutMS: 5_000,
    connectTimeoutMS: 5_000,
  });
  console.log('✅ MongoDB connected');
}

export async function closeDb(): Promise<void> {
  await mongoose.connection.close();
}
