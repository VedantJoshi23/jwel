import Link from 'next/link';
import { CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatMinorUnits } from '@/lib/money';

export default async function CheckoutConfirmationPage({
  searchParams,
}: {
  searchParams: Promise<{ orderId?: string; total?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  return (
    <div className="px-6 py-20 text-center lg:px-8">
      <CheckCircle2 className="mx-auto h-12 w-12 text-feedback-success" aria-hidden="true" />
      <h1 className="mt-5 font-display text-3xl font-bold">Order placed</h1>
      {resolvedSearchParams.orderId && (
        <p className="mt-3 text-ink-secondary">
          Order <span className="font-mono">{resolvedSearchParams.orderId}</span>
          {resolvedSearchParams.total && <> — {formatMinorUnits(Number(resolvedSearchParams.total))}</>}
        </p>
      )}
      <p className="mx-auto mt-3 max-w-md text-sm text-ink-secondary">
        We&rsquo;ve sent a confirmation to your account. You can track this order from your profile.
      </p>
      <div className="mt-8 flex justify-center gap-4">
        <Button asChild>
          <Link href="/profile">View my orders</Link>
        </Button>
        <Button asChild variant="secondary">
          <Link href="/collections/all">Continue shopping</Link>
        </Button>
      </div>
    </div>
  );
}
