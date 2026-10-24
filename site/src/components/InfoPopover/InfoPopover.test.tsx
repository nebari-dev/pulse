import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import InfoPopover from './InfoPopover';

describe('InfoPopover', () => {
  it('opens on click with the explanation and a link to the sources page', async () => {
    render(
      <MemoryRouter>
        <InfoPopover topic="Daily downloads">
          <p>Stacked by type.</p>
        </InfoPopover>
      </MemoryRouter>,
    );
    expect(screen.queryByText('Stacked by type.')).not.toBeInTheDocument();
    await userEvent.click(
      screen.getByRole('button', { name: 'About: Daily downloads' }),
    );
    expect(await screen.findByText('Stacked by type.')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Where the data comes from' }),
    ).toHaveAttribute('href', '/sources');
  });
});
