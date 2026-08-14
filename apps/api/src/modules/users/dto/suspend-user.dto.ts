import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class SuspendUserDto {
  @ApiPropertyOptional({ description: 'Shown to the user if they attempt to log in, and kept on the audit entry' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
