import { ApiProperty } from '@nestjs/swagger';
import { UserResponseDto } from './user-response.dto';

/**
 * `UserResponseDto` plus suspension state — admin-only, since a customer's
 * own `/me` has no business describing whether *it* is suspended (a
 * suspended user's token is rejected by `JwtStrategy` before any handler
 * runs, so the question never reaches a response body on that path anyway).
 */
export class AdminUserResponseDto extends UserResponseDto {
  @ApiProperty({ nullable: true }) deletedAt: Date | null;
  @ApiProperty({ required: false, nullable: true }) suspensionReason: string | null;
}
