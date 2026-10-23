import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { operator, operatorRepo, toIndex } from '@/test/fixtures';
import WhatChanged from './WhatChanged';

const indexOperator = toIndex([operator]).products[0];

describe('WhatChanged', () => {
  it('renders nothing when there is nothing to say', () => {
    const { container } = render(
      <MemoryRouter>
        <WhatChanged
          movers={{ up: [], down: [] }}
          releases={[]}
          quiet={[]}
          asOf="2026-10-11"
        />
      </MemoryRouter>,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('lists movers, releases and quiet repos, hiding empty sections', () => {
    render(
      <MemoryRouter>
        <WhatChanged
          movers={{
            up: [
              {
                product: indexOperator,
                comparison: { current: 120, previous: 60, delta: 1 },
              },
            ],
            down: [],
          }}
          releases={[]}
          quiet={[
            {
              product: operator,
              repo: operatorRepo,
              daysSincePush: 93,
            },
          ]}
          asOf="2026-10-11"
        />
      </MemoryRouter>,
    );
    expect(
      screen.getByRole('region', { name: 'Biggest movers' }),
    ).toHaveTextContent(/Nebari Operator\+100% increase120/);
    expect(
      screen.queryByRole('region', { name: 'Releases this week' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('region', { name: 'Repos that went quiet' }),
    ).toHaveTextContent('nebari-operator');
    expect(screen.getByText('93 d')).toBeInTheDocument();
  });
});
