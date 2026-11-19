import type { ReactNode } from 'react';
import { Card } from './card';
import { StatusMessage } from './status-message';

type StatePanelProps = {
  title: string;
  description: string;
  heading?: 'h1' | 'h2';
  actions?: ReactNode;
  announce?: boolean;
};

export function StatePanel({
  title, description, heading: Heading = 'h2', actions, announce = false,
}: StatePanelProps) {
  return (
    <Card as="section" className="state-panel">
      <Heading>{title}</Heading>
      {announce ? <StatusMessage>{description}</StatusMessage> : <p>{description}</p>}
      {actions && <div className="state-panel-actions">{actions}</div>}
    </Card>
  );
}
