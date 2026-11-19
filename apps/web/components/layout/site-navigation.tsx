'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const items = [
  { href: '/', label: 'Tổng quan' },
  { href: '/cho-nong-san', label: 'Chợ nông sản' },
  { href: '/chu-trang-trai/don', label: 'Chủ trại' },
] as const;

export function SiteNavigation() {
  const pathname = usePathname();

  return (
    <nav aria-label="Điều hướng chính">
      <ul className="site-nav">
        {items.map(({ href, label }) => {
          const current = pathname === href;
          const inMarket = href === '/cho-nong-san' && pathname.startsWith('/lo/');

          return (
            <li key={href}>
              <Link href={href} aria-current={current ? 'page' : inMarket ? 'location' : undefined}>
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
