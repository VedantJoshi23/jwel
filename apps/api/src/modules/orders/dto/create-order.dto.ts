import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { PaymentProvider } from '@prisma/client';
import { IsAddressText, IsPincode, Trim } from '../../../common/validation/address';

export class OrderItemInputDto {
  @ApiProperty() @IsString() variantId: string;

  @ApiProperty({ minimum: 1 }) @IsInt() @Min(1) quantity: number;
}

/**
 * Stored verbatim as the order's immutable address snapshot, so this is the
 * last point at which a bad address can be refused. Previously every field
 * was a bare `@IsString()`, which accepts an empty string: eleven orders
 * placed before the checkout form had a State field were accepted with no
 * state at all, and nothing here would have stopped a client sending the same
 * today. The browser's `required` attribute is not an invariant (Law 4).
 */
export class ShippingAddressInputDto {
  @ApiPropertyOptional() @IsOptional() @Trim() @IsString() @MaxLength(60) label?: string;
  @ApiProperty() @IsAddressText(200) line1: string;
  @ApiPropertyOptional() @IsOptional() @Trim() @IsString() @MaxLength(200) line2?: string;
  @ApiProperty() @IsAddressText(100) city: string;
  @ApiProperty() @IsAddressText(100) state: string;
  @ApiProperty({ description: '6-digit Indian PIN code, e.g. "400001"' }) @IsPincode() pincode: string;
  @ApiPropertyOptional({ default: 'IN' }) @IsOptional() @IsString() country?: string;
}

export class CreateOrderDto {
  @ApiProperty({ type: [OrderItemInputDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => OrderItemInputDto)
  items: OrderItemInputDto[];

  @ApiProperty({ type: ShippingAddressInputDto })
  @ValidateNested()
  @Type(() => ShippingAddressInputDto)
  shippingAddress: ShippingAddressInputDto;

  @ApiPropertyOptional() @IsOptional() @IsString() couponCode?: string;

  // RAZORPAY is the only provider with an adapter (ADR-0005). `STRIPE` remains
  // in the Prisma enum — no row has ever referenced it, and dropping an enum
  // value costs a migration for no benefit — so it is still accepted here and
  // rejected at the service layer rather than silently mapped.
  @ApiPropertyOptional({ enum: PaymentProvider, default: PaymentProvider.RAZORPAY })
  @IsOptional()
  @IsEnum(PaymentProvider)
  paymentProvider?: PaymentProvider = PaymentProvider.RAZORPAY;
}
