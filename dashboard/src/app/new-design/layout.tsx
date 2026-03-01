"use client";

import { useMemo } from "react";
import { usePathname } from "next/navigation";
import { Rajdhani } from "next/font/google";
import { StarfieldProvider, useStarfield } from "./starfield-context";

const rajdhani = Rajdhani({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return s / 2147483647;
  };
}

function Starfield() {
  const pathname = usePathname();
  const { showStreaks } = useStarfield();
  const isDetailPage = pathname !== "/new-design";
  const hideStreaks = isDetailPage || !showStreaks;

  const stars = useMemo(() => {
    const rng = seededRandom(42);
    return Array.from({ length: 120 }, (_, i) => {
      const x = rng() * 100;
      const y = rng() * 100;
      const size = rng() * 2 + 0.5;
      const opacity = rng() * 0.5 + 0.1;
      const delay = rng() * 8;
      const duration = rng() * 8 + 12;
      const driftAngle = rng() * Math.PI * 2;
      const driftDist = rng() * 6 + 2;
      const dx = Math.cos(driftAngle) * driftDist;
      const dy = Math.sin(driftAngle) * driftDist;
      return { id: i, x, y, size, opacity, delay, duration, dx, dy };
    });
  }, []);

  const streaks = useMemo(() => {
    const rng = seededRandom(99);
    return Array.from({ length: 50 }, (_, i) => {
      let x: number, y: number;
      do {
        x = rng() * 100;
        y = rng() * 100;
      } while ((x > 20 && x < 80 && y > 20 && y < 80) || y < 25);
      const dx = x - 50;
      const dy = y - 50;
      const angle = Math.atan2(dy, dx) * (180 / Math.PI);
      const length = rng() * 80 + 40;
      const width = rng() * 1.5 + 0.5;
      const opacity = rng() * 0.2 + 0.08;
      const delay = rng() * 10;
      const duration = rng() * 8 + 10;
      return { id: i, x, y, angle, length, width, opacity, delay, duration };
    });
  }, []);

  return (
    <>
      <style>{`
        @keyframes twinkle {
          0%, 100% { opacity: var(--star-opacity); transform: translate(0, 0); }
          25% { transform: translate(var(--star-dx), var(--star-dy)); }
          50% { opacity: 0.02; transform: translate(calc(var(--star-dx) * 2), calc(var(--star-dy) * 2)); }
          75% { transform: translate(var(--star-dx), var(--star-dy)); }
        }
        @keyframes streak-pulse {
          0%, 100% { opacity: var(--streak-opacity); }
          50% { opacity: calc(var(--streak-opacity) * 1.5); }
        }
      `}</style>
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        {/* Nebula glows */}
        <div
          className="absolute -right-32 -top-48 h-[900px] w-[450px] rotate-[-25deg] opacity-[0.10] blur-[80px]"
          style={{ background: "linear-gradient(180deg, #60a5fa 0%, transparent 75%)" }}
        />
        <div
          className="absolute -bottom-60 -left-40 h-[600px] w-[500px] rotate-[15deg] opacity-[0.06] blur-[100px]"
          style={{ background: "linear-gradient(0deg, #f472b6 0%, transparent 70%)" }}
        />
        <div
          className="absolute left-1/2 top-1/3 h-[500px] w-[700px] -translate-x-1/2 opacity-[0.04] blur-[130px]"
          style={{ background: "radial-gradient(ellipse, #a78bfa, transparent 65%)" }}
        />
        <div
          className="absolute -right-20 -top-32 h-[600px] w-[700px] opacity-[0.05] blur-[140px]"
          style={{ background: "radial-gradient(ellipse at 70% 20%, #7db4f5, transparent 70%)" }}
        />
        {/* Central warp glow */}
        <div
          className="absolute left-1/2 top-1/2 h-[400px] w-[400px] -translate-x-1/2 -translate-y-1/2 opacity-[0.04] blur-[100px]"
          style={{ background: "radial-gradient(circle, #e2e8f0, transparent 60%)" }}
        />

        {/* Stars */}
        {stars.map((s) => {
          const starOpacity = hideStreaks ? s.opacity * 0.5 : s.opacity;
          return (
            <div
              key={s.id}
              className="absolute rounded-full bg-white transition-opacity duration-700"
              style={{
                left: `${s.x}%`,
                top: `${s.y}%`,
                width: `${s.size}px`,
                height: `${s.size}px`,
                "--star-opacity": starOpacity,
                "--star-dx": `${s.dx}px`,
                "--star-dy": `${s.dy}px`,
                animation: `twinkle ${s.duration}s ${s.delay}s ease-in-out infinite`,
                opacity: starOpacity,
              } as React.CSSProperties}
            />
          );
        })}

        {/* Warp speed streaks — hidden on detail pages */}
        {!hideStreaks && streaks.map((s) => (
          <div
            key={s.id}
            className="absolute"
            style={{
              left: `${s.x}%`,
              top: `${s.y}%`,
              "--streak-opacity": s.opacity,
              "--streak-angle": `${s.angle}deg`,
              width: `${s.length}px`,
              height: `${s.width}px`,
              background: `linear-gradient(90deg, transparent, rgba(210, 220, 240, ${Math.min(s.opacity * 4, 1)}), transparent)`,
              animation: `streak-pulse ${s.duration}s ${s.delay}s ease-in-out infinite`,
              transform: `translate(-50%, -50%) rotate(${s.angle}deg)`,
              borderRadius: "999px",
            } as React.CSSProperties}
          />
        ))}
      </div>
    </>
  );
}

export default function NewDesignLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <StarfieldProvider>
      <div className={`${rajdhani.variable} relative min-h-screen overflow-hidden`}>
        <Starfield />
        <div className="relative z-10">{children}</div>
      </div>
    </StarfieldProvider>
  );
}
