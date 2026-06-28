import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './tabs';

describe('Tabs', () => {
  it('shows the default tab’s content and hides the other', () => {
    render(
      <Tabs defaultValue="a">
        <TabsList>
          <TabsTrigger value="a">A</TabsTrigger>
          <TabsTrigger value="b">B</TabsTrigger>
        </TabsList>
        <TabsContent value="a">Content A</TabsContent>
        <TabsContent value="b">Content B</TabsContent>
      </Tabs>,
    );
    expect(screen.getByText('Content A')).toBeVisible();
    expect(screen.queryByText('Content B')).not.toBeInTheDocument();
  });

  it('switches content when a different tab is clicked', async () => {
    const user = userEvent.setup();
    render(
      <Tabs defaultValue="a">
        <TabsList>
          <TabsTrigger value="a">A</TabsTrigger>
          <TabsTrigger value="b">B</TabsTrigger>
        </TabsList>
        <TabsContent value="a">Content A</TabsContent>
        <TabsContent value="b">Content B</TabsContent>
      </Tabs>,
    );
    // Radix's Tabs trigger activates on pointerdown, not the click event
    // itself — plain fireEvent.click never fires a pointerdown, so the tab
    // never actually switches; userEvent simulates the full real pointer
    // sequence a browser would dispatch.
    await user.click(screen.getByRole('tab', { name: 'B' }));
    expect(screen.getByText('Content B')).toBeVisible();
    expect(screen.queryByText('Content A')).not.toBeInTheDocument();
  });
});
