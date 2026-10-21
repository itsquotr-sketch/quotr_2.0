"use client";

import { Popover } from "@base-ui/react/popover";

/**
 * Click, touch, and keyboard help. Hover does not open it.
 * The popup stays non-modal so the page can still scroll.
 */
export function HelpPopover({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Popover.Root modal={false}>
      <Popover.Trigger
        type="button"
        aria-label={label}
        openOnHover={false}
        className="inline-flex size-8 shrink-0 items-center justify-center rounded-full border border-border/80 bg-background text-sm font-medium text-muted-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
      >
        ?
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner
          side="bottom"
          align="start"
          sideOffset={6}
          collisionPadding={12}
          className="z-50 outline-none"
        >
          <Popover.Popup
            className="w-[min(18rem,calc(100vw-1.5rem))] rounded-xl bg-popover p-3 text-sm leading-5 text-popover-foreground shadow-lg ring-1 ring-foreground/10 outline-none"
          >
            <Popover.Description render={<div />} className="space-y-2">
              {children}
            </Popover.Description>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
