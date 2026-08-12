import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString } from 'class-validator';

// Same body-only shape as CreateQuestionDto, kept as its own class rather
// than a shared base — one-DTO-per-route is this codebase's convention
// (CreateReviewDto/ModerateReviewDto aren't shared either).
export class CreateAnswerDto {
  @ApiProperty()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsNotEmpty()
  body: string;
}
