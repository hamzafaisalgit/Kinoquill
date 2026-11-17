export type TmdbErrorCode =
  | "missing_token"
  | "authorization"
  | "network"
  | "timeout"
  | "rate_limit"
  | "not_found"
  | "server"
  | "invalid_response";
export class TmdbError extends Error {
  readonly code: TmdbErrorCode;
  constructor(code: TmdbErrorCode, message: string) {
    super(message);
    this.name = "TmdbError";
    this.code = code;
  }
}
export function metadataError(error: unknown): string {
  return error instanceof TmdbError
    ? error.message
    : "This information could not be loaded. Please try again.";
}
