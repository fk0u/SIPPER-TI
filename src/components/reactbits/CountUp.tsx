'use client';

import React, { useEffect, useState } from 'react';

interface CountUpProps {
  to: number;
  duration?: number;
  className?: string;
}

export const CountUp: React.FC<CountUpProps> = ({ to, duration = 1.2, className = '' }) => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let start: number | null = null;
    let frameId: number;

    const step = (timestamp: number) => {
      start ??= timestamp;
      const progress = Math.min((timestamp - start) / (duration * 1000), 1);
      // Ease out expo
      const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      setCount(Math.round(to * eased));
      if (progress < 1) frameId = requestAnimationFrame(step);
    };

    frameId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frameId);
  }, [to, duration]);

  return <span className={`inline-block font-mono ${className}`}>{count}</span>;
};
