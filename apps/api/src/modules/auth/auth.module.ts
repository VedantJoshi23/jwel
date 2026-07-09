import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { GoogleStrategy } from './oauth/google.strategy';
import { FacebookStrategy } from './oauth/facebook.strategy';
import { AppleStrategy } from './oauth/apple.strategy';
import { GoogleConfiguredGuard, FacebookConfiguredGuard, AppleConfiguredGuard } from './oauth/oauth-configured.guard';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: { expiresIn: config.get<string>('JWT_ACCESS_TOKEN_TTL', '900s') },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    GoogleStrategy,
    FacebookStrategy,
    AppleStrategy,
    GoogleConfiguredGuard,
    FacebookConfiguredGuard,
    AppleConfiguredGuard,
  ],
  exports: [AuthService],
})
export class AuthModule {}
