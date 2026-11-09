import { auth } from "../../../infrastructure/auth/better-auth";

// Better Auth serves its own protocol and response format.
export function authController(request: Request) {
  return auth().handler(request);
}
