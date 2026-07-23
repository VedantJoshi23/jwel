'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { ProductForm, type ProductFormValues } from '@/components/admin/product-form';
import { useAuthStore } from '@/lib/auth-store';
import { adminGetProduct, adminListCategories, adminUpdateProduct } from '@/lib/api/admin-products';
import type { Category, Product } from '@/lib/api/types';
import { ApiError } from '@/lib/api/client';

export default function AdminEditProductPage() {
  const { id } = useParams<{ id: string }>();
  const token = useAuthStore((state) => state.token);
  const router = useRouter();
  const [product, setProduct] = useState<Product | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(() => {
    if (!token) return;
    Promise.all([adminGetProduct(token, id), adminListCategories(token)])
      .then(([p, c]) => {
        setProduct(p);
        setCategories(c);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load product'));
  }, [token, id]);

  useEffect(load, [load]);

  async function handleSubmit(values: ProductFormValues) {
    if (!token || !product) return;
    setSubmitting(true);
    setError('');
    try {
      const firstVariant = product.variants[0];
      const priceChanged = firstVariant && Math.round(Number(values.basePriceMinorUnits) * 100) !== firstVariant.basePriceMinorUnits;

      await adminUpdateProduct(token, id, {
        name: values.name,
        description: values.description,
        categoryId: values.categoryId,
        ...(priceChanged && firstVariant
          ? {
              variantPriceUpdates: [
                { variantId: firstVariant.id, basePriceMinorUnits: Math.round(Number(values.basePriceMinorUnits) * 100) },
              ],
            }
          : {}),
      });
      router.push('/admin/products');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to save product');
    } finally {
      setSubmitting(false);
    }
  }

  if (!product) {
    return <p className="text-sm text-ink-secondary">{error || 'Loading…'}</p>;
  }

  return (
    <div>
      <Link href="/admin/products" className="text-sm text-ink-secondary hover:underline">
        ← Back to products
      </Link>
      <h1 className="mb-6 mt-2 font-display text-3xl font-bold">Edit {product.name}</h1>

      <Card>
        <CardContent>
          <ProductForm
            mode="edit"
            categories={categories}
            initialProduct={product}
            submitting={submitting}
            error={error}
            onSubmit={handleSubmit}
          />
        </CardContent>
      </Card>
    </div>
  );
}
