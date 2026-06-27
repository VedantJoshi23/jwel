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
import { formatMinorUnits } from '@/lib/money';

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
          <TabsTrigger value="addresses">Addresses</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <p className="font-medium">{user?.name ?? user?.email}</p>
          <p className="text-sm text-ink-secondary">{user?.email}</p>
        </TabsContent>

        <TabsContent value="orders">
          <OrdersTab token={token} />
        </TabsContent>

        <TabsContent value="addresses">
          <AddressesTab token={token} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function OrdersTab({ token }: { token: string }) {
  const { data, isLoading } = useQuery({ queryKey: ['orders'], queryFn: () => getOrders(token) });

  if (isLoading) return <p className="text-ink-secondary">Loading orders…</p>;
  if (!data || data.items.length === 0) return <p className="text-ink-secondary">You have no orders yet.</p>;

  return (
    <ul className="divide-y divide-border">
      {data.items.map((order) => (
        <li key={order.id} className="flex items-center justify-between py-4">
          <div>
            <p className="font-mono text-sm">{order.id}</p>
            <p className="text-sm text-ink-secondary">{order.status}</p>
          </div>
          <p className="font-medium">{formatMinorUnits(order.totalMinorUnits)}</p>
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
