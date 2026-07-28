import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { PaymentProvider } from '@prisma/client';

export class OrderItemInputDto {
  @ApiProperty() @IsString() variantId: string;

  @ApiProperty({ minimum: 1 }) @IsInt() @Min(1) quantity: number;
}

export class ShippingAddressInputDto {
  @ApiPropertyOptional() @IsOptional() @IsString() label?: string;
  @ApiProperty() @IsString() line1: string;
  @ApiPropertyOptional() @IsOptional() @IsString() line2?: string;
  @ApiProperty() @IsString() city: string;
  @ApiProperty() @IsString() state: string;
  @ApiProperty() @IsString() pincode: string;
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
