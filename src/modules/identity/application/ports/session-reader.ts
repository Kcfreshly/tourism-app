export interface SessionReader {
  // The account behind the request's session cookie, if any.
  accountId(headers: Headers): Promise<string | null>;
  signOut(headers: Headers): Promise<void>;
}
