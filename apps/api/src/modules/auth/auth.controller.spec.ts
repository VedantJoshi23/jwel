import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController', () => {
  let service: { register: jest.Mock; login: jest.Mock };
  let controller: AuthController;

  beforeEach(() => {
    service = { register: jest.fn().mockResolvedValue('registered'), login: jest.fn().mockResolvedValue('logged-in') };
    controller = new AuthController(service as unknown as AuthService);
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
});
