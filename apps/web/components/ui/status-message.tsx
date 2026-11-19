import type { ComponentProps } from 'react';

export function StatusMessage(props: ComponentProps<'p'>) {
  return <p role="status" {...props} />;
}
