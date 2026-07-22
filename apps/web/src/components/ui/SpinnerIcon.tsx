interface SpinnerIconProps {
  className?: string;
  size?: number;
}

/** Classic 8-bar activity spinner (rotates via CSS). */
export function SpinnerIcon({ className = "", size = 20 }: SpinnerIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
      className={`animate-spin ${className}`}
    >
      {Array.from({ length: 8 }, (_, index) => (
        <rect
          key={index}
          x="10.5"
          y="2"
          width="3"
          height="6"
          rx="1.5"
          opacity={0.25 + (index / 7) * 0.75}
          transform={`rotate(${index * 45} 12 12)`}
        />
      ))}
    </svg>
  );
}
