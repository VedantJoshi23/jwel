import { ApiProperty } from '@nestjs/swagger';
import { Role } from '@prisma/client';

// Uses Prisma's generated Role type/value here (not common/enums/role.enum)
// because this DTO directly mirrors a Prisma `User.role` value returned from
// the database — see users.service.ts for why mixing the two caused a real
// TS2322 compile error during Milestone 7 validation.

export class AuthUserDto {
  @ApiProperty() id: string;
  @ApiProperty() email: string;
  @ApiProperty({ required: false }) name?: string | null;
  @ApiProperty({ enum: Role }) role: Role;
}

export class AuthResponseDto {
  @ApiProperty() accessToken: string;
  @ApiProperty({ type: AuthUserDto }) user: AuthUserDto;
}
