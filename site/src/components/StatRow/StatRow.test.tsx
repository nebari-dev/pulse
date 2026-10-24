import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import StatTile from '@/components/StatTile';
import StatRow from './StatRow';

describe('StatRow', () => {
  it('renders its tiles and the note', () => {
    render(
      <StatRow note="Data through Oct 24">
        <StatTile
          label="Downloads"
          value="1.2K"
          delta={0.12}
          hint="vs. before"
        />
        <StatTile label="Tracked" value="3" hint="all products" />
      </StatRow>,
    );
    expect(screen.getByText('Downloads')).toBeInTheDocument();
    expect(screen.getByText('1.2K')).toBeInTheDocument();
    expect(screen.getByText(/\+12%/)).toBeInTheDocument();
    expect(screen.getByText('increase')).toBeInTheDocument();
    expect(screen.getByText('Data through Oct 24')).toBeInTheDocument();
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
  });
});
