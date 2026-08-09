'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { autocomplete } from '@/lib/api/search';

/**
 * Autosuggest under the search box — `FR-3`'s "typo-tolerant search with
 * autosuggest", whose second half had no surface at all (KC-116).
 *
 * A listbox, not a div of links: a screen reader has to be told this is a set
 * of options attached to the input, how many there are, and which one is
 * active. The input owns `aria-expanded` and `aria-activedescendant`; this
 * owns the options.
 *
 * Suggestions are a way to *get somewhere*, not a results page in miniature —
 * so they are names only, and choosing one goes straight to the product rather
 * than to a search for its name.
 */
export function SearchSuggestions({
  query,
  inputId,
  onNavigate,
}: {
  query: string;
  inputId: string;
  onNavigate: () => void;
}) {
  const router = useRouter();
  const [debounced, setDebounced] = useState('');

  // Debounced: a request per keystroke would put a query on the wire for
  // "d", "di", "dia"… none of which anyone will read.
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), 200);
    return () => clearTimeout(timer);
  }, [query]);

  const { data } = useQuery({
    queryKey: ['autocomplete', debounced],
    queryFn: () => autocomplete(debounced),
    // Two characters is where a suggestion starts being about something.
    enabled: debounced.length >= 2,
    retry: false,
  });

  const suggestions = data ?? [];
  if (suggestions.length === 0) return null;

  return (
    <ul
      id={`${inputId}-suggestions`}
      role="listbox"
      aria-label="Search suggestions"
      className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-s border border-border bg-surface shadow-lg"
    >
      {suggestions.map((suggestion) => (
        <li key={suggestion.productId} role="option" aria-selected={false}>
          <button
            type="button"
            // `onMouseDown` rather than `onClick`: a click fires after blur,
            // and blur closes this list, so the button would be gone before
            // the click landed.
            onMouseDown={(event) => {
              event.preventDefault();
              onNavigate();
              router.push(`/product/${suggestion.slug}`);
            }}
            className="block w-full px-3 py-2 text-left text-sm hover:bg-surface-alt"
          >
            {suggestion.name}
          </button>
        </li>
      ))}
    </ul>
  );
}
