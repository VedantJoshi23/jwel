'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/use-auth';
import { getProfile, listAddresses, addAddress } from '@/lib/api/users';
import { getOrders } from '@/lib/api/orders';
import { getReturns } from '@/lib/api/returns';
import { RequestReturnForm } from '@/components/profile/request-return-form';
import { Badge } from '@/components/ui/badge';
import { formatMinorUnits } from '@/lib/money';
import { brand } from '@/lib/brand';
import type { CustomerReturn, ReturnStatus } from '@/lib/api/types';

export default function ProfilePage() {
  const { token, user, isAuthenticated, logout } = useAuth();

  if (!isAuthenticated || !token) {
    return (
      <div className="px-6 py-16 text-center lg:px-8">
        <p className="text-ink-secondary">You need to log in to view your account.</p>
        <Button asChild className="mt-5">
          <Link href="/login?next=/profile">Log in</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="px-6 py-10 lg:px-8">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="font-display text-4xl font-bold">My account</h1>
        <Button variant="ghost" onClick={logout}>
          Log out
        </Button>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="orders">Orders</TabsTrigger>
          <TabsTrigger value="returns">Returns</TabsTrigger>
          <TabsTrigger value="addresses">Addresses</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <p className="font-medium">{user?.name ?? user?.email}</p>
          <p className="text-sm text-ink-secondary">{user?.email}</p>
        </TabsContent>

        <TabsContent value="orders">
          <OrdersTab token={token} />
        </TabsContent>

        <TabsContent value="returns">
          <ReturnsTab token={token} />
        </TabsContent>

        <TabsContent value="addresses">
          <AddressesTab token={token} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/**
 * The FAQ has told customers to "start a return from your order history" since
 * the page was written, and until now order history had no such control — the
 * API existed and nothing reached it (KC-117). This is that control.
 *
 * Returns are per **order item**, not per order, because that is how
 * `DOM-RETURNS` models them: each item may have at most one request, ever.
 */
function OrdersTab({ token }: { token: string }) {
  const { data, isLoading } = useQuery({ queryKey: ['orders'], queryFn: () => getOrders(token) });
  const returns = useQuery({ queryKey: ['returns'], queryFn: () => getReturns(token) });

  if (isLoading) return <p className="text-ink-secondary">Loading orders…</p>;
  if (!data || data.items.length === 0) return <p className="text-ink-secondary">You have no orders yet.</p>;

  // Which items already have a request. Read from the returns list rather than
  // from the order, because the customer order endpoint does not carry return
  // state and the returns list is loaded for the Returns tab anyway.
  const requested = new Map((returns.data ?? []).map((r) => [r.orderItem.id, r]));

  return (
    <ul className="divide-y divide-border">
      {data.items.map((order) => (
        <li key={order.id} className="py-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-mono text-sm">{order.id}</p>
              <p className="text-sm text-ink-secondary">{order.status}</p>
            </div>
            <p className="font-medium">{formatMinorUnits(order.totalMinorUnits)}</p>
          </div>

          {/*
            Only delivered orders can be returned (DOM-RETURNS Invariant 1), so
            offering the control anywhere else would be a surface promising
            something the API will refuse.
          */}
          {order.status === 'DELIVERED' && (
            <ul className="mt-3 space-y-3 border-t border-border pt-3">
              {order.items.map((item) => {
                const existing = requested.get(item.id);
                return (
                  <li key={item.id} className="text-sm">
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-ink-secondary">
                        {item.productNameSnapshot}
                        {item.quantity > 1 && <span className="text-ink-muted"> ×{item.quantity}</span>}
                      </span>
                      {existing ? (
                        <span className="text-xs text-ink-muted">
                          Return {existing.status.toLowerCase().replace(/_/g, ' ')}
                        </span>
                      ) : (
                        <RequestReturnForm
                          token={token}
                          item={item}
                          onRequested={() => returns.refetch()}
                        />
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </li>
      ))}
    </ul>
  );
}

const RETURN_STATUS_TONE: Record<ReturnStatus, 'default' | 'success' | 'warning' | 'error'> = {
  REQUESTED: 'default',
  APPROVED: 'warning',
  REJECTED: 'error',
  REFUND_PROCESSING: 'warning',
  REFUNDED: 'success',
};

/**
 * Status only — `DOM-RETURNS` §4 permits request and status, nothing else.
 *
 * In particular there is **no cancel control**, by Invariant 6: a customer may
 * not withdraw a request or re-request after a rejection, and exceptions are
 * handled out of band by email or WhatsApp. That is why a rejected return says
 * to contact us rather than offering a button.
 */
function ReturnsTab({ token }: { token: string }) {
  const { data, isLoading } = useQuery({ queryKey: ['returns'], queryFn: () => getReturns(token) });

  if (isLoading) return <p className="text-ink-secondary">Loading returns…</p>;
  if (!data || data.length === 0) {
    return (
      <p className="text-ink-secondary">
        You have no returns. You can start one from a delivered order in your Orders tab.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-border">
      {data.map((request: CustomerReturn) => (
        <li key={request.id} className="py-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-medium">{request.orderItem.productNameSnapshot}</p>
              <p className="text-sm text-ink-secondary">
                Requested {new Date(request.createdAt).toLocaleDateString()}
              </p>
            </div>
            <div className="text-right">
              {/* Text, not colour alone — STD-ACCESSIBILITY rule 6. */}
              <Badge variant={RETURN_STATUS_TONE[request.status]}>
                {request.status.replace(/_/g, ' ')}
              </Badge>
              {request.refundAmountMinorUnits !== null && (
                <p className="mt-1 text-sm font-medium">
                  {formatMinorUnits(request.refundAmountMinorUnits)} refunded
                </p>
              )}
            </div>
          </div>
          {/*
            Invariant 6 sends exceptions out of band, so this has to name a
            real way to reach someone — which it now can.
          */}
          {request.status === 'REJECTED' && (
            <p className="mt-2 text-sm text-ink-secondary">
              This request was not approved. Write to{' '}
              <a href={`mailto:${brand.contact.email}`} className="underline">
                {brand.contact.email}
              </a>{' '}
              if you would like us to look at it again.
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}

function AddressesTab({ token }: { token: string }) {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['addresses'],
    queryFn: () => listAddresses(token),
  });
  const [form, setForm] = useState({ line1: '', city: '', state: '', pincode: '' });
  const [submitting, setSubmitting] = useState(false);

  async function handleAdd(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    try {
      await addAddress(token, { ...form, line2: null, country: 'IN', isDefault: false, label: null });
      setForm({ line1: '', city: '', state: '', pincode: '' });
      refetch();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      {isLoading ? (
        <p className="text-ink-secondary">Loading addresses…</p>
      ) : (
        <ul className="space-y-3">
          {data?.map((address) => (
            <li key={address.id} className="border border-border p-4 text-sm">
              {address.line1}, {address.city}, {address.state} {address.pincode}
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={handleAdd} className="grid max-w-sm gap-3">
        <p className="font-medium">Add a new address</p>
        <Input
          placeholder="Address line 1"
          required
          value={form.line1}
          onChange={(e) => setForm({ ...form, line1: e.target.value })}
        />
        <Input
          placeholder="City"
          required
          value={form.city}
          onChange={(e) => setForm({ ...form, city: e.target.value })}
        />
        <Input
          placeholder="State"
          required
          value={form.state}
          onChange={(e) => setForm({ ...form, state: e.target.value })}
        />
        <Input
          placeholder="Pincode"
          required
          value={form.pincode}
          onChange={(e) => setForm({ ...form, pincode: e.target.value })}
        />
        <Button type="submit" variant="secondary" loading={submitting}>
          Save address
        </Button>
      </form>
    </div>
  );
}
