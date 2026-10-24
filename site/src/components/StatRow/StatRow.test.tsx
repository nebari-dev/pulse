import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import StatTile from '@/components/StatTile';
import StatRow from './StatRow';

describe('StatRow', () => {
  it('renders its tiles, with the provenance behind an info button', async () => {
    render(
      <MemoryRouter>
        <StatRow info={<p>Data through Oct 24</p>}>
          <StatTile
            label="Downloads"
            value="1.2K"
            delta={0.12}
            hint="vs. before"
          />
          <StatTile label="Tracked" value="3" hint="all products" />
        </StatRow>
      </MemoryRouter>,
    );
    expect(screen.getByText('Downloads')).toBeInTheDocument();
    expect(screen.getByText('1.2K')).toBeInTheDocument();
    expect(screen.getByText(/\+12%/)).toBeInTheDocument();
    expect(screen.getByText('increase')).toBeInTheDocument();
    expect(screen.queryByText('Data through Oct 24')).not.toBeInTheDocument();
    await userEvent.click(
      screen.getByRole('button', { name: 'About: About these figures' }),
    );
    expect(await screen.findByText('Data through Oct 24')).toBeInTheDocument();
  });

  it('shows only the hint when there is no delta to compare', () => {
    render(
      <StatRow>
        <StatTile
          label="Visits"
          value="40"
          delta={null}
          hint="no previous period"
        />
      </StatRow>,
    );
    expect(screen.getByText('no previous period')).toBeInTheDocument();
    expect(screen.queryByText('—')).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
