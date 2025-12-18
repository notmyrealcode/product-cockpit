import React, { useEffect, useState } from 'react';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastProps {
  message: string;
  type?: ToastType;
  duration?: number;
  onClose: () => void;
}

export function Toast({ message, type = 'info', duration = 4000, onClose }: ToastProps) {
  const [isVisible, setIsVisible] = useState(true);
  const [isLeaving, setIsLeaving] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLeaving(true);
      setTimeout(onClose, 200); // Wait for animation to complete
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const handleClose = () => {
    setIsLeaving(true);
    setTimeout(onClose, 200);
  };

  const icons = {
    success: <CheckCircle size={16} className="text-success" />,
    error: <AlertCircle size={16} className="text-danger" />,
    info: <Info size={16} className="text-primary" />,
  };

  const borderColors = {
    success: 'border-success/30',
    error: 'border-danger/30',
    info: 'border-primary/30',
  };

  return (
    <div
      className={`
        fixed bottom-4 left-1/2 -translate-x-1/2 z-50
        flex items-center gap-2 px-4 py-3
        bg-neutral-0 border ${borderColors[type]} rounded-lg shadow-sm
        transition-all duration-200
        ${isLeaving ? 'opacity-0 translate-y-2' : 'opacity-100 translate-y-0'}
      `}
    >
      {icons[type]}
      <span className="text-sm text-neutral-700">{message}</span>
      <button
        onClick={handleClose}
        className="ml-2 text-neutral-400 hover:text-neutral-600"
      >
        <X size={14} />
      </button>
    </div>
  );
}
