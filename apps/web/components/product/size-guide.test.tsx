import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SizeGuide } from './size-guide';
import * as sizesApi from '@/lib/api/sizes';

const ring = (value: string, circ: string, dia: string, us: string, uk: string) => ({
  scheme: 'RING_INDIA' as const,
  value,
  label: value,
  circumferenceMm: circ,
  diameterMm: dia,
  usEquivalent: us,
  ukEquivalent: uk,
});

const chain = (value: string, label: string) => ({
  scheme: 'CHAIN_LENGTH_MM' as const,
  value,
  label,
  circumferenceMm: `${value}.00`,
  diameterMm: null,
  usEquivalent: null,
  ukEquivalent: null,
});

afterEach(() => vi.restoreAllMocks());

describe('SizeGuide', () => {
  it('renders nothing for a category with no scheme', async () => {
    const { container } = render(await SizeGuide({ scheme: null }));
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing for 'NONE'", async () => {
    const { container } = render(await SizeGuide({ scheme: 'NONE' }));
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when the scheme has no seeded options', async () => {
    vi.spyOn(sizesApi, 'safeGetSizes').mockResolvedValue([]);
    const { container } = render(await SizeGuide({ scheme: 'RING_INDIA' }));
    expect(container).toBeEmptyDOMElement();
  });

  it('renders a row per size with its measurements', async () => {
    vi.spyOn(sizesApi, 'safeGetSizes').mockResolvedValue([
      ring('16', '56.3', '17.93', '8', 'P½'),
      ring('18', '58.3', '18.54', '9', 'R½'),
    ]);
    render(await SizeGuide({ scheme: 'RING_INDIA' }));

    expect(screen.getByRole('rowheader', { name: '16' })).toBeInTheDocument();
    expect(screen.getByText('56.3 mm')).toBeInTheDocument();
    expect(screen.getByText('17.93 mm')).toBeInTheDocument();
  });

  it('shows US and UK columns for rings', async () => {
    vi.spyOn(sizesApi, 'safeGetSizes').mockResolvedValue([ring('16', '56.3', '17.93', '8', 'P½')]);
    render(await SizeGuide({ scheme: 'RING_INDIA' }));

    expect(screen.getByRole('columnheader', { name: 'US' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'UK' })).toBeInTheDocument();
  });

  it('omits US, UK and diameter columns for length schemes', async () => {
    // A column of dashes reads as missing data rather than "not applicable" —
    // a chain has no US ring size, so the column should not exist.
    vi.spyOn(sizesApi, 'safeGetSizes').mockResolvedValue([chain('450', '45 cm (18")')]);
    render(await SizeGuide({ scheme: 'CHAIN_LENGTH_MM' }));

    expect(screen.queryByRole('columnheader', { name: 'US' })).not.toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'UK' })).not.toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Diameter' })).not.toBeInTheDocument();
  });

  it('renders an em dash for gaps within an otherwise populated scheme', async () => {
    // A scheme can be partially populated — a ring size seeded without a UK
    // equivalent, say. The column stays (other rows use it) and the gap shows
    // as a dash rather than an empty cell that reads as a rendering bug.
    vi.spyOn(sizesApi, 'safeGetSizes').mockResolvedValue([
      ring('16', '56.3', '17.93', '8', 'P½'),
      { ...ring('17', '57.0', '18.14', '8.5', 'Q½'), diameterMm: null, usEquivalent: null, ukEquivalent: null },
    ]);
    render(await SizeGuide({ scheme: 'RING_INDIA' }));

    // Three dashes: diameter, US and UK on the second row.
    expect(screen.getAllByText('—')).toHaveLength(3);
  });

  it('advises measuring rather than converting (Law 1)', async () => {
    // Published charts disagree by ~0.2mm on diameter, so the guide must not
    // imply a precision the data lacks.
    vi.spyOn(sizesApi, 'safeGetSizes').mockResolvedValue([ring('16', '56.3', '17.93', '8', 'P½')]);
    render(await SizeGuide({ scheme: 'RING_INDIA' }));

    expect(screen.getByText(/Measurements are a guide/)).toBeInTheDocument();
    expect(screen.getByText(/more reliable than converting/)).toBeInTheDocument();
  });

  it('uses a scheme-appropriate title', async () => {
    vi.spyOn(sizesApi, 'safeGetSizes').mockResolvedValue([chain('450', '45 cm (18")')]);
    render(await SizeGuide({ scheme: 'CHAIN_LENGTH_MM' }));

    // Appears twice by design — once in the <summary> the customer clicks,
    // once as the table's sr-only <caption>, which is what gives the table its
    // accessible name. Assert both rather than picking one.
    expect(screen.getByText('Chain length guide', { selector: 'summary' })).toBeInTheDocument();
    expect(screen.getByRole('table', { name: 'Chain length guide' })).toBeInTheDocument();
  });

  it('gives the table an accessible caption', async () => {
    vi.spyOn(sizesApi, 'safeGetSizes').mockResolvedValue([ring('16', '56.3', '17.93', '8', 'P½')]);
    render(await SizeGuide({ scheme: 'RING_INDIA' }));

    expect(screen.getByRole('table', { name: 'Ring size guide' })).toBeInTheDocument();
  });
});
