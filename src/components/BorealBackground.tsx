import { useEffect, useRef } from 'react';

export function BorealBackground({ children }: { children: React.ReactNode }) {
  const starsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Créer les étoiles avec CSS pur pour meilleures performances
    if (starsRef.current) {
      const starsContainer = starsRef.current;
      starsContainer.innerHTML = '';
      
      // Créer 80 étoiles visibles avec CSS
      for (let i = 0; i < 80; i++) {
        const star = document.createElement('div');
        star.className = 'star';
        star.style.left = `${Math.random() * 100}%`;
        star.style.top = `${Math.random() * 100}%`;
        star.style.width = `${Math.random() * 4 + 3}px`;
        star.style.height = star.style.width;
        star.style.animationDelay = `${Math.random() * 4}s`;
        star.style.animationDuration = `${Math.random() * 2 + 2}s`;
        starsContainer.appendChild(star);
      }
    }
  }, []);

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0a0e27]">
      {/* Arrière-plan avec gradient boréal */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-[#0a0e27] via-[#1a1f3a] to-[#0f1629]"></div>
        
        {/* Étoiles qui scintillent - CSS pur pour performance */}
        <div 
          ref={starsRef}
          className="absolute inset-0"
          style={{ zIndex: 1, pointerEvents: 'none' }}
        />

        {/* Effet de lumière boréale subtile */}
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }}></div>
      </div>

      {/* Contenu */}
      <div className="relative" style={{ zIndex: 10 }}>
        {children}
      </div>

      {/* Styles CSS pour les animations - optimisés */}
      <style>{`
        .star {
          position: absolute;
          border-radius: 50%;
          background: #ffffff;
          box-shadow: 
            0 0 10px rgba(255, 255, 255, 1),
            0 0 20px rgba(103, 232, 249, 1),
            0 0 30px rgba(103, 232, 249, 0.8);
          animation: twinkle 3s ease-in-out infinite;
          will-change: transform, opacity;
          transform: translate(-50%, -50%);
        }

        @keyframes twinkle {
          0%, 100% {
            opacity: 0.8;
            transform: translate(-50%, -50%) scale(1);
          }
          50% {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1.8);
          }
        }
      `}</style>
    </div>
  );
}
