import { Popover } from '@base-ui/react/popover';
import { Info } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

interface InfoPopoverProps {
  /** What the popover explains, e.g. "Daily downloads by type". */
  topic: string;
  /** A few short paragraphs or a list; plain prose reads best. */
  children: ReactNode;
}

/**
 * The (i) next to a chart or table title: how to read it, opened on click so
 * the explanation is one step away instead of crowding the card. Every one
 * ends with a link to the Data sources page for the full detail.
 */
function InfoPopover({ topic, children }: InfoPopoverProps) {
  return (
    <Popover.Root>
      <Popover.Trigger
        render={
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={`About: ${topic}`}
            className="text-muted-foreground"
          />
        }
      >
        <Info aria-hidden="true" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner
          side="bottom"
          align="start"
          sideOffset={6}
          className="isolate z-50"
        >
          <Popover.Popup className="flex w-80 max-w-[calc(100vw-2rem)] origin-(--transform-origin) flex-col gap-2 rounded-lg bg-popover p-4 text-popover-foreground text-sm shadow-md outline-none ring-1 ring-foreground/10 data-[ending-style]:scale-95 data-[starting-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 motion-safe:transition-[opacity,transform] motion-safe:duration-(--duration-fast) motion-safe:ease-(--ease-emphasized) [&_li]:ml-4 [&_li]:list-disc [&_p]:text-muted-foreground [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-1 [&_ul]:text-muted-foreground">
            <Popover.Title className="font-medium">{topic}</Popover.Title>
            {children}
            <Link
              to="/sources"
              className="text-primary text-xs underline-offset-4 hover:underline"
            >
              Where the data comes from
            </Link>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

export default InfoPopover;
