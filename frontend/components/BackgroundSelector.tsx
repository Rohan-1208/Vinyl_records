import React from 'react';
import { BackgroundMode } from '../types';

interface BackgroundSelectorProps {
  mode: BackgroundMode;
  onChange: (mode: BackgroundMode) => void;
}

const BackgroundSelector: React.FC<BackgroundSelectorProps> = ({ mode, onChange }) => {
  return (
    <div className="flex items-center space-x-2">
      <span className="text-white/70 text-sm hidden sm:block">Background</span>
      <select
        value={mode}
        onChange={(e) => onChange(e.target.value as BackgroundMode)}
        className="bg-neutral-800/70 text-white text-sm px-2 py-1 rounded-md border border-white/10 focus:outline-none focus:ring-1 focus:ring-white/20"
        title="Choose background style"
      >
        <option value="album">Song Art</option>
        <option value="blur">Blurred Art</option>
        <option value="starry">Starry Night</option>
        <option value="gradient">Deep Gradient</option>
        <option value="minimal">Minimal Theme</option>
        <option value="dynamic">Live Theme</option>
      </select>
    </div>
  );
};

export default BackgroundSelector;