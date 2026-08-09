import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'anika@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'a-strong-password', minLength: 8 })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiProperty({ required: false, example: 'Anika Sharma' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ required: false, example: '+919876543210' })
  @IsOptional()
  @IsString()
  phone?: string;

  /**
   * The browser's guest identifier, so the views made before signing up are
   * not lost — `DOM-RECOMMENDATION` Invariant 9.
   *
   * Optional and inert: a registration without it simply starts with no view
   * history, and a wrong one claims nothing, because the claim is bounded to
   * views made in the last day.
   */
  @ApiProperty({ required: false, description: 'Guest view-history id to claim (Invariant 9)' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  anonymousId?: string;
}
