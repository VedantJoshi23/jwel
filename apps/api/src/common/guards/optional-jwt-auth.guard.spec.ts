import { OptionalJwtAuthGuard } from './optional-jwt-auth.guard';

describe('OptionalJwtAuthGuard', () => {
  const guard = new OptionalJwtAuthGuard();

  it('returns the user when authentication succeeded', () => {
    const user = { userId: '1', email: 'a@b.com', role: 'CUSTOMER' };
    expect(guard.handleRequest(null, user)).toBe(user);
  });

  it('returns null (not throws) when there is no token', () => {
    expect(guard.handleRequest(null, false)).toBeNull();
  });

  it('returns null (not throws) when the token is invalid/expired', () => {
    expect(guard.handleRequest(new Error('jwt expired'), false)).toBeNull();
  });
});
