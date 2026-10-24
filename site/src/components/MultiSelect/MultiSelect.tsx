import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export interface MultiSelectItem<T extends string> {
  value: T;
  label: string;
}

interface MultiSelectProps<T extends string> {
  /** Accessible name of the trigger. */
  label: string;
  items: MultiSelectItem<T>[];
  value: readonly T[];
  onChange: (value: T[]) => void;
  /** Trigger text when every item is selected, e.g. "All sources". */
  allLabel: string;
  className?: string;
}

/**
 * What the trigger reads: the all-label, "All but X" when one item of three
 * or more is left out, otherwise the selected labels in item order.
 */
export function triggerLabel<T extends string>(
  items: MultiSelectItem<T>[],
  value: readonly T[],
  allLabel: string,
): string {
  const selected = items.filter((i) => value.includes(i.value));
  if (selected.length === items.length) return allLabel;
  const missing = items.filter((i) => !value.includes(i.value));
  if (items.length > 2 && missing.length === 1) {
    return `All but ${missing[0].label}`;
  }
  return selected.map((i) => i.label).join(', ');
}

/**
 * A dropdown of checkable items. At least one item stays selected: clearing
 * the last one is ignored, since an empty filter would only show nothing.
 */
function MultiSelect<T extends string>({
  label,
  items,
  value,
  onChange,
  allLabel,
  className,
}: MultiSelectProps<T>) {
  return (
    <Select
      multiple
      items={items}
      value={items.filter((i) => value.includes(i.value)).map((i) => i.value)}
      onValueChange={(next) => {
        const list = next as T[];
        if (list.length > 0) onChange(list);
      }}
    >
      <SelectTrigger aria-label={label} className={className}>
        <SelectValue>{() => triggerLabel(items, value, allLabel)}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {items.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export default MultiSelect;
