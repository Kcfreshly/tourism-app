// A refusal the traveller or staff member can act on. Use cases throw it with
// a kind; only the HTTP layer decides which status code that kind becomes.
export type AppErrorKind =
  | "INVALID"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMITED";

export class AppError extends Error {
  constructor(
    public kind: AppErrorKind,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
