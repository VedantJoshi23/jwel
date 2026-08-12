import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

// Shared shape for both the question- and answer-moderate routes — hiding
// is reversible (DOM-PRODUCT-QA Invariants 3/4), so this is a boolean
// target state, not a one-way "hide" action.
export class ModerateQnaDto {
  @ApiProperty() @IsBoolean() hidden: boolean;
}
