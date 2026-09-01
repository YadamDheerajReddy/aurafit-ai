import { useId } from "react";
import { cn } from "@/lib/utils";

/**
 * The AuraFit brand mark — a gradient progress ring, echoing the macro rings
 * used throughout the product (UI/UX Brief, Design Philosophy). Rendered
 * inline so it stays crisp at any size; gradient IDs are namespaced per
 * instance to avoid collisions when multiple marks appear on one page.
 */
export function AuraMark({ className }: { className?: string }) {
  const uid = useId();
  const gradientId = `aura-gradient-${uid}`;
  const glowId = `aura-glow-${uid}`;
  const bgId = `aura-bg-${uid}`;

  return (
    <svg
      viewBox="0 0 1024 1024"
      className={cn("shrink-0", className)}
      role="img"
      aria-label="AuraFit AI"
    >
      <defs>
        <linearGradient id={gradientId} x1="150" y1="150" x2="874" y2="874" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#7C3AED" />
          <stop offset="1" stopColor="#0D9488" />
        </linearGradient>
        <radialGradient id={glowId} cx="512" cy="512" r="440" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#7C3AED" stopOpacity="0.45" />
          <stop offset="0.6" stopColor="#0D9488" stopOpacity="0.18" />
          <stop offset="1" stopColor="#0D9488" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={bgId} x1="0" y1="0" x2="1024" y2="1024" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#12162A" />
          <stop offset="1" stopColor="#0B0F19" />
        </linearGradient>
      </defs>

      <rect width="1024" height="1024" rx="224" fill={`url(#${bgId})`} />
      <circle cx="512" cy="512" r="440" fill={`url(#${glowId})`} />
      <circle
        cx="512"
        cy="512"
        r="300"
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth="68"
        strokeLinecap="round"
        strokeDasharray="1414 1885"
        transform="rotate(-90 512 512)"
      />
    </svg>
  );
}
