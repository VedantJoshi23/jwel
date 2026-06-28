import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { JwtAuthGuard } from './jwt-auth.guard';

function buildContext(): ExecutionContext {
  return { getHandler: () => ({}), getClass: () => ({}) } as unknown as ExecutionContext;
}

describe('JwtAuthGuard', () => {
  it('bypasses JWT validation entirely for a @Public() route', () => {
    const reflector = new Reflector();
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(true);
    const superCanActivate = jest.spyOn(AuthGuard('jwt').prototype, 'canActivate').mockReturnValue(false);

    const guard = new JwtAuthGuard(reflector);
    expect(guard.canActivate(buildContext())).toBe(true);
    expect(superCanActivate).not.toHaveBeenCalled();
    superCanActivate.mockRestore();
  });

  it('delegates to passport JWT validation for a non-public route', () => {
    const reflector = new Reflector();
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
    const superCanActivate = jest.spyOn(AuthGuard('jwt').prototype, 'canActivate').mockReturnValue(true);

    const guard = new JwtAuthGuard(reflector);
    expect(guard.canActivate(buildContext())).toBe(true);
    expect(superCanActivate).toHaveBeenCalled();
    superCanActivate.mockRestore();
  });
});
