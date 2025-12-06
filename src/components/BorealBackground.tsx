import { useState, useEffect } from 'react';

interface Star {
  id: number;
  x: number;
  y: number;
  size: number;
  delay: number;
  duration: number;
  opacity: number;
}

export function BorealBackground({ children }: { children: React.ReactNode }) {
  const generateStars = (): Star[] => {
    const stars: Star[] = [];
    // Nombre optimal d'étoiles pour performance et visibilité
    for (let i = 0; i < 150; i++) {
      stars.push({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: Math.random() * 8 + 5, // Étoiles grandes et visibles (5-13px)
        delay: Math.random() * 4,
        duration: Math.random() * 2 + 1.5,
        opacity: Math.random() * 0.2 + 0.9,
      });
    }
    return stars;
  };

  const [stars] = useState<Star[]>(() => generateStars());

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0a0e27]">
      {/* Arrière-plan avec gradient boréal */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-[#0a0e27] via-[#1a1f3a] to-[#0f1629]"></div>
        
        {/* Étoiles qui scintillent - TRÈS VISIBLES */}
        <div className="absolute inset-0" style={{ zIndex: 1, pointerEvents: 'none' }}>
          {stars.map((star) => {
            const glowSize1 = star.size * 10;
            const glowSize2 = star.size * 20;
            const glowSize3 = star.size * 30;
            return (
              <div
                key={star.id}
                className="absolute rounded-full"
                style={{
                  left: `${star.x}%`,
                  top: `${star.y}%`,
                  width: `${star.size}px`,
                  height: `${star.size}px`,
                  backgroundColor: '#ffffff',
                  boxShadow: `0 0 ${glowSize1}px rgba(255, 255, 255, 1), 0 0 ${glowSize2}px rgba(103, 232, 249, 1), 0 0 ${glowSize3}px rgba(103, 232, 249, 0.7)`,
                  animation: `twinkle ${star.duration}s ease-in-out infinite`,
                  animationDelay: `${star.delay}s`,
                  opacity: star.opacity,
                  filter: 'brightness(1.8)',
                  transform: 'translate(-50%, -50%)',
                  willChange: 'transform, opacity, filter',
                }}
              />
            );
          })}
        </div>

        {/* Effet de lumière boréale subtile */}
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }}></div>
        <div className="absolute top-1/2 left-1/2 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '4s' }}></div>
      </div>

      {/* Contenu */}
      <div className="relative" style={{ zIndex: 10 }}>
        {children}
      </div>

      {/* Styles CSS pour les animations */}
      <style>{`
        @keyframes twinkle {
          0%, 100% {
            opacity: 0.9;
            transform: translate(-50%, -50%) scale(1);
            filter: brightness(1.8);
          }
          25% {
            opacity: 1;
            transform: translate(-50%, -50%) scale(2);
            filter: brightness(2.5);
          }
          50% {
            opacity: 0.95;
            transform: translate(-50%, -50%) scale(1.5);
            filter: brightness(2);
          }
          75% {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1.8);
            filter: brightness(2.3);
          }
        }
      `}</style>
    </div>
  );
}

