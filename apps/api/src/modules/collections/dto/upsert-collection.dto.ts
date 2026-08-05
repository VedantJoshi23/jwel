import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CollectionType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class UpsertCollectionDto {
  @ApiProperty() @IsString() @MaxLength(200) name: string;

  @ApiPropertyOptional({
    description: 'URL slug. Derived from `name` when omitted. Must not collide with a category slug.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  slug?: string;

  @ApiProperty({ enum: CollectionType })
  @IsEnum(CollectionType)
  type: CollectionType;

  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;

  @ApiPropertyOptional({ description: 'Storage ref, same convention as ProductMedia.storageRef' })
  @IsOptional()
  @IsString()
  heroImageRef?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isFeatured?: boolean;

  @ApiPropertyOptional() @IsOptional() @IsDateString() startsAt?: string;

  @ApiPropertyOptional() @IsOptional() @IsDateString() endsAt?: string;

  @ApiPropertyOptional({
    type: [String],
    description: 'Full membership list. Replaces the collection contents when present; omit to leave unchanged.',
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  productIds?: string[];
}
