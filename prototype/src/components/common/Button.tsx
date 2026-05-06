import { forwardRef } from 'react';
import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'ghost';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', className = '', type = 'button', ...rest },
  ref,
) {
  const variantClass = variant === 'primary' ? 'btn btn-primary' : 'btn btn-ghost';
  return <button ref={ref} type={type} className={`${variantClass} ${className}`.trim()} {...rest} />;
});
