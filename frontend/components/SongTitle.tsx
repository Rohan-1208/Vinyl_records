import React from 'react';

interface SongTitleProps {
  title: string | undefined;
}

const SongTitle: React.FC<SongTitleProps> = ({ title }) => {
  if (!title) return null;

  return (
    <div className="fixed top-24 left-6 z-20 pointer-events-none">
      <h1 
        className="font-display text-8xl text-white uppercase"
        style={{ textShadow: '2px 2px 10px rgba(0,0,0,0.5)' }}
      >
        {title.split(' ').map((word, index) => (
          <span key={index} className="block">{word}</span>
        ))}
      </h1>
    </div>
  );
};

export default SongTitle;