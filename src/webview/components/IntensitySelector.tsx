import React from 'react';
import { Zap, Scale, Search } from 'lucide-react';
import { cn } from '../lib/utils';
import type { ThoughtPartnerIntensity } from '../types';

interface IntensitySelectorProps {
  value: ThoughtPartnerIntensity;
  onChange: (intensity: ThoughtPartnerIntensity) => void;
}

interface IntensityOption {
  id: ThoughtPartnerIntensity;
  title: string;
  description: string;
  icon: React.ReactNode;
}

const intensityOptions: IntensityOption[] = [
  {
    id: 'minimal',
    title: 'Minimal',
    description: 'Quick start, questions only when unclear',
    icon: <Zap size={18} />,
  },
  {
    id: 'balanced',
    title: 'Balanced',
    description: "Clarifying questions to ensure we're aligned",
    icon: <Scale size={18} />,
  },
  {
    id: 'deep-dive',
    title: 'Deep Dive',
    description: 'Thorough exploration, suggestions, edge cases',
    icon: <Search size={18} />,
  },
];

export function IntensitySelector({ value, onChange }: IntensitySelectorProps) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs text-neutral-500">How involved should Shepherd be?</p>
      <div className="flex gap-2">
        {intensityOptions.map((option) => {
          const isSelected = value === option.id;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => onChange(option.id)}
              className={cn(
                // Compact card styles
                'flex-1 flex flex-col items-center text-center px-2 py-2 rounded-md border transition-fast',
                // Default state
                'border-neutral-200 bg-neutral-0',
                // Hover state
                'hover:bg-neutral-50 hover:border-neutral-300',
                // Selected state - primary border/ring
                isSelected && 'border-primary ring-1 ring-primary bg-primary/5'
              )}
            >
              <div
                className={cn(
                  'mb-1',
                  isSelected ? 'text-primary' : 'text-neutral-400'
                )}
              >
                {option.icon}
              </div>
              <span
                className={cn(
                  'text-xs font-medium',
                  isSelected ? 'text-primary' : 'text-neutral-800'
                )}
              >
                {option.title}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
