import { createClient, RedisClientType } from "redis";

// ---------------------------------------------------------------------------
// Singleton pattern that survives Next.js hot-reload in development.
// We store the client on `globalThis` so the same instance is reused across
// module re-evaluations in the same Node.js process.
// ---------------------------------------------------------------------------
declare global {
  // eslint-disable-next-line no-var
  var __redisClient: RedisClientType | undefined;
}

function makeClient(): RedisClientType {
  const client = createClient({
    url: process.env.REDIS_URL,
    socket: {
      reconnectStrategy: (retries: number) => {
        // Give up after 3 retries to avoid hanging the request
        if (retries >= 3) return false;
        return Math.min(retries * 200, 1000);
      },
    },
  }) as RedisClientType;

  client.on("error", (err: Error) => {
    console.error("[Redis] error:", err.message);
  });

  return client;
}

if (!globalThis.__redisClient) {
  globalThis.__redisClient = makeClient();
}

const redis: RedisClientType = globalThis.__redisClient;

/**
 * Ensure the client is connected. Returns true if ready, false if unavailable.
 * Safe to call on every request — connect() is a no-op when already open.
 */
export async function ensureConnected(): Promise<boolean> {
  try {
    if (redis.isReady) return true;
    await redis.connect();
    return redis.isReady;
  } catch (err) {
    // ECONNREFUSED or any other connection error — Redis not available
    console.error("[Redis] could not connect:", (err as Error).message);
    return false;
  }
}

export default redis;
