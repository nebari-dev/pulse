import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SearchBox from './SearchBox';

describe('SearchBox', () => {
  it('reports typing and clears', async () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <SearchBox value="" onChange={onChange} label="Search products" />,
    );
    await userEvent.type(
      screen.getByRole('searchbox', { name: 'Search products' }),
      'n',
    );
    expect(onChange).toHaveBeenLastCalledWith('n');
    expect(
      screen.queryByRole('button', { name: 'Clear search' }),
    ).not.toBeInTheDocument();

    rerender(<SearchBox value="neb" onChange={onChange} label="Search" />);
    await userEvent.click(screen.getByRole('button', { name: 'Clear search' }));
    expect(onChange).toHaveBeenLastCalledWith('');
  });
});
