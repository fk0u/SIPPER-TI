'use client';

import React from 'react';

interface ShinyTextProps {
  text: string;
  disabled?: boolean;
  speed?: number;
  className?: string;
}

export const ShinyText: React.FC<ShinyTextProps> = ({
  text,
  disabled = false,
  speed = 4,
  className = '',
}) => {
  const animationDuration = `${speed}s`;

  return (
    <span
      className={`inline-block text-transparent bg-clip-text ${
        disabled
          ? 'text-slate-900 dark:text-slate-100'
          : 'bg-gradient-to-r from-slate-900 via-blue-600 to-slate-900 dark:from-slate-100 dark:via-blue-400 dark:to-slate-100 bg-[length:200%_100%] animate-[shine_4s_ease-in-out_infinite]'
      } ${className}`}
      style={{
        animationDuration: disabled ? undefined : animationDuration,
      }}
    >
      {text}
    </span>
  );
};

export default ShinyText;
