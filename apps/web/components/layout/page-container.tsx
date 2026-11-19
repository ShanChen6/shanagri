import type { ComponentProps } from 'react';

export function PageContainer(props: ComponentProps<'main'>) {
  return <main id="main-content" tabIndex={-1} {...props} className={`page-container ${props.className ?? ''}`} />;
}
