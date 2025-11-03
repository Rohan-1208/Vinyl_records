import React from 'react';

// Subtle film-grain/texture overlay to add warmth and cohesion across backgrounds
const GrainOverlay: React.FC = () => {
  return (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{
        // Layered micro-patterns for gentle texture
        backgroundImage:
          `radial-gradient(circle at 30% 20%, rgba(255,255,255,0.025) 0 1px, transparent 2px),
           radial-gradient(circle at 70% 80%, rgba(255,255,255,0.02) 0 1px, transparent 2px),
           radial-gradient(circle at 10% 60%, rgba(255,255,255,0.02) 0 1px, transparent 2px),
           radial-gradient(circle at 90% 30%, rgba(255,255,255,0.02) 0 1px, transparent 2px)`,
        backgroundSize: '3px 3px, 4px 4px, 5px 5px, 6px 6px',
        backgroundBlendMode: 'overlay',
        opacity: 0.15,
        mixBlendMode: 'soft-light',
      }}
    />
  );
};

export default GrainOverlay;