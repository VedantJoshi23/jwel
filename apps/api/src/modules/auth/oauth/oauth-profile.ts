import { OAuthProvider } from '@prisma/client';

// Common shape every provider strategy normalizes its raw profile into,
// before it ever reaches AuthService. `providerAccountId` is always the
// provider's own opaque subject id, never the email — Apple (and Facebook
// accounts with no verified email) don't guarantee an email on every login,
// so the account link must not depend on one being present after the first
// authorization.
export interface OAuthValidatedProfile {
  provider: OAuthProvider;
  providerAccountId: string;
  email?: string;
  name?: string;
}
