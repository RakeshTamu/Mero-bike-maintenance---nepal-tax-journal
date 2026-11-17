import React, { useEffect, useState } from 'react';

export type VehicleImageVariant = 'hero' | 'card' | 'thumb' | 'avatar';

export interface VehicleImageProps {
  photoUrl?: string | null;
  name?: string;
  variant?: VehicleImageVariant;
  /** Surface CSS color variable or value for edge-fade blending (hero & card variants) */
  blendToSurface?: string;
  /** Subtle dark Himalayan ridge backdrop behind hero/card visuals */
  showBackdropMountains?: boolean;
  className?: string;
  imgClassName?: string;
}

/**
 * Model-neutral street/commuter motorcycle side-profile illustration in graphite & silver tones.
 * Used consistently across Mero Bike whenever a vehicle has no uploaded photograph.
 * Deliberately neutral (not modeled after any specific bike like an XR 190LS) so it never
 * misrepresents the user's actual motorcycle.
 */
export const NeutralMotorcycleIllustration: React.FC<{
  className?: string;
  compact?: boolean;
}> = ({ className = 'w-full h-full', compact = false }) => {
  return (
    <svg
      viewBox="0 0 280 160"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="mb-moto-body" x1="40" y1="36" x2="220" y2="128" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#3B434B" />
          <stop offset="55%" stopColor="#262C32" />
          <stop offset="100%" stopColor="#181C20" />
        </linearGradient>
        <linearGradient id="mb-moto-tank" x1="120" y1="44" x2="188" y2="78" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#56606B" />
          <stop offset="48%" stopColor="#353C44" />
          <stop offset="100%" stopColor="#20252A" />
        </linearGradient>
        <linearGradient id="mb-moto-silver" x1="50" y1="60" x2="230" y2="120" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#AEB7C0" stopOpacity="0.62" />
          <stop offset="50%" stopColor="#7C8690" stopOpacity="0.42" />
          <stop offset="100%" stopColor="#AEB7C0" stopOpacity="0.52" />
        </linearGradient>
        <radialGradient id="mb-moto-ground" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#000000" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Subtle studio ground shadow */}
      {!compact && (
        <ellipse cx="142" cy="141" rx="92" ry="7" fill="url(#mb-moto-ground)" />
      )}

      {/* Rear wheel: neutral 17-inch street tire, rim & multi-spoke hub */}
      <g>
        <circle cx="72" cy="108" r="28" fill="#111417" stroke="#5E6873" strokeOpacity="0.48" strokeWidth="4.5" />
        <circle cx="72" cy="108" r="20.5" fill="none" stroke="url(#mb-moto-silver)" strokeWidth="1.6" />
        <circle cx="72" cy="108" r="11" fill="none" stroke="#8C96A0" strokeOpacity="0.32" strokeWidth="1.2" />
        <path
          d="M72 88 L72 128 M52 108 L92 108 M58 94 L86 122 M86 94 L58 122"
          stroke="#8C96A0"
          strokeOpacity="0.28"
          strokeWidth="1.3"
        />
        <circle cx="72" cy="108" r="4.8" fill="#2A3036" stroke="#9EA8B2" strokeOpacity="0.6" strokeWidth="1.2" />
      </g>

      {/* Front wheel: neutral 17-inch street tire, brake rotor & multi-spoke hub */}
      <g>
        <circle cx="208" cy="108" r="28" fill="#111417" stroke="#5E6873" strokeOpacity="0.52" strokeWidth="4.5" />
        <circle cx="208" cy="108" r="20.5" fill="none" stroke="url(#mb-moto-silver)" strokeWidth="1.6" />
        <circle cx="208" cy="108" r="12.5" fill="none" stroke="#9EA8B2" strokeOpacity="0.35" strokeWidth="1.4" />
        <path
          d="M208 88 L208 128 M188 108 L228 108 M194 94 L222 122 M222 94 L194 122"
          stroke="#8C96A0"
          strokeOpacity="0.28"
          strokeWidth="1.3"
        />
        <circle cx="208" cy="108" r="4.8" fill="#2A3036" stroke="#9EA8B2" strokeOpacity="0.65" strokeWidth="1.2" />
      </g>

      {/* Low street front mudguard hugging the front tire */}
      <path
        d="M179 92 C186 77 204 74 224 81 C228 83 231 86 232 89 C220 84 202 83 187 91 Z"
        fill="url(#mb-moto-tank)"
        stroke="#929BA3"
        strokeOpacity="0.45"
        strokeWidth="1.1"
      />

      {/* Swingarm & rear suspension linkage */}
      <path
        d="M72 108 L121 97 L125 107 L76 112 Z"
        fill="#242A30"
        stroke="#8E98A2"
        strokeOpacity="0.38"
        strokeWidth="1.1"
      />
      <path
        d="M101 76 L118 99"
        stroke="#929BA3"
        strokeOpacity="0.48"
        strokeWidth="3"
        strokeLinecap="round"
      />

      {/* Engine crankcase, cylinder & side cover */}
      <path
        d="M116 74 L156 72 L164 102 L144 114 L120 112 L112 96 Z"
        fill="#1D2227"
        stroke="#8C96A0"
        strokeOpacity="0.38"
        strokeWidth="1.2"
      />
      <path
        d="M132 76 L154 75 L157 90 L134 91 Z"
        fill="#2C333A"
        stroke="#A4AEB8"
        strokeOpacity="0.28"
        strokeWidth="1"
      />
      <circle cx="136" cy="102" r="7.5" fill="#262C33" stroke="#929BA3" strokeOpacity="0.4" strokeWidth="1.1" />

      {/* Horizontal street exhaust header & muffler */}
      <path
        d="M155 86 C163 97 160 110 144 113 L112 114 L64 104 L66 96 L114 106 L142 106 C152 104 154 96 150 88 Z"
        fill="#2A3037"
        stroke="#A6B0BA"
        strokeOpacity="0.42"
        strokeWidth="1.1"
      />

      {/* Frame trellis & neutral side panel */}
      <path
        d="M66 64 L118 72 L140 69 L158 55 L170 60 L152 80 L114 92 L78 73 Z"
        fill="url(#mb-moto-body)"
        stroke="#8C96A0"
        strokeOpacity="0.32"
        strokeWidth="1.1"
      />

      {/* Classic neutral level street seat & subtle tail cowl */}
      <path
        d="M49 62 C61 60 80 62 103 65 C115 66 123 64 130 61 L126 71 C111 74 90 73 56 68 Z"
        fill="#1B1F24"
        stroke="#8C96A0"
        strokeOpacity="0.38"
        strokeWidth="1.1"
      />
      <path
        d="M46 61 L69 65 L61 70 L43 65 Z"
        fill="#343B42"
        stroke="#A2ACB6"
        strokeOpacity="0.4"
        strokeWidth="1"
      />

      {/* Sculpted teardrop neutral fuel tank */}
      <path
        d="M123 62 C131 48 153 43 173 49 C180 51 183 58 178 66 C168 74 143 75 126 69 Z"
        fill="url(#mb-moto-tank)"
        stroke="#B4BEC8"
        strokeOpacity="0.52"
        strokeWidth="1.2"
      />
      {/* Restrained silver highlight contour on upper tank */}
      <path
        d="M134 54 C146 48 161 48 172 52"
        stroke="#D2DAE2"
        strokeOpacity="0.45"
        strokeWidth="1.3"
        strokeLinecap="round"
      />

      {/* Conventional front fork stanchions & triple clamp */}
      <path
        d="M174 42 L182 44 L211 107 L205 109 L175 49 Z"
        fill="#2E353C"
        stroke="#B0BAC4"
        strokeOpacity="0.52"
        strokeWidth="1.2"
      />

      {/* Compact street headlamp & instrument cluster */}
      <path
        d="M178 44 L193 43 C197 46 198 53 194 57 L180 57 Z"
        fill="#272D34"
        stroke="#A6B0BA"
        strokeOpacity="0.5"
        strokeWidth="1.2"
      />
      <path
        d="M194 45 C197 48 197 53 194 56"
        stroke="#DCE3EA"
        strokeOpacity="0.65"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      {/* Upright handlebar & mirror */}
      <path
        d="M175 42 L166 34 L158 34"
        stroke="#A2ACB6"
        strokeOpacity="0.62"
        strokeWidth="2.1"
        strokeLinecap="round"
      />
      <path
        d="M167 34 L161 23 M154 21 C154 18.5 164 18.5 164 21 C164 23.5 154 23.5 154 21 Z"
        stroke="#929BA3"
        strokeOpacity="0.52"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  );
};

