// Legacy guest sessions. They are only read so their drafts can be linked to
// an account; new guest sessions are no longer created.
export interface GuestSessionRepository {
  findActive(token: string): Promise<{ id: string } | null>;
  expire(id: string): Promise<void>;
  // Expires the guest session and moves its drafts to the account in one
  // transaction. Returns 0 when the session was already claimed.
  transferDrafts(guestId: string, accountId: string): Promise<number>;
}
