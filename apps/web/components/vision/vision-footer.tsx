const COLUMNS = [
  { title: 'Collections', links: ['Meridian', 'Aurora', 'Vault', 'Heirloom'] },
  { title: 'Atelier', links: ['Our story', 'The craft', 'Journal', 'Careers'] },
  { title: 'Service', links: ['Private viewing', 'Care & repair', 'Shipping', 'Contact'] },
];

export function VisionFooter() {
  return (
    <footer className="overflow-x-hidden border-t border-[#C8A24A]/15 bg-[#050506] px-[8vw] pb-12 pt-[120px]">
      <div className="mx-auto max-w-[1400px]">
        <div className="text-center">
          <div
            className="pl-[0.6em] text-[clamp(56px,14vw,240px)] leading-none"
            style={{
              fontFamily: 'var(--vision-font-serif)',
              fontWeight: 400,
              letterSpacing: '.6em',
              background: 'linear-gradient(180deg, #F5F1EA 0%, rgba(245,241,234,.2) 100%)',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              color: 'transparent',
            }}
          >
            GLINT
          </div>
          <div
            className="mt-6 text-xs uppercase text-[#C8A24A]"
            style={{ fontFamily: 'var(--vision-font-sans)', letterSpacing: '.5em' }}
          >
            Crafted since 1962 · Jaipur · India
          </div>
        </div>

        <div className="mt-24 grid gap-16 border-t border-[#F5F1EA]/[0.08] pt-20 md:grid-cols-[2fr_1fr_1fr_1fr]">
          <div>
            <p
              className="max-w-[340px] text-[28px] italic leading-[1.4] text-[#F5F1EA]/85"
              style={{ fontFamily: 'var(--vision-font-serif)' }}
            >
              &ldquo;Receive one letter each season. Nothing more.&rdquo;
            </p>
            <div className="mt-8 flex max-w-[340px] items-baseline justify-between border-b border-[#F5F1EA]/20 pb-3.5">
              <span className="text-[13px] text-[#F5F1EA]/40" style={{ fontFamily: 'var(--vision-font-sans)' }}>
                your@email.com
              </span>
              <span
                data-vision-magnet
                className="cursor-pointer text-[11px] uppercase text-[#C8A24A]"
                style={{ fontFamily: 'var(--vision-font-sans)', letterSpacing: '.4em' }}
              >
                Subscribe →
              </span>
            </div>
          </div>

          {COLUMNS.map((col) => (
            <div key={col.title}>
              <div
                className="mb-6 text-[10px] uppercase text-[#F5F1EA]/40"
                style={{ fontFamily: 'var(--vision-font-sans)', letterSpacing: '.4em' }}
              >
                {col.title}
              </div>
              <div className="flex flex-col gap-3.5 text-[13px] text-[#F5F1EA]/75" style={{ fontFamily: 'var(--vision-font-sans)' }}>
                {col.links.map((link) => (
                  <span key={link}>{link}</span>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div
          className="mt-20 flex flex-col gap-2 border-t border-[#F5F1EA]/[0.08] pt-8 text-[11px] uppercase text-[#F5F1EA]/40 sm:flex-row sm:justify-between"
          style={{ fontFamily: 'var(--vision-font-sans)', letterSpacing: '.24em' }}
        >
          <div>© 2026 GLINT · All pieces certified</div>
          <div>Privacy · Terms · Cookies</div>
        </div>
      </div>
    </footer>
  );
}
