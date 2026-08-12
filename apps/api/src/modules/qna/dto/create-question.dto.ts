import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString } from 'class-validator';

// `@IsNotEmpty()` alone accepts a whitespace-only string; the `@Transform`
// trims first so " " is rejected the same as "" (DOM-PRODUCT-QA §8 edge case 4).
export class CreateQuestionDto {
  @ApiProperty()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsNotEmpty()
  body: string;
}
