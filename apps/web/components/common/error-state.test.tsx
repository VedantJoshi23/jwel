import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ErrorState, describeError } from './error-state';
import { ApiError } from '@/lib/api/client';

describe('describeError', () => {
  it('blames the connection, not us, for a fetch TypeError', () => {
    // A TypeError from fetch means the request never reached the API.
    const { title, description } = describeError(new TypeError('Failed to fetch'));

    expect(title).toBe('We could not reach the shop');
    expect(description).toMatch(/connection/i);
  });

  it('names a timeout as a timeout', () => {
    const timeout = new Error('timed out');
    timeout.name = 'TimeoutError';

    expect(describeError(timeout).title).toBe('That took too long');
  });

  it('treats an abort as a timeout rather than a fault', () => {
    const aborted = new Error('aborted');
    aborted.name = 'AbortError';

    expect(describeError(aborted).title).toBe('That took too long');
  });

  it('owns a server fault instead of blaming the customer', () => {
    // An ApiError means the API answered, so telling the customer to check
    // their internet would be misdirection.
    const { title, description } = describeError(new ApiError('Internal error', 500));

    expect(title).toBe('Something went wrong');
    expect(description).not.toMatch(/check your internet/i);
  });

  it('falls back safely for a non-Error throw', () => {
    expect(describeError('a string').title).toBe('Something went wrong');
    expect(describeError(undefined).title).toBe('Something went wrong');
  });
});

describe('ErrorState', () => {
  it('calls onRetry when the retry control is used', async () => {
    const onRetry = vi.fn();
    render(<ErrorState title="Broken" description="Details" onRetry={onRetry} />);

    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('renders no retry control when there is nothing useful to retry', () => {
    render(<ErrorState title="Broken" description="Details" />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('surfaces the digest so a customer can quote it and we can find the log', () => {
    render(<ErrorState title="Broken" description="Details" digest="abc123" />);

    expect(screen.getByTestId('error-digest')).toHaveTextContent('abc123');
  });

  it('omits the reference line entirely when there is no digest', () => {
    render(<ErrorState title="Broken" description="Details" />);

    expect(screen.queryByTestId('error-digest')).not.toBeInTheDocument();
  });
});
