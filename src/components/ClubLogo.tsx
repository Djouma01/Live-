import React, { useState } from 'react';

interface ClubLogoProps {
  src?: string;
  name: string;
  abbreviation?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const ClubLogo: React.FC<ClubLogoProps> = ({
  src,
  name,
  abbreviation,
  size = 'md',
}) => {
  const [failed, setFailed] = useState(false);

  const dims =
    size === 'sm'
      ? 'w-7 h-7 text-[10px]'
      : size === 'lg'
      ? 'w-14 h-14 text-sm'
      : 'w-9 h-9 text-xs';

  const initials = (abbreviation || name.slice(0, 3)).toUpperCase().slice(0, 3);

  if (!src || failed) {
    return (
      <div
        aria-hidden="true"
        className={`${dims} shrink-0 rounded-full bg-gradient-to-br from-violet-600/30 to-zinc-900 border border-violet-500/30 flex items-center justify-center font-bold tracking-tight text-violet-200 select-none`}
      >
        {initials}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={`Logo ${name}`}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={`${dims} shrink-0 object-contain rounded-full bg-white/5 p-0.5`}
    />
  );
};
