import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { Trim } from '../../../common/validation/address';

export class CreateReviewDto {
  @ApiProperty() @IsString() productId: string;

  @ApiProperty({ minimum: 1, maximum: 5 }) @IsInt() @Min(1) @Max(5) rating: number;

  // 120 mirrors the review form's existing `maxLength`, so the server now
  // states the limit the UI was already enforcing on its own.
  @ApiPropertyOptional({ maxLength: 120 }) @IsOptional() @Trim() @IsString() @MaxLength(120) title?: string;

  // Was a bare `@IsString()`, which accepts "" — an empty review would have
  // entered the moderation queue and, once approved, counted towards the
  // product's rating with nothing to read. The form disabled its button for
  // an empty body, but that was the only guard. Same trim-then-require shape
  // as CreateQuestionDto (DOM-PRODUCT-QA §8 edge case 4).
  @ApiProperty() @Trim() @IsString() @IsNotEmpty() body: string;
}
