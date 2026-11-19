import type { ComponentProps } from 'react';

type CardProps = ComponentProps<'article'> & { as?: 'article' | 'section' };

export function Card({ as: Element = 'article', className = '', ...props }: CardProps) {
  return <Element {...props} className={`ui-card ${className}`} />;
}
