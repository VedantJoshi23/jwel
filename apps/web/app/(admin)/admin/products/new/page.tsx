'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { ProductForm, type ProductFormValues } from '@/components/admin/product-form';
import { useAuthStore } from '@/lib/auth-store';
import { adminCreateProduct, adminListCategories } from '@/lib/api/admin-products';
import type { Category } from '@/lib/api/types';
import { ApiError } from '@/lib/api/client';

export default function AdminNewProductPage() {
  const token = useAuthStore((state) => state.token);
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) return;
    adminListCategories(token)
      .then(setCategories)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load categories'));
  }, [token]);

  async function handleSubmit(values: ProductFormValues) {
    if (!token) return;
    setSubmitting(true);
    setError('');
    try {
      const product = await adminCreateProduct(token, {
        name: values.name,
        slug: values.slug,
        categoryId: values.categoryId,
        description: values.description,
        certificationType: values.certificationType || undefined,
        variants: [
          {
            sku: values.sku,
            metal: values.metal,
            purity: values.purity || undefined,
            size: values.size || undefined,
            weightGrams: Number(values.weightGrams),
            basePriceMinorUnits: Math.round(Number(values.basePriceMinorUnits) * 100),
          },
        ],
      });
      router.push(`/admin/products/${product.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create product');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <Link href="/admin/products" className="text-sm text-ink-secondary hover:underline">
        ← Back to products
      </Link>
      <h1 className="mb-6 mt-2 font-display text-3xl font-bold">New product</h1>

      <Card>
        <CardContent>
          <ProductForm mode="create" categories={categories} submitting={submitting} error={error} onSubmit={handleSubmit} />
        </CardContent>
      </Card>
    </div>
  );
}
