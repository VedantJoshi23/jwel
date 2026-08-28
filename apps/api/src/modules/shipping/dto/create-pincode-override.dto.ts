import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';

const PINCODE_PATTERN = /^[1-9][0-9]{5}$/;

export class CreatePincodeOverrideDto {
  @ApiProperty({ description: '6-digit Indian PIN code, e.g. "400001"' })
  @Matches(PINCODE_PATTERN, {
    message: 'pincode must be a 6-digit Indian PIN code with no leading zero',
  })
  pincode: string;

  @ApiPropertyOptional({
    default: true,
    description: 'Whether this pincode is deliverable at all. false marks it a known exclusion.',
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  deliverable?: boolean;

  @ApiPropertyOptional({
    description: 'Overrides the site-wide default lower bound for this pincode. Ignored when deliverable is false.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(365)
  estimatedMinDays?: number;

  @ApiPropertyOptional({
    description: 'Overrides the site-wide default upper bound for this pincode. Ignored when deliverable is false.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(365)
  estimatedMaxDays?: number;

  @ApiPropertyOptional({ description: 'Admin-facing reason, e.g. "Remote area — no courier coverage".' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
