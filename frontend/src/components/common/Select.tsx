import { forwardRef } from 'react';
import type { SelectHTMLAttributes } from 'react';

type SelectProps = SelectHTMLAttributes<HTMLSelectElement>;

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className = '', children, ...rest },
  ref,
) {
  return (
    <select ref={ref} className={`input-control pr-8 ${className}`.trim()} {...rest}>
      {children}
    </select>
  );
});
