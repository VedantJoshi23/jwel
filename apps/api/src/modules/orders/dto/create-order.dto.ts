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

  @ApiPropertyOptional({ enum: PaymentProvider, default: PaymentProvider.STRIPE })
  @IsOptional()
  @IsEnum(PaymentProvider)
  paymentProvider?: PaymentProvider = PaymentProvider.STRIPE;
}
