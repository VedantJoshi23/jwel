import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { ConfigService } from '@nestjs/config';

describe('AuthController', () => {
  let service: { register: jest.Mock; login: jest.Mock; loginWithOAuth: jest.Mock };
  let config: { get: jest.Mock };
  let controller: AuthController;

  beforeEach(() => {
    service = {
      register: jest.fn().mockResolvedValue('registered'),
      login: jest.fn().mockResolvedValue('logged-in'),
      loginWithOAuth: jest.fn().mockResolvedValue({ accessToken: 'oauth-token' }),
    };
    config = { get: jest.fn().mockReturnValue('http://localhost:3000') };
    controller = new AuthController(service as unknown as AuthService, config as unknown as ConfigService);
  });

  it('delegates registration to AuthService.register', async () => {
    const dto = { email: 'a@b.com', password: 'password123' };
    expect(await controller.register(dto as any)).toBe('registered');
    expect(service.register).toHaveBeenCalledWith(dto);
  });

  it('delegates login to AuthService.login', async () => {
    const dto = { email: 'a@b.com', password: 'password123' };
    expect(await controller.login(dto as any)).toBe('logged-in');
    expect(service.login).toHaveBeenCalledWith(dto);
  });

  it('exchanges an OAuth profile for a JWT and redirects to the frontend callback page with it (google)', async () => {
    const req = { user: { provider: 'GOOGLE', providerAccountId: 'g-1', email: 'a@b.com' } };
    const res = { redirect: jest.fn() };
    await controller.googleCallback(req as any, res as any);
    expect(service.loginWithOAuth).toHaveBeenCalledWith(req.user);
    expect(res.redirect).toHaveBeenCalledWith('http://localhost:3000/auth/callback?token=oauth-token');
  });

  it('exchanges an OAuth profile for a JWT and redirects to the frontend callback page with it (facebook)', async () => {
    const req = { user: { provider: 'FACEBOOK', providerAccountId: 'fb-1', email: 'a@b.com' } };
    const res = { redirect: jest.fn() };
    await controller.facebookCallback(req as any, res as any);
    expect(service.loginWithOAuth).toHaveBeenCalledWith(req.user);
    expect(res.redirect).toHaveBeenCalledWith('http://localhost:3000/auth/callback?token=oauth-token');
  });

  it('exchanges an OAuth profile for a JWT and redirects to the frontend callback page with it (apple)', async () => {
    const req = { user: { provider: 'APPLE', providerAccountId: 'apple-1' } };
    const res = { redirect: jest.fn() };
    await controller.appleCallback(req as any, res as any);
    expect(service.loginWithOAuth).toHaveBeenCalledWith(req.user);
    expect(res.redirect).toHaveBeenCalledWith('http://localhost:3000/auth/callback?token=oauth-token');
  });

  it('googleLogin/facebookLogin/appleLogin bodies are no-ops — the redirect happens entirely inside the Passport guard', () => {
    expect(controller.googleLogin()).toBeUndefined();
    expect(controller.facebookLogin()).toBeUndefined();
    expect(controller.appleLogin()).toBeUndefined();
  });
});
