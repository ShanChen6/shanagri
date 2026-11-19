import type { ReactNode } from 'react';
export const metadata = {title: 'Shanagri'};
export default function Layout({children}:{children:ReactNode}) {
  return <html lang="vi"><body>{children}</body></html>;
}
