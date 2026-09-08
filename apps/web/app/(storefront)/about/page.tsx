import type { Metadata } from 'next';
import { PageHeader } from '@/components/common/page-header';
import { brand } from '@/lib/brand';

export const metadata: Metadata = {
  title: 'About Us',
  description: `${brand.name} — ${brand.tagline}.`,
};

// The previous copy here (brand.story.intro/values, plus a hardcoded second
// paragraph about production practices) was the pre-rename "GLINT" narrative
// — festive Kundan/temple-jhumka framing that doesn't match the ELYSIAN name,
// the real catalogue (everyday sterling silver/CZ), or any verified claim
// about how pieces are made or priced. Removed rather than rewritten: the
// real ELYSIAN story is the client's to give, not ours to invent — same
// discipline as lib/brand.ts's own pending-copy TODOs and the FAQ's audit
// comment. `brand.story` stays defined (unused here) until that copy exists.
export default function AboutPage() {
  return (
    <div>
      <PageHeader title="Our Story" subtitle={brand.tagline} />
      <div className="mx-auto max-w-3xl px-6 py-12 lg:px-8">
        <p className="text-ink-secondary leading-relaxed">This page is being finalized.</p>
      </div>
    </div>
  );
}
