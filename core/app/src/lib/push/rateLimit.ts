import { hasUpstashConfig, upstashCommand } from "@/lib/push/upstash";

interface RateLimitResult {
  ok: boolean;
  retryAfterSeconds: number;
}

const localBuckets = new Map<string, { count: number; resetAt: number }>();

export async function checkPushRateLimit(
  key: string,
  limit: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  const safeKey = key.replace(/[^a-zA-Z0-9:_-]/g, "_").slice(0, 160);

  if (hasUpstashConfig()) {
    const redisKey = `fuelplan:push:rate:${safeKey}`;
    const count = Number(await upstashCommand<number>(["INCR", redisKey]));

    if (count === 1) {
      await upstashCommand<number>(["EXPIRE", redisKey, windowSeconds]);
    }

    return {
      ok: count <= limit,
      retryAfterSeconds: windowSeconds
    };
  }

  const now = Date.now();
  const resetAt = now + windowSeconds * 1000;
  const bucket = localBuckets.get(safeKey);

  if (!bucket || bucket.resetAt <= now) {
    localBuckets.set(safeKey, { count: 1, resetAt });
    return { ok: true, retryAfterSeconds: windowSeconds };
  }

  bucket.count += 1;

  return {
    ok: bucket.count <= limit,
    retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000)
  };
}
