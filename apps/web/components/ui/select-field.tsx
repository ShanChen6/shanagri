import type { ComponentProps } from 'react';

export function SelectField({ label, ...props }: ComponentProps<'select'> & { label: string }) {
  return <label className="ui-field">{label}<select {...props} /></label>;
}
