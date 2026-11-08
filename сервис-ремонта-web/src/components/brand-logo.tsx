export const BrandLogo = ({ className = "" }: { className?: string }) => (
  <img
    src="/images/enot-brand-logo.jpg"
    alt=""
    aria-hidden="true"
    className={`block shrink-0 object-cover ${className}`}
  />
);
