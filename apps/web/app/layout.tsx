import type { ReactNode } from 'react';
import { SiteHeader } from '../components/layout/site-header';
import '../styles/globals.css';

export const metadata = { title: 'Shanagri', icons: { icon: '/brand/symbol.png' } };

export default function Layout({ children }: { children: ReactNode }) {
  return <html lang="vi"><body>
    <SiteHeader />
    {children}
  </body></html>;
}
