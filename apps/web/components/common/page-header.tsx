import Image from 'next/image';
import { cn } from '@/lib/utils';

/**
 * `image` is opt-in and defaults to unset — this component backs nine pages
 * (FAQ, shipping, cart, wishlist, contact, privacy, …), and only the About
 * page has photography approved for it (`ADR-0026`, the arched-room shot,
 * which carries no jewellery so it carries no product claim). Every other
 * page's header is unchanged.
 */
export function PageHeader({
  title,
  subtitle,
  image,
}: {
  title: string;
  subtitle?: string;
  image?: string;
}) {
  return (
    <div
      className={cn(
        'relative overflow-hidden border-b border-border px-6 py-14 text-center lg:px-8',
        image ? 'text-white' : 'bg-surface-alt',
      )}
    >
      {image && (
        <>
          <Image src={image} alt="" fill priority sizes="100vw" className="object-cover" aria-hidden="true" />
          {/* A dark wash under the text, not the image alone — this is a
              light lavender room shot, and white heading text on its own
              would fail contrast against the pale sky/wall areas. */}
          <div className="absolute inset-0 bg-black/45" aria-hidden="true" />
        </>
      )}
      <h1 className="relative z-10 font-display text-4xl font-bold tracking-tight">{title}</h1>
      {subtitle && (
        <p className={cn('relative z-10 mx-auto mt-3 max-w-xl text-sm leading-relaxed', !image && 'text-ink-secondary')}>
          {subtitle}
        </p>
      )}
    </div>
  );
}
