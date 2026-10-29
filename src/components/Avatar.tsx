import React from 'react';

interface AvatarProps {
  name: string;
  color?: string;
  src?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const COLOR_MAP: Record<string, string> = {
  slate: 'bg-slate-800 text-white ring-slate-200',
  blue: 'bg-blue-700 text-white ring-blue-100',
  emerald: 'bg-emerald-700 text-white ring-emerald-100',
  violet: 'bg-violet-700 text-white ring-violet-100',
  amber: 'bg-amber-600 text-white ring-amber-100',
  teal: 'bg-teal-700 text-white ring-teal-100',
  rose: 'bg-rose-700 text-white ring-rose-100',
  indigo: 'bg-indigo-700 text-white ring-indigo-100',
  cyan: 'bg-cyan-700 text-white ring-cyan-100',
};

const SIZE_MAP: Record<NonNullable<AvatarProps['size']>, string> = {
  xs: 'w-6 h-6 text-[10px]',
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-14 h-14 text-base',
  xl: 'w-20 h-20 text-xl',
};

export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return 'AT';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function pickColorForName(name: string, explicitColor?: string): string {
  if (explicitColor && COLOR_MAP[explicitColor]) {
    return COLOR_MAP[explicitColor];
  }
  const keys = Object.keys(COLOR_MAP);
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return COLOR_MAP[keys[Math.abs(hash) % keys.length]];
}

function lookupStoredAvatar(name: string): { avatarUrl?: string; avatarColor?: string } {
  if (!name) return {};
  try {
    const raw = localStorage.getItem('atdp_wf_prod_v2_employees');
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Array<{
      fullName?: string;
      avatarUrl?: string;
      avatarColor?: string;
    }>;
    if (!Array.isArray(parsed)) return {};
    const target = name.trim().toLowerCase();
    const match = parsed.find((e) => e.fullName?.trim().toLowerCase() === target);
    if (match) {
      return { avatarUrl: match.avatarUrl, avatarColor: match.avatarColor };
    }
  } catch {
    // Ignore storage read errors
  }
  return {};
}

export const Avatar: React.FC<AvatarProps> = ({
  name,
  color,
  src,
  size = 'sm',
  className = '',
}) => {
  const stored = !src || !color ? lookupStoredAvatar(name) : {};
  const resolvedSrc = src || stored.avatarUrl;
  const resolvedColor = color || stored.avatarColor;
  const initials = getInitials(name);
  const colorClasses = pickColorForName(name, resolvedColor);
  const sizeClasses = SIZE_MAP[size];

  if (resolvedSrc) {
    return (
      <img
        src={resolvedSrc}
        alt={name}
        title={name}
        className={`inline-block rounded-full object-cover select-none ring-2 ring-slate-200 shrink-0 ${sizeClasses} ${className}`}
      />
    );
  }

  return (
    <div
      title={name}
      className={`inline-flex items-center justify-center rounded-full font-display font-semibold select-none ring-2 shrink-0 ${sizeClasses} ${colorClasses} ${className}`}
    >
      {initials}
    </div>
  );
};

interface AvatarStackProps {
  names: string[];
  onSelectPerson?: (name: string) => void;
}

export const AvatarStack: React.FC<AvatarStackProps> = ({ names, onSelectPerson }) => {
  if (!names || names.length === 0) {
    return <span className="text-xs text-slate-400">Unassigned</span>;
  }

  return (
    <div className="flex items-center -space-x-2">
      {names.slice(0, 3).map((person) => (
        <button
          key={person}
          type="button"
          onClick={(e) => {
            if (onSelectPerson) {
              e.stopPropagation();
              onSelectPerson(person);
            }
          }}
          title={`Assigned: ${person}`}
          className="relative inline-block rounded-full transition-transform hover:scale-110 hover:z-10 focus:outline-none"
        >
          <Avatar name={person} size="sm" className="ring-2 ring-white" />
        </button>
      ))}
      {names.length > 3 && (
        <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 text-slate-700 text-xs font-medium ring-2 ring-white">
          +{names.length - 3}
        </span>
      )}
    </div>
  );
};
