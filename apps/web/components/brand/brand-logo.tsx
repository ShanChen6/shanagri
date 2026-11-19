type LogoVariant = 'horizontal' | 'stacked' | 'symbol';

export function BrandLogo({ variant = 'horizontal' }: { variant?: LogoVariant }) {
  return <img className={`brand-logo logo-${variant}`} src={`/brand/${variant}.png`} alt="Shanagri" />;
}
