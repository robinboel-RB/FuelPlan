import { createHash } from "crypto";
import { del, get, list, put } from "@vercel/blob";
import type { PushSubscription } from "web-push";
import { hasUpstashConfig, upstashCommand } from "@/lib/push/upstash";

export type PushSubscriptionStatus = "active" | "revoked" | "failed";
export type PushSubscriptionStorageMode = "blob" | "upstash" | "memory";

export interface StoredPushSubscription {
  key: string;
  installId: string;
  deviceId: string;
  userId: string;
  secretHash: string;
  endpoint: string;
  endpointHash: string;
  subscription: PushSubscription;
  status: PushSubscriptionStatus;
  createdAt: number;
  updatedAt: number;
  lastSuccessAt?: number;
  lastFailureAt?: number;
  failureCount: number;
}

export interface SavePushSubscriptionInput {
  installId: string;
  deviceId: string;
  userId?: string;
  secretHash: string;
  subscription: PushSubscription;
}

export interface PushSubscriptionStore {
  upsert(input: SavePushSubscriptionInput): Promise<StoredPushSubscription>;
  getByOwner(installId: string, deviceId: string): Promise<StoredPushSubscription | null>;
  removeByOwner(installId: string, deviceId: string): Promise<boolean>;
  removeByEndpoint(endpoint: string): Promise<boolean>;
  markSuccess(installId: string, deviceId: string): Promise<void>;
  markFailure(
    installId: string,
    deviceId: string,
    options?: { permanent?: boolean }
  ): Promise<void>;
  listActive(limit?: number): Promise<StoredPushSubscription[]>;
  countActive(): Promise<number>;
}

const ACTIVE_SET_KEY = "fuelplan:push:subscriptions:active";
const BLOB_SUBSCRIPTIONS_PREFIX = "fuelplan/push/subscriptions/";
const BLOB_ENDPOINTS_PREFIX = "fuelplan/push/endpoints/";
const DEFAULT_USER_ID = "anonymous";

let store: PushSubscriptionStore | null = null;

export function getPushSubscriptionStore() {
  if (!store) {
    store = hasBlobConfig()
      ? new BlobPushSubscriptionStore()
      : hasUpstashConfig()
        ? new UpstashPushSubscriptionStore()
        : new LocalMemoryPushSubscriptionStore();
  }

  return store;
}

export function getPushSubscriptionStorageMode(): PushSubscriptionStorageMode {
  if (hasBlobConfig()) {
    return "blob";
  }

  return hasUpstashConfig() ? "upstash" : "memory";
}

export function parsePushSubscription(value: unknown): PushSubscription | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Partial<PushSubscription>;

  if (
    typeof candidate.endpoint !== "string" ||
    !candidate.endpoint ||
    !candidate.keys ||
    typeof candidate.keys.p256dh !== "string" ||
    typeof candidate.keys.auth !== "string"
  ) {
    return null;
  }

  return {
    endpoint: candidate.endpoint,
    expirationTime:
      typeof candidate.expirationTime === "number" ? candidate.expirationTime : null,
    keys: {
      p256dh: candidate.keys.p256dh,
      auth: candidate.keys.auth
    }
  };
}

class LocalMemoryPushSubscriptionStore implements PushSubscriptionStore {
  private records = new Map<string, StoredPushSubscription>();
  private endpoints = new Map<string, string>();

  async upsert(input: SavePushSubscriptionInput) {
    const now = Date.now();
    const key = createOwnerKey(input.installId, input.deviceId);
    const endpointHash = hashEndpoint(input.subscription.endpoint);
    const existing = this.records.get(key);

    const record: StoredPushSubscription = {
      key,
      installId: input.installId,
      deviceId: input.deviceId,
      userId: input.userId || DEFAULT_USER_ID,
      secretHash: input.secretHash,
      endpoint: input.subscription.endpoint,
      endpointHash,
      subscription: input.subscription,
      status: "active",
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      lastSuccessAt: existing?.lastSuccessAt,
      lastFailureAt: existing?.lastFailureAt,
      failureCount: existing?.failureCount ?? 0
    };

    this.records.set(key, record);
    this.endpoints.set(endpointHash, key);
    return record;
  }

  async getByOwner(installId: string, deviceId: string) {
    return this.records.get(createOwnerKey(installId, deviceId)) || null;
  }

  async removeByOwner(installId: string, deviceId: string) {
    const key = createOwnerKey(installId, deviceId);
    const record = this.records.get(key);

    if (record) {
      this.endpoints.delete(record.endpointHash);
    }

    return this.records.delete(key);
  }

  async removeByEndpoint(endpoint: string) {
    const endpointHash = hashEndpoint(endpoint);
    const ownerKey = this.endpoints.get(endpointHash);

    if (!ownerKey) {
      return false;
    }

    this.endpoints.delete(endpointHash);
    return this.records.delete(ownerKey);
  }

