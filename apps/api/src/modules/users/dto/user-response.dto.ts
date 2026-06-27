import { ApiProperty } from '@nestjs/swagger';
import { Role } from '@prisma/client';

// Prisma's Role here, not common/enums/role.enum — this DTO mirrors a real
// `User.role` value read from the database (see auth-response.dto.ts for why).

export class UserResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() email: string;
  @ApiProperty({ required: false, nullable: true }) name: string | null;
  @ApiProperty({ required: false, nullable: true }) phone: string | null;
  @ApiProperty({ enum: Role }) role: Role;
  @ApiProperty() createdAt: Date;
}
