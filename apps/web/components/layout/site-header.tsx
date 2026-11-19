import Link from 'next/link';
import { BrandLogo } from '../brand/brand-logo';
import { SiteNavigation } from './site-navigation';

export function SiteHeader() {
  return (
    <>
      <a className="skip-link" href="#main-content">Chuyển đến nội dung chính</a>
      <header className="site-header">
        <div className="header-inner">
          <Link href="/"><BrandLogo /></Link>
          <SiteNavigation />
        </div>
      </header>
    </>
  );
}
