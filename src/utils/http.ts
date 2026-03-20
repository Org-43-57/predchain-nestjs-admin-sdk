export class PredchainAdminSdkError extends Error {
  constructor(
    message: string,
    readonly statusCode?: number,
    readonly payload?: unknown,
  ) {
    super(message);
  }
}

export async function requestJson<T>(
  method: string,
  url: string,
  timeoutMs: number,
  body?: unknown,
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method,
      headers: {
        Accept: "application/json",
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
    const raw = await response.text();
    const payload = raw ? JSON.parse(raw) : {};
    if (!response.ok) {
      const message =
        (payload && typeof payload === "object" && "message" in payload && String((payload as { message?: unknown }).message)) ||
        (payload && typeof payload === "object" && "error" in payload && String((payload as { error?: unknown }).error)) ||
        raw ||
        `request failed with status ${response.status}`;
      throw new PredchainAdminSdkError(message, response.status, payload);
    }
    if (payload && typeof payload === "object" && "error" in payload && (payload as { error?: unknown }).error) {
      throw new PredchainAdminSdkError(String((payload as { error?: unknown }).error), 502, payload);
    }
    return payload as T;
  } catch (error) {
    if (error instanceof PredchainAdminSdkError) {
      throw error;
    }
    throw new PredchainAdminSdkError(
      error instanceof Error ? error.message : "request failed",
      0,
      undefined,
    );
  } finally {
    clearTimeout(timeout);
  }
}
