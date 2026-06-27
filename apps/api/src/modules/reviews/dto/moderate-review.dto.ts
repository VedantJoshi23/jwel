import { ApiProperty } from '@nestjs/swagger';
import { ModerationStatus } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class ModerateReviewDto {
  @ApiProperty({ enum: ModerationStatus, enumName: 'ModerationDecision' })
  @IsEnum(ModerationStatus)
  status: ModerationStatus;
}
