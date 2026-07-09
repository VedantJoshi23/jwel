import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import { OAuthProvider } from '@prisma/client';
import { AppleStrategy } from './apple.strategy';

jest.mock('jsonwebtoken', () => ({ decode: jest.fn() }));

function fakeConfig(): ConfigService {
  return { get: jest.fn((_key: string, fallback?: string) => fallback) } as unknown as ConfigService;
}

describe('AppleStrategy', () => {
  let strategy: AppleStrategy;
  let done: jest.Mock;

  beforeEach(() => {
    strategy = new AppleStrategy(fakeConfig());
    done = jest.fn();
    (jwt.decode as jest.Mock).mockReset();
  });

  it('calls done with an error when the id token has no usable sub claim', () => {
    (jwt.decode as jest.Mock).mockReturnValue({ email: 'a@b.com' });
    strategy.validate({ body: {} } as any, 'at', 'rt', 'id-token', {}, done);
    expect(done).toHaveBeenCalledWith(expect.any(Error));
  });

  it('calls done with an error when the id token fails to decode at all', () => {
    (jwt.decode as jest.Mock).mockReturnValue(null);
    strategy.validate({ body: {} } as any, 'at', 'rt', 'id-token', {}, done);
    expect(done).toHaveBeenCalledWith(expect.any(Error));
  });

  it('builds a validated profile from the id token claims when no body.user is present (repeat login)', () => {
    (jwt.decode as jest.Mock).mockReturnValue({ sub: 'apple-sub-1', email: 'a@b.com' });
    strategy.validate({ body: {} } as any, 'at', 'rt', 'id-token', {}, done);
    expect(done).toHaveBeenCalledWith(null, {
      provider: OAuthProvider.APPLE,
      providerAccountId: 'apple-sub-1',
      email: 'a@b.com',
      name: undefined,
    });
  });

  it('parses the name from body.user on a first-time authorization', () => {
    (jwt.decode as jest.Mock).mockReturnValue({ sub: 'apple-sub-1', email: 'a@b.com' });
    const rawUser = JSON.stringify({ name: { firstName: 'Ada', lastName: 'Lovelace' } });
    strategy.validate({ body: { user: rawUser } } as any, 'at', 'rt', 'id-token', {}, done);
    expect(done).toHaveBeenCalledWith(null, expect.objectContaining({ name: 'Ada Lovelace' }));
  });

  it('falls back to no name when body.user is present but not valid JSON', () => {
    (jwt.decode as jest.Mock).mockReturnValue({ sub: 'apple-sub-1' });
    strategy.validate({ body: { user: 'not-json' } } as any, 'at', 'rt', 'id-token', {}, done);
    expect(done).toHaveBeenCalledWith(null, expect.objectContaining({ name: undefined }));
  });

  it('handles an id token with no email (Apple private-relay opt-out) — email is undefined, not a crash', () => {
    (jwt.decode as jest.Mock).mockReturnValue({ sub: 'apple-sub-1' });
    strategy.validate({ body: {} } as any, 'at', 'rt', 'id-token', {}, done);
    expect(done).toHaveBeenCalledWith(null, expect.objectContaining({ email: undefined }));
  });
});
