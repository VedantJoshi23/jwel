import { CanActivate, ExecutionContext, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// Runs before the provider's Passport AuthGuard on every social-login route.
// Without it, hitting /auth/google (etc.) with no real credentials configured
// would still redirect the browser to the provider with a bogus client_id —
// failing at Google/Meta/Apple's end instead of ours. Same fail-loudly, not
// silently posture as RazorpayPaymentProviderStub.
abstract class OAuthConfiguredGuard implements CanActivate {
  protected abstract readonly providerName: string;
  protected abstract readonly requiredEnvVars: string[];

  constructor(protected readonly config: ConfigService) {}

  canActivate(_context: ExecutionContext): boolean {
    const missing = this.requiredEnvVars.filter((key) => !this.config.get<string>(key));
    if (missing.length > 0) {
      throw new ServiceUnavailableException(
        `${this.providerName} login is not configured on this server (missing: ${missing.join(', ')}). ` +
          'Set the required environment variables before routing users through it.',
      );
    }
    return true;
  }
}

// Each subclass must redeclare its constructor (even though it only forwards
// to the base) — Nest's DI resolves constructor params from
// `design:paramtypes` metadata, which TypeScript only emits for a class that
// literally declares its own constructor, not one inherited unchanged from a
// base class. Without this, Nest would instantiate these with no
// ConfigService at all and `this.config` would be undefined at runtime.
@Injectable()
export class GoogleConfiguredGuard extends OAuthConfiguredGuard {
  protected readonly providerName = 'Google';
  protected readonly requiredEnvVars = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'];

  constructor(config: ConfigService) {
    super(config);
  }
}

@Injectable()
export class FacebookConfiguredGuard extends OAuthConfiguredGuard {
  protected readonly providerName = 'Facebook';
  protected readonly requiredEnvVars = ['FACEBOOK_APP_ID', 'FACEBOOK_APP_SECRET'];

  constructor(config: ConfigService) {
    super(config);
  }
}

@Injectable()
export class AppleConfiguredGuard extends OAuthConfiguredGuard {
  protected readonly providerName = 'Apple';
  protected readonly requiredEnvVars = ['APPLE_CLIENT_ID', 'APPLE_TEAM_ID', 'APPLE_KEY_ID', 'APPLE_PRIVATE_KEY'];

  constructor(config: ConfigService) {
    super(config);
  }
}
