import type { Metadata } from 'next';
import { PageHeader } from '@/components/common/page-header';
import { brand } from '@/lib/brand';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: `How ${brand.name} collects, uses and protects your data.`,
};

const sections = [
  {
    title: 'Information we collect',
    body: 'When you create an account, place an order or contact support, we collect your name, email, phone number, shipping address and order history.',
  },
  {
    title: 'How we use it',
    body: 'We use this information to process orders, provide customer support, prevent fraud, and — with your consent — send updates about offers and new collections.',
  },
  {
    title: 'Payments',
    body: 'Payments are processed by our payment providers directly. We never store your full card number or bank details on our servers.',
  },
  {
    title: 'Cookies',
    body: 'We use cookies to keep you signed in, remember items in your bag, and understand which pages are useful so we can improve them.',
  },
  {
    title: 'Your rights',
    body: 'You can view, update or delete your account information at any time from your profile, or by contacting us to request full data deletion.',
  },
];

export default function PrivacyPage() {
  return (
    <div>
      <PageHeader title="Privacy Policy" subtitle="Last updated January 2026." />
      <div className="mx-auto max-w-2xl space-y-8 px-6 py-12 lg:px-8">
        {sections.map((s) => (
          <section key={s.title}>
            <h2 className="font-display text-xl font-bold">{s.title}</h2>
            <p className="mt-3 text-sm leading-relaxed text-ink-secondary">{s.body}</p>
          </section>
        ))}
        <p className="text-sm leading-relaxed text-ink-secondary">
          Questions about this policy? Reach out via{' '}
          <a href="/contact" className="underline">
            Contact us
          </a>
          .
        </p>
      </div>
    </div>
  );
}
