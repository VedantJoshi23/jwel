import { apiFetch } from './client';
import type { CreateOrderResponse, Order, PaginatedResult } from './types';

export interface CreateOrderInput {
  items: { variantId: string; quantity: number }[];
  shippingAddress: {
    label?: string;
    line1: string;
    line2?: string;
    city: string;
    state: string;
    pincode: string;
    country?: string;
  };
  couponCode?: string;
  paymentProvider?: 'STRIPE' | 'RAZORPAY';
}

export function createOrder(token: string, input: CreateOrderInput) {
  return apiFetch<CreateOrderResponse>('/orders', {
    method: 'POST',
    token,
    body: JSON.stringify(input),
  });
}

export function getOrders(token: string, page = 1, pageSize = 10) {
  return apiFetch<PaginatedResult<Order>>(`/orders?page=${page}&pageSize=${pageSize}`, {
    token,
    cache: 'no-store',
  });
}

export function getOrder(token: string, orderId: string) {
  return apiFetch<Order>(`/orders/${orderId}`, { token, cache: 'no-store' });
}
