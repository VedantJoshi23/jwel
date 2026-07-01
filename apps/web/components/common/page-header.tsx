export function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="border-b border-border bg-surface-alt px-6 py-14 text-center lg:px-8">
      <h1 className="font-display text-4xl font-bold tracking-tight">{title}</h1>
      {subtitle && <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-ink-secondary">{subtitle}</p>}
    </div>
  );
}
