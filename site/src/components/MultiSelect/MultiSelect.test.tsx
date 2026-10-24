import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MultiSelect, { triggerLabel } from './MultiSelect';

const ITEMS = [
  { value: 'a', label: 'Apples' },
  { value: 'b', label: 'Bananas' },
  { value: 'c', label: 'Cherries' },
];

describe('triggerLabel', () => {
  it('names all, all but one, or the selection', () => {
    expect(triggerLabel(ITEMS, ['a', 'b', 'c'], 'All fruit')).toBe('All fruit');
    expect(triggerLabel(ITEMS, ['a', 'c'], 'All fruit')).toBe(
      'All but Bananas',
    );
    expect(triggerLabel(ITEMS, ['c'], 'All fruit')).toBe('Cherries');
  });
});

describe('MultiSelect', () => {
  it('toggles items and keeps at least one selected', async () => {
    const onChange = vi.fn();
    render(
      <MultiSelect
        label="Fruit"
        items={ITEMS}
        value={['a']}
        onChange={onChange}
        allLabel="All fruit"
      />,
    );
    const trigger = screen.getByRole('combobox', { name: 'Fruit' });
    expect(trigger).toHaveTextContent('Apples');

    await userEvent.click(trigger);
    await userEvent.click(
      await screen.findByRole('option', { name: 'Cherries' }),
    );
    expect(onChange).toHaveBeenLastCalledWith(['a', 'c']);

    // Clearing the only selected item is ignored.
    onChange.mockClear();
    await userEvent.click(screen.getByRole('option', { name: 'Apples' }));
    expect(onChange).not.toHaveBeenCalled();
  });
});
