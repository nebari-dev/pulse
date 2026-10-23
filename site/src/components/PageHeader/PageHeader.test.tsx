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
});
