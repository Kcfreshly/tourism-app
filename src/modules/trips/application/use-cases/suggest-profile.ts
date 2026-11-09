import { extractProfile } from "../../domain/intake";
import type { Profile } from "../../domain/profile";

// Kemi's intake: suggests profile changes from free text. Nothing is saved;
// the traveller reviews the suggestion first.
export class SuggestProfile {
  execute(profile: Profile, message: string) {
    return extractProfile(profile, message);
  }
}
