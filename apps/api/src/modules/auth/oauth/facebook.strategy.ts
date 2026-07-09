import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, StrategyOptions, Profile } from 'passport-facebook';
import { OAuthProvider } from '@prisma/client';
import { OAuthValidatedProfile } from './oauth-profile';

const PLACEHOLDER = 'not-configured';

// "Meta" is the company; the product/API is still Facebook Login — this
// strategy name and the FACEBOOK_* env vars match Meta's own developer
// console naming so anyone configuring this later isn't hunting for a
// "META_*" var that doesn't exist there.
@Injectable()
export class FacebookStrategy extends PassportStrategy(Strategy, 'facebook') {
  constructor(config: ConfigService) {
    const options: StrategyOptions = {
      clientID: config.get<string>('FACEBOOK_APP_ID', PLACEHOLDER),
      clientSecret: config.get<string>('FACEBOOK_APP_SECRET', PLACEHOLDER),
      callbackURL: config.get<string>('FACEBOOK_CALLBACK_URL', 'http://localhost:4000/api/v1/auth/facebook/callback'),
      profileFields: ['id', 'displayName', 'emails'],
    };
    super(options);
  }

  validate(_accessToken: string, _refreshToken: string, profile: Profile, done: (error: unknown, user?: unknown) => void): void {
    const email = (profile as Profile & { emails?: Array<{ value: string }> }).emails?.[0]?.value;
    const validated: OAuthValidatedProfile = {
      provider: OAuthProvider.FACEBOOK,
      providerAccountId: profile.id,
      email,
      name: profile.displayName,
    };
    done(null, validated);
  }
}
