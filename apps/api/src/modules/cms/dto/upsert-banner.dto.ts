import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsDateString, IsInt, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

// A banner links either somewhere inside the storefront ("/collections/rings")
// or out to an absolute http(s) URL. `@IsUrl()` — what this field used to
// use — rejects the first shape outright, so linking a banner at a category
// page, which is the ordinary case, returned 400 and only absolute URLs could
// ever be saved.
//
// Written as an explicit allowlist rather than a relaxed `@IsUrl()` because
// the failure mode on the other side is a `javascript:` URL reaching an
// `href` the storefront renders. Protocol-relative ("//host") is excluded
// deliberately: it is an absolute URL that looks root-relative.
const BANNER_LINK = /^(?:https?:\/\/[^\s]+|\/(?!\/)[^\s]*)$/;

export class UpsertBannerDto {
  @ApiProperty() @IsString() @MaxLength(200) title: string;

  @ApiProperty({ description: 'Storage ref, same convention as ProductMedia.storageRef' })
  @IsString()
  imageRef: string;

  @ApiPropertyOptional({
    description: 'An absolute http(s) URL, or a root-relative storefront path such as /collections/rings',
    example: '/collections/rings',
  })
  @IsOptional()
  @Matches(BANNER_LINK, {
    message: 'linkUrl must be an absolute http(s) URL or a root-relative path starting with /',
  })
  linkUrl?: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  endsAt?: string;
}
