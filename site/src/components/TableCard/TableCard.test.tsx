import { render, screen } from '@testing-library/react';
import TableCard from './TableCard';

describe('TableCard', () => {
  it('renders the title, controls, table and footnote', () => {
    render(
      <TableCard
        title="Top pages"
        controls={<button type="button">filter</button>}
        footnote="Snapshot taken today."
      >
        <table aria-label="pages" />
      </TableCard>,
    );
    expect(screen.getByText('Top pages')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'filter' })).toBeInTheDocument();
    expect(screen.getByRole('table', { name: 'pages' })).toBeInTheDocument();
    expect(screen.getByText('Snapshot taken today.')).toBeInTheDocument();
  });
});
