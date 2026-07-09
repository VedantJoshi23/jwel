import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Request } from 'express';
import * as AppleStrategyLib from 'passport-apple';
import * as jwt from 'jsonwebtoken';
import { OAuthProvider } from '@prisma/client';
import { OAuthValidatedProfile } from './oauth-profile';

const PLACEHOLDER = 'not-configured';

interface AppleIdTokenClaims {
  sub: string;
  email?: string;
}

// Apple never fills in `profile` (see passport-apple's own source comment —
// "apple hasn't implemented passing data") and only sends the user's name
// once, as a JSON string in the callback POST body's `user` field, on the
// very first authorization. Everything usable comes from decoding `idToken`
// (already verified by Apple during the code exchange passport-apple
// performs — this is a decode of a token we just received directly from
// Apple over TLS, not a re-verification of an unauthenticated JWT) and, only
// on first login, `req.body.user`.
@Injectable()
export class AppleStrategy extends PassportStrategy(AppleStrategyLib.Strategy, 'apple') {
  constructor(config: ConfigService) {
    super({
      clientID: config.get<string>('APPLE_CLIENT_ID', PLACEHOLDER),
      teamID: config.get<string>('APPLE_TEAM_ID', PLACEHOLDER),
      keyID: config.get<string>('APPLE_KEY_ID', PLACEHOLDER),
      privateKeyString: config.get<string>('APPLE_PRIVATE_KEY', PLACEHOLDER),
      callbackURL: config.get<string>('APPLE_CALLBACK_URL', 'http://localhost:4000/api/v1/auth/apple/callback'),
      passReqToCallback: true,
    } as unknown as ConstructorParameters<typeof AppleStrategyLib.Strategy>[0]);
  }

  validate(
    req: Request,
    _accessToken: string,
    _refreshToken: string,
    idToken: string,
    _profile: unknown,
    done: (err: Error | null, user?: unknown) => void,
  ): void {
    const claims = jwt.decode(idToken) as AppleIdTokenClaims | null;
    if (!claims?.sub) {
      done(new Error('Apple did not return a usable identity token'));
      return;
    }

    // Only present as a raw JSON string in the body, and only on the
    // account's very first authorization — Apple never sends it again.
    let name: string | undefined;
    const rawUser = (req.body as { user?: string } | undefined)?.user;
    if (rawUser) {
      try {
        const parsed = JSON.parse(rawUser) as { name?: { firstName?: string; lastName?: string } };
        name = [parsed.name?.firstName, parsed.name?.lastName].filter(Boolean).join(' ') || undefined;
      } catch {
        name = undefined;
      }
    }

    const validated: OAuthValidatedProfile = {
      provider: OAuthProvider.APPLE,
      providerAccountId: claims.sub,
      email: claims.email,
      name,
    };
    done(null, validated);
  }
}
