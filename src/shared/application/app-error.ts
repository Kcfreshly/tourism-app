// A refusal the traveller or staff member can act on. Use cases throw it with
// a kind; only the HTTP layer decides which status code that kind becomes.
export type AppErrorKind =
  | "INVALID"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMITED"
  // A provider we depend on did not answer; retrying may work.
  | "UNAVAILABLE";

export class AppError extends Error {
  constructor(
    public kind: AppErrorKind,
    public code: string,
    message: string,
    // Extra data the client needs to recover, such as a new price breakdown.
    public details?: unknown,
  ) {
    super(message);
  }
}
