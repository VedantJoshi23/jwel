'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/lib/auth-store';
import { adminListOrders, adminUpdateOrderStatus } from '@/lib/api/admin-orders';
import { formatMinorUnits } from '@/lib/money';
import type { AdminOrder, OrderStatus } from '@/lib/api/types';
import { ApiError } from '@/lib/api/client';

const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PLACED: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PROCESSING', 'CANCELLED'],
  PROCESSING: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED'],
  DELIVERED: [],
  CANCELLED: [],
  REFUNDED: [],
};

const STATUS_VARIANT: Record<OrderStatus, 'success' | 'warning' | 'error' | 'default'> = {
  PLACED: 'default',
  CONFIRMED: 'default',
  PROCESSING: 'warning',
  SHIPPED: 'warning',
  DELIVERED: 'success',
  CANCELLED: 'error',
  REFUNDED: 'error',
};

export default function AdminOrdersPage() {
  const token = useAuthStore((state) => state.token);
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    if (!token) return;
    adminListOrders(token, 1, 50)
      .then((res) => setOrders(res.items))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load orders'));
  }, [token]);

  useEffect(load, [load]);

  async function handleStatusChange(orderId: string, status: OrderStatus) {
    if (!token) return;
    try {
      await adminUpdateOrderStatus(token, orderId, status);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update order status');
    }
  }

  return (
    <div>
      <h1 className="mb-6 font-display text-3xl font-bold">Orders</h1>
      {error && <p className="mb-4 text-sm text-feedback-error">{error}</p>}

      <Card>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-ink-muted">
                <th className="px-4 py-3">Order</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Advance to</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 font-mono text-xs">{order.id.slice(0, 8)}…</td>
                  <td className="px-4 py-3">
                    {order.user.name ?? order.user.email}
                    <div className="text-xs text-ink-muted">{order.user.email}</div>
                  </td>
                  <td className="px-4 py-3 font-medium">{formatMinorUnits(order.totalMinorUnits)}</td>
                  <td className="px-4 py-3">
                    {/*
                      DOM-RETURNS invariant 9. A partially refunded order stays
                      DELIVERED by design, so the difference has to be visible
                      here or it is invisible everywhere — an admin should not
                      have to open an order to learn part of it came back.
                    */}
                    <Badge
                      variant={
                        order.partiallyReturned ? 'warning' : STATUS_VARIANT[order.status]
                      }
                      title={
                        order.partiallyReturned
                          ? 'Some items on this order have been refunded'
                          : undefined
                      }
                    >
                      {order.status}
                    </Badge>
                    {order.partiallyReturned && (
                      <div className="mt-1 text-xs text-feedback-warning">Partially returned</div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      {TRANSITIONS[order.status].map((next) => (
                        <Button
                          key={next}
                          variant="secondary"
                          size="s"
                          className="h-auto px-2.5 py-1 text-xs"
                          onClick={() => handleStatusChange(order.id, next)}
                        >
                          {next}
                        </Button>
                      ))}
                      {TRANSITIONS[order.status].length === 0 && (
                        <span className="text-xs text-ink-muted">final state</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {orders.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-ink-muted">
                    No orders yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
