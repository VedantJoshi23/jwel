import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { Role } from '../enums/role.enum';

function buildContext(user?: { role: string }): ExecutionContext {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  let reflector: Reflector;
  let guard: RolesGuard;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RolesGuard(reflector);
  });

  it('allows the request through when no @Roles metadata is set on the route', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    expect(guard.canActivate(buildContext({ role: Role.CUSTOMER }))).toBe(true);
  });

  it('allows the request through when @Roles is set to an empty array', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([]);
    expect(guard.canActivate(buildContext({ role: Role.CUSTOMER }))).toBe(true);
  });

  it('allows a user whose role is in the required list', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([Role.ADMIN, Role.STAFF]);
    expect(guard.canActivate(buildContext({ role: Role.STAFF }))).toBe(true);
  });

  it('rejects a user whose role is not in the required list', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([Role.ADMIN]);
    expect(() => guard.canActivate(buildContext({ role: Role.CUSTOMER }))).toThrow(ForbiddenException);
  });

  it('rejects when there is no authenticated user on the request at all', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([Role.ADMIN]);
    expect(() => guard.canActivate(buildContext(undefined))).toThrow(ForbiddenException);
  });
});
