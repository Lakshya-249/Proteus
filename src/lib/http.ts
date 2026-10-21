import { API_BASE_URL } from "../config";

/** Turn a failed fetch Response into a short, human-readable message. */
export async function readError(
  response: Response,
  fallback = `Request failed (${response.status}).`,
): Promise<string> {
  try {
    const data = await response.json();
    if (typeof data?.detail === "string") return data.detail;
    // FastAPI validation errors arrive as a list.
    if (Array.isArray(data?.detail) && data.detail[0]?.msg) return data.detail[0].msg;
  } catch {
    // Not JSON: keep the fallback.
  }
  if (response.status === 429) return "Too many requests. Please wait a moment and try again.";
  return fallback;
}

interface PostOptions {
  signal?: AbortSignal;
  fallbackError?: string;
}

export async function postJson<T>(
  path: string,
  body: unknown,
  { signal, fallbackError }: PostOptions = {},
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!response.ok) throw new Error(await readError(response, fallbackError));
  return (await response.json()) as T;
}
