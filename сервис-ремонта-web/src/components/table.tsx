import type { ComponentProps } from "react";

import { classNames } from "@/lib/class-names";

export const Table = ({ className, ...props }: ComponentProps<"table">) => (
  <div className="w-full overflow-x-auto rounded-lg border border-neutral-200">
    <table
      className={classNames("w-full caption-bottom text-sm text-neutral-950", className)}
      {...props}
    />
  </div>
);

export const TableHeader = ({ className, ...props }: ComponentProps<"thead">) => (
  <thead
    className={classNames("border-b border-neutral-200 bg-neutral-50", className)}
    {...props}
  />
);

export const TableBody = ({ className, ...props }: ComponentProps<"tbody">) => (
  <tbody className={classNames("[&_tr:last-child]:border-0", className)} {...props} />
);

export const TableFooter = ({ className, ...props }: ComponentProps<"tfoot">) => (
  <tfoot
    className={classNames("border-t border-neutral-200 bg-neutral-50 font-medium", className)}
    {...props}
  />
);

export const TableRow = ({ className, ...props }: ComponentProps<"tr">) => (
  <tr
    className={classNames(
      "border-b border-neutral-200 last:border-0 hover:bg-neutral-50",
      className,
    )}
    {...props}
  />
);

export const TableHead = ({ className, scope = "col", ...props }: ComponentProps<"th">) => (
  <th
    className={classNames(
      "px-4 py-3 text-left align-middle font-medium text-neutral-600",
      className,
    )}
    scope={scope}
    {...props}
  />
);

export const TableCell = ({ className, ...props }: ComponentProps<"td">) => (
  <td className={classNames("px-4 py-3 align-middle", className)} {...props} />
);

export const TableCaption = ({ className, ...props }: ComponentProps<"caption">) => (
  <caption
    className={classNames(
      "border-t border-neutral-200 px-4 py-3 text-left text-neutral-500",
      className,
    )}
    {...props}
  />
);
