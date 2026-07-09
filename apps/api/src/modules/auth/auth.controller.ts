import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';
import { ApiExcludeEndpoint, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import { Public } from '../../common/decorators/public.decorator';
import { OAuthValidatedProfile } from './oauth/oauth-profile';
import { GoogleConfiguredGuard, FacebookConfiguredGuard, AppleConfiguredGuard } from './oauth/oauth-configured.guard';

// Stricter than the global default (SECURITY.md §6 — auth endpoints are a
// credential-stuffing target and get a tighter rate-limit than the rest of the API).
// Relaxed under NODE_ENV=test only — integration tests across several spec
// files legitimately call register/login far more than 5 times/minute from
// the same IP; the throttle itself still runs (this isn't a bypass of the
// guard), just with a limit realistic for an automated suite instead of a
// real client.
const AUTH_THROTTLE = { default: { limit: process.env.NODE_ENV === 'test' ? 1000 : 5, ttl: 60_000 } };

@ApiTags('auth')
@Controller('api/v1/auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @Throttle(AUTH_THROTTLE)
  @Post('register')
  @ApiOperation({ summary: 'Register a new customer account' })
  @ApiResponse({ status: 201, type: AuthResponseDto })
  register(@Body() dto: RegisterDto): Promise<AuthResponseDto> {
    return this.authService.register(dto);
  }

  @Public()
  @Throttle(AUTH_THROTTLE)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Authenticate and receive an access token' })
  @ApiResponse({ status: 200, type: AuthResponseDto })
  login(@Body() dto: LoginDto): Promise<AuthResponseDto> {
    return this.authService.login(dto);
  }

  // --- Social login ---------------------------------------------------
  // The initiating route (e.g. GET /auth/google) never returns JSON — the
  // ConfiguredGuard runs first and rejects loudly if not configured;
  // otherwise Passport's AuthGuard takes over and redirects the browser to
  // the provider. The callback route exchanges the resulting profile for a
  // JWT the same way login()/register() do, then redirects to the
  // frontend's callback page with the token as a query param — this app
  // stores its session client-side (see apps/web/lib/auth-store.ts), not as
  // an httpOnly cookie, so this is consistent with (not a regression from)
  // the existing email/password flow's already-disclosed posture.

  @Public()
  @UseGuards(GoogleConfiguredGuard, AuthGuard('google'))
  @Get('google')
  @ApiExcludeEndpoint()
  googleLogin(): void {
    // Handled entirely by AuthGuard('google'), which redirects before this runs.
  }

  @Public()
  @UseGuards(AuthGuard('google'))
  @Get('google/callback')
  @ApiExcludeEndpoint()
  async googleCallback(@Req() req: Request, @Res() res: Response): Promise<void> {
    await this.handleOAuthCallback(req, res);
  }

  @Public()
  @UseGuards(FacebookConfiguredGuard, AuthGuard('facebook'))
  @Get('facebook')
  @ApiExcludeEndpoint()
  facebookLogin(): void {
    // Handled entirely by AuthGuard('facebook'), which redirects before this runs.
  }

  @Public()
  @UseGuards(AuthGuard('facebook'))
  @Get('facebook/callback')
  @ApiExcludeEndpoint()
  async facebookCallback(@Req() req: Request, @Res() res: Response): Promise<void> {
    await this.handleOAuthCallback(req, res);
  }

  @Public()
  @UseGuards(AppleConfiguredGuard, AuthGuard('apple'))
  @Get('apple')
  @ApiExcludeEndpoint()
  appleLogin(): void {
    // Handled entirely by AuthGuard('apple'), which redirects before this runs.
  }

  // Apple's response_mode is `form_post` (see AppleStrategy) — it POSTs back
  // to this URL, not GET like Google/Facebook.
  @Public()
  @UseGuards(AuthGuard('apple'))
  @Post('apple/callback')
  @ApiExcludeEndpoint()
  async appleCallback(@Req() req: Request, @Res() res: Response): Promise<void> {
    await this.handleOAuthCallback(req, res);
  }

  private async handleOAuthCallback(req: Request, res: Response): Promise<void> {
    const profile = req.user as OAuthValidatedProfile;
    const { accessToken } = await this.authService.loginWithOAuth(profile);
    const frontendUrl = this.config.get<string>('FRONTEND_URL', 'http://localhost:3000');
    res.redirect(`${frontendUrl}/auth/callback?token=${encodeURIComponent(accessToken)}`);
  }
}