export const VehicleImage: React.FC<VehicleImageProps> = ({
  photoUrl,
  name,
  variant = 'thumb',
  blendToSurface = 'var(--color-surface-1)',
  showBackdropMountains = false,
  className = '',
  imgClassName = ''
}) => {
  const [hasError, setHasError] = useState(false);

  const normalizedUrl = typeof photoUrl === 'string' ? photoUrl.trim() : '';

  useEffect(() => {
    setHasError(false);
  }, [normalizedUrl]);

  const showSavedPhoto = Boolean(normalizedUrl) && !hasError;

  if (variant === 'avatar' || variant === 'thumb') {
    const defaultBox =
      variant === 'avatar'
        ? 'w-8 h-8 rounded-lg'
        : 'w-12 h-12 rounded-xl';

    return (
      <div
        className={`${defaultBox} relative overflow-hidden bg-[var(--color-surface-2)] border border-[var(--color-border)] clay-inset flex items-center justify-center shrink-0 ${className}`}
      >
        {showSavedPhoto ? (
          <img
            src={normalizedUrl}
            alt={name || 'Vehicle'}
            referrerPolicy="no-referrer"
            draggable={false}
            onError={() => setHasError(true)}
            className={`w-full h-full object-cover object-center ${imgClassName}`}
          />
        ) : (
          <NeutralMotorcycleIllustration
            compact
            className={variant === 'avatar' ? 'w-7 h-5 opacity-90' : 'w-10 h-7 opacity-90'}
          />
        )}
      </div>
    );
  }

  // Hero & Card showcase variants
  const isHero = variant === 'hero';

  return (
    <div
      className={`relative overflow-hidden select-none ${className}`}
    >
      {/* Optional restrained Himalayan ridge contour backdrop */}
      {showBackdropMountains && (
        <svg
          viewBox="0 0 320 180"
          preserveAspectRatio="xMidYMid slice"
          className="absolute inset-0 w-full h-full text-[var(--color-text-secondary)] opacity-[0.12] pointer-events-none"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M0 155 L58 102 L98 128 L156 58 L208 108 L244 74 L320 132 L320 180 L0 180 Z"
            fill="currentColor"
            fillOpacity="0.45"
          />
          <path
            d="M45 160 L122 88 L175 130 L248 42 L320 108 L320 180 L45 180 Z"
            fill="currentColor"
            fillOpacity="0.72"
          />
        </svg>
      )}

      {showSavedPhoto ? (
        <img
          src={normalizedUrl}
          alt={name || 'Vehicle'}
          referrerPolicy="no-referrer"
          draggable={false}
          onError={() => setHasError(true)}
          className={`relative z-[1] w-full h-full object-cover object-center ${imgClassName}`}
        />
      ) : (
        <div
          className={`relative z-[1] w-full h-full flex items-center justify-center ${
            isHero ? 'px-2 pt-2 pb-1 justify-end' : 'p-3'
          }`}
        >
          <NeutralMotorcycleIllustration
            className={
              isHero
                ? 'w-[96%] max-w-[235px] h-auto max-h-[144px]'
                : 'w-[86%] max-w-[230px] h-auto max-h-[132px]'
            }
          />
        </div>
      )}

      {/* Subtle directional fade scrims blending image cleanly into card surface */}
      {isHero ? (
        <div
          aria-hidden="true"
          className="absolute inset-0 z-[2] pointer-events-none"
          style={{
            background: `linear-gradient(90deg, ${blendToSurface} 0%, transparent 42%), linear-gradient(0deg, ${blendToSurface} 0%, transparent 28%), linear-gradient(180deg, ${blendToSurface} 0%, transparent 18%)`
          }}
        />
      ) : (
        <div
          aria-hidden="true"
          className="absolute inset-0 z-[2] pointer-events-none"
          style={{
            background: `linear-gradient(0deg, ${blendToSurface} 0%, transparent 32%)`
          }}
        />
      )}
    </div>
  );
};
