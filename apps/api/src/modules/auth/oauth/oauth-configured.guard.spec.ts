import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppleConfiguredGuard, FacebookConfiguredGuard, GoogleConfiguredGuard } from './oauth-configured.guard';

function fakeConfig(values: Record<string, string>): ConfigService {
  return { get: jest.fn((key: string) => values[key]) } as unknown as ConfigService;
}

describe('GoogleConfiguredGuard', () => {
  it('allows the request through when both required env vars are set', () => {
    const guard = new GoogleConfiguredGuard(
      fakeConfig({ GOOGLE_CLIENT_ID: 'id', GOOGLE_CLIENT_SECRET: 'secret' }),
    );
    expect(guard.canActivate({} as any)).toBe(true);
  });

  it('throws ServiceUnavailableException naming exactly which env vars are missing', () => {
    const guard = new GoogleConfiguredGuard(fakeConfig({ GOOGLE_CLIENT_ID: 'id' }));
    expect(() => guard.canActivate({} as any)).toThrow(ServiceUnavailableException);
    expect(() => guard.canActivate({} as any)).toThrow(/GOOGLE_CLIENT_SECRET/);
  });
});

describe('FacebookConfiguredGuard', () => {
  it('allows the request through when both required env vars are set', () => {
    const guard = new FacebookConfiguredGuard(
      fakeConfig({ FACEBOOK_APP_ID: 'id', FACEBOOK_APP_SECRET: 'secret' }),
    );
    expect(guard.canActivate({} as any)).toBe(true);
  });

  it('throws when neither required env var is set, naming both', () => {
    const guard = new FacebookConfiguredGuard(fakeConfig({}));
    expect(() => guard.canActivate({} as any)).toThrow(/FACEBOOK_APP_ID, FACEBOOK_APP_SECRET/);
  });
});

describe('AppleConfiguredGuard', () => {
  it('allows the request through when all four required env vars are set', () => {
    const guard = new AppleConfiguredGuard(
      fakeConfig({
        APPLE_CLIENT_ID: 'id',
        APPLE_TEAM_ID: 'team',
        APPLE_KEY_ID: 'key',
        APPLE_PRIVATE_KEY: 'pk',
      }),
    );
    expect(guard.canActivate({} as any)).toBe(true);
  });

  it('throws naming only the specific missing vars, not the ones already set', () => {
    const guard = new AppleConfiguredGuard(
      fakeConfig({ APPLE_CLIENT_ID: 'id', APPLE_TEAM_ID: 'team' }),
    );
    expect(() => guard.canActivate({} as any)).toThrow(/APPLE_KEY_ID, APPLE_PRIVATE_KEY/);
  });
});
