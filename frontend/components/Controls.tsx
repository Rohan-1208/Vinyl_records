import React from 'react';
import {
  PlayIcon, PauseIcon, NextIcon, PrevIcon,
  QueueIcon, CloseIcon, ColorPaletteIcon, LayoutIcon
} from './Icons';

interface ControlHubProps {
  isPlaying: boolean;
  onPlayPause: () => void;
  onNext: () => void;
  onPrev: () => void;
  onToggleLibrary: () => void;
  isPlayerActive: boolean;
  onOpenAppearance?: () => void;
  appearanceAnchorRef?: React.Ref<HTMLButtonElement>;
  onToggleShelf?: () => void;
}

const ControlButton: React.FC<{ onClick: () => void; disabled?: boolean; children: React.ReactNode; title: string; buttonRef?: React.Ref<HTMLButtonElement> }> = ({ onClick, disabled, children, title, buttonRef }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    title={title}
    ref={buttonRef}
    className="w-10 h-10 flex items-center justify-center text-neutral-300 hover:text-white hover:bg-white/20 rounded-full transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed"
  >
    {children}
  </button>
);


const ControlHub: React.FC<ControlHubProps> = ({ isPlaying, onPlayPause, onNext, onPrev, onToggleLibrary, isPlayerActive, onOpenAppearance, appearanceAnchorRef, onToggleShelf }) => {
  return (
    <div className="fixed bottom-6 left-6 z-30">
      <div className="flex flex-col items-start space-y-2">
        {/* Main Control Cluster */}
        <div className="bg-black/40 backdrop-blur-md p-2 rounded-full shadow-lg border border-white/10 flex items-center space-x-1">
          <ControlButton onClick={() => {}} title="Options (Placeholder)">
            <CloseIcon className="w-5 h-5 rotate-45" />
          </ControlButton>
          <ControlButton onClick={onOpenAppearance || (() => {})} title="Appearance" buttonRef={appearanceAnchorRef}>
            <ColorPaletteIcon className="w-6 h-6" />
          </ControlButton>
          <ControlButton onClick={onToggleShelf || (() => {})} title="Toggle Shelf">
            <LayoutIcon className="w-6 h-6" />
          </ControlButton>
           <ControlButton onClick={onToggleLibrary} title="Open Library">
            <QueueIcon className="w-6 h-6" />
          </ControlButton>
        </div>

        {/* Playback Controls - only appear when a song is loaded */}
        {isPlayerActive && (
             <div className="bg-black/40 backdrop-blur-md p-2 rounded-full shadow-lg border border-white/10 flex items-center space-x-1">
                <ControlButton onClick={onPrev} disabled={!isPlayerActive} title="Previous Track">
                    <PrevIcon className="w-6 h-6" />
                </ControlButton>
                <button
                    onClick={onPlayPause}
                    disabled={!isPlayerActive}
                    title={isPlaying ? "Pause" : "Play"}
                    className="w-12 h-12 flex items-center justify-center text-white bg-white/20 hover:bg-white/30 rounded-full transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                    {isPlaying ? <PauseIcon className="w-7 h-7" /> : <PlayIcon className="w-7 h-7 pl-1" />}
                </button>
                <ControlButton onClick={onNext} disabled={!isPlayerActive} title="Next Track">
                    <NextIcon className="w-6 h-6" />
                </ControlButton>
            </div>
        )}
      </div>
    </div>
  );
};

export default ControlHub;