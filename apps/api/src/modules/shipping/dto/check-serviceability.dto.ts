import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsOptional, Matches } from 'class-validator';
import { PINCODE_MESSAGE, PINCODE_PATTERN } from '../../../common/validation/address';


export class CheckServiceabilityDto {
  @ApiProperty({ description: '6-digit Indian PIN code, e.g. "400001"' })
  @Matches(PINCODE_PATTERN, { message: PINCODE_MESSAGE })
  pincode: string;

  /**
   * `DOM-SHIPPING` §4's declared endpoint shape, not this feature's own
   * invention — accepted so a caller sending it does not get a 400 from the
   * global `forbidNonWhitelisted` pipe, but not read by this interim
   * implementation (`FEAT-DELIVERY-ESTIMATE` §4, `ADR-0024`): COD eligibility
   * needs order value and purchase history, a checkout-time concern out of
   * scope for a storefront pincode widget. A future `ShiprocketProvider` may
   * honour it without a breaking change to callers already sending it.
   */
  @ApiPropertyOptional({
    description:
      "Accepted for forward-compatibility with DOM-SHIPPING's full serviceability check; not used by the interim estimator.",
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  codRequested?: boolean;
}
