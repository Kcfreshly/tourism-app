export interface ActorRepository {
  findAccount(id: string): Promise<{
    id: string;
    role: string;
    email: string;
  } | null>;
}
