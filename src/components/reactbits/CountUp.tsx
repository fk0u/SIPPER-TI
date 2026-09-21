'use client';

import React, { useEffect, useState, useRef } from 'react';

interface CountUpProps {
  to: number;
  from?: number;
  direction?: 'up' | 'down';
  delay?: number;
  duration?: number;
  className?: string;
  startWhen?: boolean;
  separator?: string;
}

export const CountUp: React.FC<CountUpProps> = ({
  to,
  from = 0,
  direction = 'up',
  delay = 0,
  duration = 1.2,
  className = '',
  startWhen = true,
  separator = '',
}) => {
  const [count, setCount] = useState<number>(from);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!startWhen) return;

    let startTimestamp: number | null = null;
    let frameId: number;

    const timeout = setTimeout(() => {
      const step = (timestamp: number) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / (duration * 1000), 1);
        
        // Ease out expo
        const easeOutProgress = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
        
        const currentCount = direction === 'up'
          ? Math.round(from + (to - from) * easeOutProgress)
          : Math.round(from - (from - to) * easeOutProgress);

        setCount(currentCount);

        if (progress < 1) {
          frameId = requestAnimationFrame(step);
        }
      };

      frameId = requestAnimationFrame(step);
    }, delay * 1000);

    return () => {
      clearTimeout(timeout);
      cancelAnimationFrame(frameId);
    };
  }, [to, from, duration, delay, startWhen, direction]);

  const formatted = separator
    ? count.toLocaleString('id-ID')
    : count.toString();

  return (
    <span ref={ref} className={`inline-block font-mono ${className}`}>
      {formatted}
    </span>
  );
};

export default CountUp;
