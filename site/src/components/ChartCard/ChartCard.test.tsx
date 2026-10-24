import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ChartCard from './ChartCard';

describe('ChartCard', () => {
  it('shows the title, an info button and the footnote', () => {
    render(
      <MemoryRouter>
        <ChartCard title="Stars" info="How to read it" footnote="Since Oct 1.">
          <div>chart</div>
        </ChartCard>
      </MemoryRouter>,
    );
    expect(screen.getByText('Stars')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'About: Stars' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Since Oct 1.')).toBeInTheDocument();
  });

  it('has no info button without info', () => {
    render(
      <ChartCard title="Stars">
        <div>chart</div>
      </ChartCard>,
    );
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
