'use client';

interface LogoProps {
  variant?: 'default' | 'white' | 'compact';
  className?: string;
}

export function Logo({ variant = 'default', className = '' }: LogoProps) {
  const textColor = variant === 'white' ? 'text-white' : 'text-accent';
  const etColor = variant === 'white' ? 'text-white/80' : 'text-primary';

  if (variant === 'compact') {
    return (
      <div className={`flex items-center gap-1 ${className}`}>
        <span className="text-lg font-extrabold italic text-accent">G</span>
        <span className="text-sm font-normal italic text-primary">&</span>
        <span className="text-lg font-extrabold italic text-accent">D</span>
      </div>
    );
  }

  return (
    <div className={`flex flex-col leading-none ${className}`}>
      <div className="flex items-baseline gap-1.5">
        <span className={`text-sm sm:text-base font-extrabold italic tracking-tight ${textColor}`}>
          GROUPE
        </span>
        <span className={`text-xs sm:text-sm font-normal italic ${etColor}`}>
          ET
        </span>
      </div>
      <span className={`text-sm sm:text-base font-extrabold italic tracking-tight ${textColor}`}>
        DÉCOUVERTE
      </span>
    </div>
  );
}
