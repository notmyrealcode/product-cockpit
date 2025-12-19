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
    <div className="space-y-2">
      <p className="text-sm text-neutral-600">How involved should Shepherd be?</p>
      <div className="flex gap-3">
        {intensityOptions.map((option) => {
          const isSelected = value === option.id;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => onChange(option.id)}
              className={cn(
                // Base card styles from design guide
                'flex-1 flex flex-col items-center text-center p-4 rounded-md border transition-fast',
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
                  'mb-2',
                  isSelected ? 'text-primary' : 'text-neutral-400'
                )}
              >
                {option.icon}
              </div>
              <span
                className={cn(
                  'text-base font-medium mb-1',
                  isSelected ? 'text-primary' : 'text-neutral-800'
                )}
              >
                {option.title}
              </span>
              <span className="text-sm text-neutral-500 leading-snug">
                {option.description}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
