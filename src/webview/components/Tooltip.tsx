import React, { useState, useRef, useEffect } from 'react';
import { cn } from '../lib/utils';

interface TooltipProps {
  content: string;
  children: React.ReactNode;
  delay?: number;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

export function Tooltip({ content, children, delay = 150, position = 'top' }: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout>();

  const showTooltip = () => {
    timeoutRef.current = setTimeout(() => {
      if (triggerRef.current) {
        const rect = triggerRef.current.getBoundingClientRect();
        setCoords({
          x: rect.left + rect.width / 2,
          y: position === 'bottom' ? rect.bottom : rect.top
        });
      }
      setIsVisible(true);
    }, delay);
  };

  const hideTooltip = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsVisible(false);
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  if (!content) {
    return <>{children}</>;
  }

  return (
    <>
      <div
        ref={triggerRef}
        onMouseEnter={showTooltip}
        onMouseLeave={hideTooltip}
        onFocus={showTooltip}
        onBlur={hideTooltip}
        className="inline-flex"
      >
        {children}
      </div>
      {isVisible && (
        <div
          className={cn(
            'fixed z-[100] px-2 py-1 text-xs font-medium text-neutral-0 bg-neutral-800 rounded shadow-lg',
            'pointer-events-none whitespace-nowrap',
            'animate-in fade-in-0 zoom-in-95 duration-100'
          )}
          style={{
            left: coords.x,
            top: position === 'bottom' ? coords.y + 6 : coords.y - 6,
            transform: `translateX(-50%) ${position === 'bottom' ? '' : 'translateY(-100%)'}`
          }}
        >
          {content}
        </div>
      )}
    </>
  );
}
