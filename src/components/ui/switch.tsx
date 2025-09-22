import * as React from 'react';
import { cn } from '@/lib/utils';

export interface SwitchProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onChange'> {
  checked: boolean;
  onCheckedChange?: (checked: boolean) => void;
  size?: 'sm' | 'md';
}

export function Switch({ checked, onCheckedChange, className, size = 'md', ...props }: SwitchProps) {
  const width = size === 'sm' ? 'w-10' : 'w-12';
  const height = size === 'sm' ? 'h-6' : 'h-7';
  const knob = size === 'sm' ? 'size-5' : 'size-[22px]';
  const translate = checked ? (size === 'sm' ? 'translate-x-4' : 'translate-x-5') : 'translate-x-0';

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    onCheckedChange?.(!checked);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onCheckedChange?.(!checked);
    }
  };

  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={cn(
        'relative inline-flex items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
        width,
        height,
        checked ? 'bg-blue-600' : 'bg-gray-300',
        className,
      )}
      {...props}
    >
      <span
        className={cn(
          'pointer-events-none inline-block rounded-full bg-white shadow transition-transform',
          knob,
          'translate-x-0',
          translate,
        )}
      />
    </button>
  );
}

export default Switch;

