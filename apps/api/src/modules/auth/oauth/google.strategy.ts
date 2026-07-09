import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, StrategyOptions, VerifyCallback, Profile } from 'passport-google-oauth20';
import { OAuthProvider } from '@prisma/client';
import { OAuthValidatedProfile } from './oauth-profile';

// Placeholder client credentials let Nest bootstrap and the strategy
// construct cleanly with no real Google OAuth app registered yet — see
// GoogleConfiguredGuard for the actual "is this really usable" check, which
// runs before Passport ever redirects to Google (same fail-loudly-not-
// silently posture as RazorpayPaymentProviderStub).
const PLACEHOLDER = 'not-configured';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(config: ConfigService) {
    const options: StrategyOptions = {
      clientID: config.get<string>('GOOGLE_CLIENT_ID', PLACEHOLDER),
      clientSecret: config.get<string>('GOOGLE_CLIENT_SECRET', PLACEHOLDER),
      callbackURL: config.get<string>('GOOGLE_CALLBACK_URL', 'http://localhost:4000/api/v1/auth/google/callback'),
      scope: ['email', 'profile'],
    };
    super(options);
  }

  validate(_accessToken: string, _refreshToken: string, profile: Profile, done: VerifyCallback): void {
    const email = profile.emails?.[0]?.value;
    const validated: OAuthValidatedProfile = {
      provider: OAuthProvider.GOOGLE,
      providerAccountId: profile.id,
      email,
      name: profile.displayName,
    };
    done(null, validated as unknown as Express.User);
  }
}
