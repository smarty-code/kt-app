import { Collection, MongoClient } from "mongodb";

export type StatusEvent = {
  id: string;
  deviceId: string;
  recordedAt: number;
  receivedAt: Date;
  devicePoweredOn: boolean;
  screenOn: boolean;
  unlocked: boolean;
  activity: string;
  batteryPercent: number | null;
  batteryState: string;
  foregroundApp: string | null;
  notifications: PostedNotification[];
};

export type PostedNotification = {
  app: string;
  title: string;
  text: string;
};

export type ForegroundAppSample = {
  id: string;
  deviceId: string;
  packageName: string;
  appName: string;
  collectedAt: number;
  receivedAt: Date;
};

export type DeviceNotification = {
  id: string;
  deviceId: string;
  appName: string;
  title: string;
  text: string;
  subText: string;
  postedAt: number;
  updatedAt: number;
  active: boolean;
  removedAt: number | null;
  receivedAt: Date;
};

const MONGODB_URI =
  "mongodb+srv://smartyamit067_db_user:dECIRf3Rk9Iyok8W@cluster0.n9fnime.mongodb.net/";

const globalForMongo = globalThis as unknown as {
  mongoClient?: Promise<MongoClient>;
  eventsIndex?: Promise<void>;
  notificationIndex?: Promise<void>;
  foregroundAppIndex?: Promise<void>;
  deletedNotificationIndex?: Promise<void>;
};

export async function statusEvents(): Promise<Collection<StatusEvent>> {
  if (!globalForMongo.mongoClient) {
    const client = new MongoClient(MONGODB_URI);
    globalForMongo.mongoClient = client.connect();
  }

  const client = await globalForMongo.mongoClient;
  const databaseName = process.env.MONGODB_DB || "kt_app";
  const collection = client.db(databaseName).collection<StatusEvent>("status_events");

  if (!globalForMongo.eventsIndex) {
    globalForMongo.eventsIndex = collection
      .createIndex({ id: 1 }, { unique: true })
      .then(() => undefined);
  }
  await globalForMongo.eventsIndex;

  return collection;
}

export async function deviceNotifications(): Promise<Collection<DeviceNotification>> {
  if (!globalForMongo.mongoClient) {
    const client = new MongoClient(MONGODB_URI);
    globalForMongo.mongoClient = client.connect();
  }
  const client = await globalForMongo.mongoClient;
  const databaseName = process.env.MONGODB_DB || "kt_app";
  const collection = client.db(databaseName).collection<DeviceNotification>("device_notifications");
  if (!globalForMongo.notificationIndex) {
    globalForMongo.notificationIndex = collection
      .createIndex({ id: 1 }, { unique: true })
      .then(() => undefined);
  }
  await globalForMongo.notificationIndex;
  return collection;
}

export async function foregroundApps(): Promise<Collection<ForegroundAppSample>> {
  const client = await mongoClient();
  const databaseName = process.env.MONGODB_DB || "kt_app";
  const collection = client.db(databaseName).collection<ForegroundAppSample>("foreground_apps");
  if (!globalForMongo.foregroundAppIndex) {
    globalForMongo.foregroundAppIndex = collection
      .createIndex({ id: 1 }, { unique: true })
      .then(() => undefined);
  }
  await globalForMongo.foregroundAppIndex;
  return collection;
}

export async function deletedNotificationIds(): Promise<Collection<{ id: string }>> {
  const client = await mongoClient();
  const databaseName = process.env.MONGODB_DB || "kt_app";
  const collection = client.db(databaseName).collection<{ id: string }>("deleted_notification_ids");
  if (!globalForMongo.deletedNotificationIndex) {
    globalForMongo.deletedNotificationIndex = collection
      .createIndex({ id: 1 }, { unique: true })
      .then(() => undefined);
  }
  await globalForMongo.deletedNotificationIndex;
  return collection;
}

async function mongoClient(): Promise<MongoClient> {
  if (!globalForMongo.mongoClient) {
    const client = new MongoClient(MONGODB_URI);
    globalForMongo.mongoClient = client.connect();
  }
  return globalForMongo.mongoClient;
}
