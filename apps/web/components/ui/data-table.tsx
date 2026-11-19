import type { ReactNode } from 'react';

export function DataTable({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="table-scroll" role="region" aria-label={label} tabIndex={0}>
      <table aria-label={label}>{children}</table>
    </div>
  );
}
