import { Button } from '@/components/ui/button';

const METALS = [
  { value: 'GOLD', label: 'Gold' },
  { value: 'GOLD_PLATED', label: 'Gold-plated' },
  { value: 'SILVER', label: 'Sterling silver' },
  { value: 'STAINLESS_STEEL', label: 'Stainless steel' },
];

/**
 * Plain GET form, no client JS required — filters work with JavaScript
 * disabled (progressive enhancement / NFR-6 accessibility intent) by
 * reloading the page with updated query params, which the server component
 * re-reads to refetch from the API.
 */
export function FilterForm({
  basePath,
  defaultMetal,
  defaultSort,
}: {
  basePath: string;
  defaultMetal?: string;
  defaultSort?: string;
}) {
  return (
    <form method="get" action={basePath} className="flex flex-col gap-5" aria-label="Filter products">
      <fieldset className="rounded-s border border-border p-3.5">
        <legend className="px-1 text-sm font-semibold">Metal used</legend>
        <div className="mt-3 flex flex-col gap-2.5 text-sm">
          {METALS.map((metal) => (
            <label key={metal.value} className="flex items-center gap-2">
              <input
                type="radio"
                name="metal"
                value={metal.value}
                defaultChecked={defaultMetal === metal.value}
                className="h-4 w-4"
              />
              {metal.label}
            </label>
          ))}
          <label className="flex items-center gap-2">
            <input type="radio" name="metal" value="" defaultChecked={!defaultMetal} className="h-4 w-4" />
            Any
          </label>
        </div>
      </fieldset>

      <label className="text-sm font-medium">
        Sort by
        <select name="sort" defaultValue={defaultSort ?? 'newest'} className="mt-1 block w-full rounded-s border border-border px-2 py-2">
          <option value="newest">Newest</option>
          <option value="price_asc">Price: low to high</option>
          <option value="price_desc">Price: high to low</option>
          <option value="popularity">Popularity</option>
        </select>
      </label>

      <Button type="submit" variant="secondary">
        Apply filters
      </Button>
    </form>
  );
}
