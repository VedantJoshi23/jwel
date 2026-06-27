import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthenticatedUser } from '../decorators/current-user.decorator';

// For routes that are public but behave differently for a known user vs. a
// guest (recently-viewed / record-view merge by userId when logged in,
// fall back to a client-supplied anonymousId otherwise). Attempts JWT auth
// if a token is present so `req.user` is populated, but — unlike the global
// JwtAuthGuard — never blocks the request when the token is missing or
// invalid; combine with @Public() so the global guard doesn't also require it.
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<TUser = AuthenticatedUser | null>(_err: unknown, user: unknown): TUser {
    return (user || null) as TUser;
  }
}
