import { z } from "zod";
import { TmdbError } from "./errors";
import { clearMetadataCache } from "./cache";

const API_ORIGIN = "https://api.themoviedb.org";
let sessionToken = "";
type SessionState = {
  configured: boolean;
  revision: number;
  status: "not_configured" | "untested" | "testing" | "connected" | "error";
  message: string;
};
let snapshot: SessionState = {
  configured: false,
  revision: 0,
  status: "not_configured",
  message: "TMDB is not configured. You can prepare a title manually.",
};
const listeners = new Set<() => void>();
const requests = new Set<AbortController>();
function publish(patch: Partial<SessionState>) {
  snapshot = { ...snapshot, ...patch };
  listeners.forEach((listener) => listener());
}
export const getTmdbSession = () => snapshot;
export function subscribeTmdbSession(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
export function configureTmdbToken(value: string) {
  const token = value.trim();
  if (!token || /\s/.test(token) || token.length > 8192)
    throw new TmdbError(
      "authorization",
      "Paste the Read Access Token only, without the word Bearer or spaces.",
    );
  for (const request of requests) request.abort();
  sessionToken = token;
  clearMetadataCache();
  publish({
    configured: true,
    revision: snapshot.revision + 1,
    status: "untested",
    message:
      "Token held in memory for this session. Test the connection to verify it.",
  });
}
export function removeTmdbToken() {
  for (const request of requests) request.abort();
  sessionToken = "";
  clearMetadataCache();
  publish({
    configured: false,
    revision: snapshot.revision + 1,
    status: "not_configured",
    message:
      "TMDB is not configured. Manual drafts and local records remain available.",
  });
}

/** The fixed origin, allowlist, and redirect rejection keep credentials on TMDB. */
export async function tmdbGet<S extends z.ZodType>(
  path: string,
  schema: S,
  params: Record<string, string> = {},
  signal?: AbortSignal,
): Promise<z.output<S>> {
  if (!sessionToken)
    throw new TmdbError(
      "missing_token",
      "Configure a TMDB Read Access Token in Settings, or enter a title manually.",
    );
  if (
    !/^\/(authentication|search\/(movie|tv|multi)|(movie|tv)\/[1-9]\d*)$/.test(
      path,
    )
  )
    throw new TmdbError(
      "invalid_response",
      "This TMDB operation is not supported.",
    );
  const url = new URL(`/3${path}`, API_ORIGIN);
  for (const [key, value] of Object.entries(params))
    url.searchParams.set(key, value);
  const controller = new AbortController();
  const requestRevision = snapshot.revision;
  requests.add(controller);
  const timeout = AbortSignal.timeout(10_000);
  const signals = [controller.signal, timeout, ...(signal ? [signal] : [])];
  try {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${sessionToken}`,
        Accept: "application/json",
      },
      signal: AbortSignal.any(signals),
      credentials: "omit",
      redirect: "error",
      referrerPolicy: "no-referrer",
      cache: "no-store",
    });
    if (response.status === 401 || response.status === 403) {
      const error = new TmdbError(
        "authorization",
        "TMDB couldn't authorize this token. Check your credentials in Settings.",
      );
      if (
        requestRevision === snapshot.revision &&
        !controller.signal.aborted &&
        !signal?.aborted
      )
        publish({ status: "error", message: error.message });
      throw error;
    }
    if (response.status === 429)
      throw new TmdbError(
        "rate_limit",
        "TMDB is receiving too many requests. Wait a moment before trying again.",
      );
    if (response.status === 404)
      throw new TmdbError(
        "not_found",
        "This title is no longer available from TMDB. You can enter it manually.",
      );
    if (!response.ok)
      throw new TmdbError(
        "server",
        "TMDB is temporarily unavailable. Try again shortly, or continue manually.",
      );
    let data: unknown;
    try {
      data = await response.json();
    } catch {
      throw new TmdbError(
        "invalid_response",
        "TMDB returned an unreadable response. Please try again.",
      );
    }
    const parsed = schema.safeParse(data);
    if (!parsed.success)
      throw new TmdbError(
        "invalid_response",
        "TMDB returned unexpected information. Please try another title or enter it manually.",
      );
    return parsed.data;
  } catch (error) {
    if (signal?.aborted || controller.signal.aborted)
      throw new DOMException("Request cancelled", "AbortError");
    if (timeout.aborted)
      throw new TmdbError(
        "timeout",
        "TMDB took too long to respond. Check your connection and try again.",
      );
    if (error instanceof TmdbError) throw error;
    // Do not surface raw fetch/response errors: they may contain sensitive details.
    throw new TmdbError(
      "network",
      "Unable to connect to TMDB. Check your internet connection. Browser or API access restrictions may also prevent this request.",
    );
  } finally {
    requests.delete(controller);
  }
}

export async function testTmdbConnection(signal?: AbortSignal) {
  const revision = snapshot.revision;
  publish({ status: "testing", message: "Testing your session token…" });
  try {
    const result = await tmdbGet(
      "/authentication",
      z.object({ success: z.literal(true) }),
      {},
      signal,
    );
    if (revision === snapshot.revision)
      publish({
        status: "connected",
        message: "Connected to TMDB. Your token is verified for this session.",
      });
    return result;
  } catch (error) {
    if (revision === snapshot.revision) {
      if (error instanceof DOMException && error.name === "AbortError") {
        publish({
          status: "untested",
          message:
            "Connection test cancelled. You can test your session token again.",
        });
      } else {
        publish({
          status: "error",
          message:
            error instanceof TmdbError
              ? error.message
              : "The connection could not be verified.",
        });
      }
    }
    throw error;
  }
}