  async markSuccess(installId: string, deviceId: string) {
    const record = await this.getByOwner(installId, deviceId);

    if (!record) {
      return;
    }

    this.records.set(record.key, {
      ...record,
      status: "active",
      updatedAt: Date.now(),
      lastSuccessAt: Date.now(),
      failureCount: 0
    });
  }

  async markFailure(
    installId: string,
    deviceId: string,
    options: { permanent?: boolean } = {}
  ) {
    const record = await this.getByOwner(installId, deviceId);

    if (!record) {
      return;
    }

    this.records.set(record.key, {
      ...record,
      status: options.permanent ? "revoked" : "failed",
      updatedAt: Date.now(),
      lastFailureAt: Date.now(),
      failureCount: record.failureCount + 1
    });
  }

  async listActive(limit = 100) {
    return [...this.records.values()]
      .filter((record) => record.status === "active")
      .slice(0, limit);
  }

  async countActive() {
    return (await this.listActive()).length;
  }
}

class BlobPushSubscriptionStore implements PushSubscriptionStore {
  async upsert(input: SavePushSubscriptionInput) {
    const now = Date.now();
    const key = createOwnerKey(input.installId, input.deviceId);
    const endpointHash = hashEndpoint(input.subscription.endpoint);
    const existing = await this.getByOwner(input.installId, input.deviceId);

    const record: StoredPushSubscription = {
      key,
      installId: input.installId,
      deviceId: input.deviceId,
      userId: input.userId || DEFAULT_USER_ID,
      secretHash: input.secretHash,
      endpoint: input.subscription.endpoint,
      endpointHash,
      subscription: input.subscription,
      status: "active",
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      lastSuccessAt: existing?.lastSuccessAt,
      lastFailureAt: existing?.lastFailureAt,
      failureCount: existing?.failureCount ?? 0
    };

    await putJson(createOwnerBlobPath(input.installId, input.deviceId), record);
    await putJson(createEndpointBlobPath(endpointHash), {
      installId: input.installId,
      deviceId: input.deviceId
    });

    return record;
  }

  async getByOwner(installId: string, deviceId: string) {
    return getJson<StoredPushSubscription>(createOwnerBlobPath(installId, deviceId));
  }

  async removeByOwner(installId: string, deviceId: string) {
    const record = await this.getByOwner(installId, deviceId);
    const paths = [createOwnerBlobPath(installId, deviceId)];

    if (record) {
      paths.push(createEndpointBlobPath(record.endpointHash));
    }

    await del(paths);
    return Boolean(record);
  }

  async removeByEndpoint(endpoint: string) {
    const endpointHash = hashEndpoint(endpoint);
    const endpointPath = createEndpointBlobPath(endpointHash);
    const owner = await getJson<{ installId: string; deviceId: string }>(endpointPath);

    if (!owner) {
      return false;
    }

    await del([endpointPath, createOwnerBlobPath(owner.installId, owner.deviceId)]);
    return true;
  }

  async markSuccess(installId: string, deviceId: string) {
    await this.updateRecord(installId, deviceId, (record) => ({
      ...record,
      status: "active",
      updatedAt: Date.now(),
      lastSuccessAt: Date.now(),
      failureCount: 0
    }));
  }

  async markFailure(
    installId: string,
    deviceId: string,
    options: { permanent?: boolean } = {}
  ) {
    await this.updateRecord(installId, deviceId, (record) => ({
      ...record,
      status: options.permanent ? "revoked" : "failed",
      updatedAt: Date.now(),
      lastFailureAt: Date.now(),
      failureCount: record.failureCount + 1
    }));
  }

  async listActive(limit = 100) {
    const result = await list({ prefix: BLOB_SUBSCRIPTIONS_PREFIX, limit });
    const records = await Promise.all(
      result.blobs.map((blob) => getJson<StoredPushSubscription>(blob.pathname))
    );

    return records.filter(
      (record): record is StoredPushSubscription => record?.status === "active"
    );
  }

  async countActive() {
    return (await this.listActive()).length;
  }

  private async updateRecord(
    installId: string,
    deviceId: string,
    update: (record: StoredPushSubscription) => StoredPushSubscription
  ) {
    const record = await this.getByOwner(installId, deviceId);

    if (!record) {
      return;
    }

    await putJson(createOwnerBlobPath(installId, deviceId), update(record));
  }
}

class UpstashPushSubscriptionStore implements PushSubscriptionStore {
  async upsert(input: SavePushSubscriptionInput) {
    const now = Date.now();
    const key = createOwnerKey(input.installId, input.deviceId);
    const endpointHash = hashEndpoint(input.subscription.endpoint);
    const existing = await this.getByOwner(input.installId, input.deviceId);

    const record: StoredPushSubscription = {
      key,
      installId: input.installId,
      deviceId: input.deviceId,
      userId: input.userId || DEFAULT_USER_ID,
      secretHash: input.secretHash,
      endpoint: input.subscription.endpoint,
      endpointHash,
      subscription: input.subscription,
      status: "active",
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      lastSuccessAt: existing?.lastSuccessAt,
      lastFailureAt: existing?.lastFailureAt,
      failureCount: existing?.failureCount ?? 0
    };

    await upstashCommand<string>(["SET", key, JSON.stringify(record)]);
    await upstashCommand<string>(["SET", createEndpointKey(endpointHash), key]);
    await upstashCommand<number>(["SADD", ACTIVE_SET_KEY, key]);

    return record;
  }

