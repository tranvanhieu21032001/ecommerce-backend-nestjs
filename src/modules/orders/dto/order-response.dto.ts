import { ApiProperty } from '@nestjs/swagger';
import { OrderStatus, PaymentMethod, PaymentStatus } from '@prisma/client';

export class OrderItemResponseDto {
  @ApiProperty({
    description: 'Order item ID',
    example: '550e8400-e29b-41d4-a716-446655440010',
  })
  id: string;

  @ApiProperty({
    description: 'Product ID captured in the order item',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  productId: string;

  @ApiProperty({
    description: 'Purchased quantity',
    example: 2,
  })
  quantity: number;

  @ApiProperty({
    description: 'Unit price captured at ordering time',
    example: 99.99,
  })
  price: number;

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt: Date;
}

export class OrderPaymentResponseDto {
  @ApiProperty({
    description: 'Payment ID',
    example: '550e8400-e29b-41d4-a716-446655440011',
  })
  id: string;

  @ApiProperty({
    description: 'Payment amount',
    example: 209.98,
  })
  amount: number;

  @ApiProperty({
    description: 'Payment status',
    enum: PaymentStatus,
    example: PaymentStatus.PENDING,
  })
  status: PaymentStatus;

  @ApiProperty({
    description: 'Payment method selected for the order',
    enum: PaymentMethod,
    example: PaymentMethod.COD,
    nullable: true,
  })
  method: PaymentMethod | null;

  @ApiProperty({
    description: 'ISO 4217 payment currency',
    example: 'USD',
  })
  currency: string;

  @ApiProperty({
    description: 'Payment provider transaction identifier',
    example: null,
    nullable: true,
  })
  transactionId: string | null;

  @ApiProperty({
    description: 'Timestamp when payment was completed',
    nullable: true,
  })
  paidAt: Date | null;

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt: Date;
}

export class OrderResponseDto {
  @ApiProperty({
    description: 'Order ID',
    example: '550e8400-e29b-41d4-a716-446655440020',
  })
  id: string;

  @ApiProperty({
    description: 'Human-readable unique order number',
    example: 'cmay2j7tr0000xv87u8z2cewn',
  })
  orderNumber: string;

  @ApiProperty({
    description: 'Fulfillment status',
    enum: OrderStatus,
    example: OrderStatus.PENDING,
  })
  status: OrderStatus;

  @ApiProperty({
    description: 'ID of the customer who placed the order',
    example: '550e8400-e29b-41d4-a716-446655440002',
  })
  userId: string;

  @ApiProperty({
    description: 'Cart used to create the order',
    nullable: true,
    example: null,
  })
  cartId: string | null;

  @ApiProperty({ description: 'Items subtotal before fees and discounts', example: 199.98 })
  subtotal: number;

  @ApiProperty({ description: 'Shipping fee charged', example: 10 })
  shippingFee: number;

  @ApiProperty({ description: 'Discount deducted from the subtotal', example: 0 })
  discountAmount: number;

  @ApiProperty({ description: 'Tax amount charged', example: 0 })
  taxAmount: number;

  @ApiProperty({ description: 'Final amount charged for the order', example: 209.98 })
  totalAmount: number;

  @ApiProperty({ description: 'Recipient full name', nullable: true, example: 'Nguyen Van A' })
  shippingName: string | null;

  @ApiProperty({ description: 'Recipient phone number', nullable: true, example: '+84901234567' })
  shippingPhone: string | null;

  @ApiProperty({ description: 'Primary shipping address line', example: '123 Nguyen Hue Street' })
  shippingAddressLine1: string;

  @ApiProperty({
    description: 'Additional shipping address details',
    nullable: true,
    example: null,
  })
  shippingAddressLine2: string | null;

  @ApiProperty({ description: 'Shipping ward or commune', nullable: true, example: 'Ben Nghe' })
  shippingWard: string | null;

  @ApiProperty({ description: 'Shipping district', nullable: true, example: 'District 1' })
  shippingDistrict: string | null;

  @ApiProperty({ description: 'Shipping city or province', example: 'Ho Chi Minh City' })
  shippingCity: string;

  @ApiProperty({ description: 'Shipping postal code', nullable: true, example: '700000' })
  shippingPostalCode: string | null;

  @ApiProperty({ description: 'Shipping country code', example: 'VN' })
  shippingCountry: string;

  @ApiProperty({ description: 'Customer notes for fulfillment', nullable: true, example: null })
  notes: string | null;

  @ApiProperty({ type: [OrderItemResponseDto] })
  orderItems: OrderItemResponseDto[];

  @ApiProperty({ type: OrderPaymentResponseDto, nullable: true })
  payment: OrderPaymentResponseDto | null;

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt: Date;

  @ApiProperty({ description: 'Cancellation timestamp', nullable: true })
  cancelledAt: Date | null;
}
