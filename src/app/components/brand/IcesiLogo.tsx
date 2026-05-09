import positiveLogo from '../../assets/brand/icesi-logo-positive.svg';
import negativeLogo from '../../assets/brand/icesi-logo-negative.svg';

interface IcesiLogoProps {
  variant?: 'positive' | 'negative';
  className?: string;
  ariaLabel?: string;
}

export default function IcesiLogo({
  variant = 'positive',
  className = '',
  ariaLabel = 'Universidad Icesi',
}: IcesiLogoProps) {
  return (
    <img
      src={variant === 'negative' ? negativeLogo : positiveLogo}
      alt={ariaLabel}
      className={className}
      loading="eager"
      decoding="async"
    />
  );
}