  async getByOwner(installId: string, deviceId: string) {
    const value = await upstashCommand<string | null>([
      "GET",
      createOwnerKey(installId, deviceId)
    ]);

    return parseStoredRecord(value);
  }

  async removeByOwner(installId: string, deviceId: string) {
    const key = createOwnerKey(installId, deviceId);
    const record = await this.getByOwner(installId, deviceId);

    if (record) {
      await upstashCommand<number>(["DEL", createEndpointKey(record.endpointHash)]);
    }

    await upstashCommand<number>(["SREM", ACTIVE_SET_KEY, key]);
    const deleted = await upstashCommand<number>(["DEL", key]);
    return Number(deleted) > 0;
  }

  async removeByEndpoint(endpoint: string) {
    const endpointHash = hashEndpoint(endpoint);
    const endpointKey = createEndpointKey(endpointHash);
    const ownerKey = await upstashCommand<string | null>(["GET", endpointKey]);

    if (!ownerKey) {
      return false;
    }

    await upstashCommand<number>(["DEL", endpointKey]);
    await upstashCommand<number>(["SREM", ACTIVE_SET_KEY, ownerKey]);
    const deleted = await upstashCommand<number>(["DEL", ownerKey]);
    return Number(deleted) > 0;
  }

  async markSuccess(installId: string, deviceId: string) {
    await this.updateRecord(installId, deviceId, (record) => ({
      ...record,
      status: "active",
      updatedAt: Date.now(),
      lastSuccessAt: Date.now(),
      failureCount: 0
    }));
  }

  async markFailure(
    installId: string,
    deviceId: string,
    options: { permanent?: boolean } = {}
  ) {
    await this.updateRecord(installId, deviceId, (record) => ({
      ...record,
      status: options.permanent ? "revoked" : "failed",
      updatedAt: Date.now(),
      lastFailureAt: Date.now(),
      failureCount: record.failureCount + 1
    }));
  }

  async listActive(limit = 100) {
    const keys = await upstashCommand<string[]>(["SMEMBERS", ACTIVE_SET_KEY]);

    if (!keys?.length) {
      return [];
    }

    const selectedKeys = keys.slice(0, limit);
    const values = await upstashCommand<Array<string | null>>(["MGET", ...selectedKeys]);

    return values
      .map((value) => parseStoredRecord(value))
      .filter((record): record is StoredPushSubscription => record?.status === "active");
  }

  async countActive() {
    return (await this.listActive()).length;
  }

  private async updateRecord(
    installId: string,
    deviceId: string,
    update: (record: StoredPushSubscription) => StoredPushSubscription
  ) {
    const record = await this.getByOwner(installId, deviceId);

    if (!record) {
      return;
    }

    const nextRecord = update(record);
    await upstashCommand<string>(["SET", record.key, JSON.stringify(nextRecord)]);
  }
}

function parseStoredRecord(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as StoredPushSubscription;
    return parsed;
  } catch {
    return null;
  }
}

function createOwnerKey(installId: string, deviceId: string) {
  return `fuelplan:push:subscription:${installId}:${deviceId}`;
}

function createOwnerBlobPath(installId: string, deviceId: string) {
  return `${BLOB_SUBSCRIPTIONS_PREFIX}${sanitizePathSegment(installId)}/${sanitizePathSegment(deviceId)}.json`;
}

function createEndpointKey(endpointHash: string) {
  return `fuelplan:push:endpoint:${endpointHash}`;
}

function createEndpointBlobPath(endpointHash: string) {
  return `${BLOB_ENDPOINTS_PREFIX}${endpointHash}.json`;
}

function hashEndpoint(endpoint: string) {
  return createHash("sha256").update(endpoint).digest("hex");
}

function hasBlobConfig() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

async function putJson(pathname: string, value: unknown) {
  await put(pathname, JSON.stringify(value), {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json"
  });
}

async function getJson<T>(pathname: string) {
  const result = await get(pathname, { access: "private", useCache: false }).catch(
    () => null
  );

  if (!result || result.statusCode !== 200 || !result.stream) {
    return null;
  }

  const text = await readStreamAsText(result.stream);

  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

async function readStreamAsText(stream: ReadableStream<Uint8Array>) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let text = "";

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    text += decoder.decode(value, { stream: true });
  }

  text += decoder.decode();
  return text;
}

function sanitizePathSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 96);
}
