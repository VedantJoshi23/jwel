import { ApiProperty } from '@nestjs/swagger';
import { IsDefined } from 'class-validator';

export class UpdateSettingDto {
  @ApiProperty({
    description:
      'The new value. Sent as a string or a native JSON value — the registry ' +
      'parses and validates it against the setting\'s declared type.',
  })
  @IsDefined()
  value!: unknown;
}
