import { ApiProperty } from '@nestjs/swagger';
import { IsInt } from 'class-validator';

export class AdjustStockDto {
  @ApiProperty({ description: 'Positive to add stock, negative to remove (e.g. damage write-off)' })
  @IsInt()
  delta: number;
}
