interface UpstashResponse<T> {
  result?: T;
  error?: string;
}

export function hasUpstashConfig() {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

export async function upstashCommand<T>(args: Array<string | number>) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    throw new Error("Missing Upstash Redis REST configuration");
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(args),
    cache: "no-store"
  });

  const body = (await response.json().catch(() => null)) as UpstashResponse<T> | null;

  if (!response.ok || body?.error) {
    throw new Error(body?.error || "Upstash command failed");
  }

  return body?.result as T;
}
