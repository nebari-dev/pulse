import { render, screen } from '@testing-library/react';
import PageHeader from './PageHeader';

describe('PageHeader', () => {
  it('renders the title as the page heading', () => {
    render(
      <PageHeader title="Releases" description="Cadence">
        <button type="button">ctl</button>
      </PageHeader>,
    );
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Releases',
    );
    expect(screen.getByText('Cadence')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'ctl' })).toBeInTheDocument();
  });

  it('renders a badge next to the title and no description when omitted', () => {
    render(<PageHeader title="Nebi" badge={<span>Product</span>} />);
    expect(screen.getByText('Product')).toBeInTheDocument();
    expect(screen.queryByRole('paragraph')).not.toBeInTheDocument();
  });
});
