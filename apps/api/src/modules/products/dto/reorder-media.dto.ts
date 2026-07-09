import { ApiProperty } from '@nestjs/swagger';
import { ArrayMinSize, IsArray, IsString } from 'class-validator';

export class ReorderMediaDto {
  @ApiProperty({ type: [String], description: 'Every media id currently on this product, in the desired display order' })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  mediaIds: string[];
}
