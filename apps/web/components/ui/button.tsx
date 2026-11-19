import type { ComponentProps } from 'react';

type ButtonProps = ComponentProps<'button'> & {
  variant?: 'outline' | 'quiet';
  size?: 'sm' | 'md';
};

export function Button({ type = 'button', variant = 'outline', size = 'md', ...props }: ButtonProps) {
  return <button type={type} {...props} className={`ui-button button-${variant} button-${size} ${props.className ?? ''}`} />;
}
