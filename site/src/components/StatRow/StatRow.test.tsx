import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import StatTile from '@/components/StatTile';
import StatRow from './StatRow';

describe('StatRow', () => {
  it('renders its tiles, each with its own info button', async () => {
    render(
      <MemoryRouter>
        <StatRow>
          <StatTile
            label="Downloads"
            value="1.2K"
            delta={0.12}
            info={<p>Data through Oct 24.</p>}
          />
          <StatTile label="Tracked" value="3" />
        </StatRow>
      </MemoryRouter>,
    );
    expect(screen.getByText('Downloads')).toBeInTheDocument();
    expect(screen.getByText('1.2K')).toBeInTheDocument();
    expect(screen.getByText(/\+12%/)).toBeInTheDocument();
    expect(screen.getByText('increase')).toBeInTheDocument();
    expect(screen.queryByText('Data through Oct 24.')).not.toBeInTheDocument();
    expect(screen.getAllByRole('button')).toHaveLength(1);
    await userEvent.click(
      screen.getByRole('button', { name: 'About: Downloads' }),
    );
    expect(await screen.findByText('Data through Oct 24.')).toBeInTheDocument();
  });

  it('shows no delta line when there is no previous period to compare', () => {
    render(
      <StatRow>
        <StatTile label="Visits" value="40" delta={null} />
      </StatRow>,
    );
    expect(screen.getByText('40')).toBeInTheDocument();
    expect(screen.queryByText('—')).not.toBeInTheDocument();
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
  });
});
