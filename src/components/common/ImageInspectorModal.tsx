import React, { useState, useRef, useEffect } from 'react';
import { X, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

interface ImageInspectorModalProps {
  isOpen: boolean;
  imageSrc: string | null;
  imageAlt: string;
  onClose: () => void;
}

export const ImageInspectorModal: React.FC<ImageInspectorModalProps> = ({
  isOpen,
  imageSrc,
  imageAlt,
  onClose
}) => {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (isOpen) {
      setScale(1);
      setPosition({ x: 0, y: 0 });
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen, imageSrc]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !imageSrc) return null;

  const handleZoomIn = () => setScale(prev => Math.min(prev + 0.3, 4));
  const handleZoomOut = () => setScale(prev => Math.max(prev - 0.3, 1));
  const handleReset = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (scale <= 1) return;
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y
    };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging || scale <= 1) return;
    setPosition({
      x: e.clientX - dragStartRef.current.x,
      y: e.clientY - dragStartRef.current.y
    });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsDragging(false);
    try {
      (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
    } catch {
      // Ignored
    }
  };

  const handleDoubleClick = () => {
    if (scale > 1) {
      handleReset();
    } else {
      setScale(2.2);
    }
  };

  return (
    <div
      id="image-inspector-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#0d0b09]/95 backdrop-blur-md p-4 animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Controls Header */}
      <div className="absolute top-4 right-4 z-50 flex items-center gap-2">
        <div className="flex items-center bg-white/10 backdrop-blur-md rounded-full px-3 py-1.5 text-white text-xs border border-white/15 mr-2">
          <span>{Math.round(scale * 100)}%</span>
        </div>
        <button
          onClick={handleZoomIn}
          className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition"
          title="Zoom in"
          aria-label="Zoom in"
        >
          <ZoomIn className="w-5 h-5" />
        </button>
        <button
          onClick={handleZoomOut}
          className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition"
          title="Zoom out"
          aria-label="Zoom out"
        >
          <ZoomOut className="w-5 h-5" />
        </button>
        <button
          onClick={handleReset}
          className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition"
          title="Reset zoom"
          aria-label="Reset zoom"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
        <button
          id="close-inspector-btn"
          onClick={onClose}
          className="w-10 h-10 rounded-full bg-white text-[#181512] hover:bg-gray-100 flex items-center justify-center transition ml-2 shadow-lg"
          title="Close Inspector (Esc)"
          aria-label="Close Inspector"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Stage */}
      <div
        className={`w-full h-full flex items-center justify-center select-none overflow-hidden ${
          scale > 1 ? (isDragging ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-zoom-in'
        }`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onDoubleClick={handleDoubleClick}
      >
        <img
          src={imageSrc}
          alt={imageAlt}
          className="max-h-[88vh] max-w-[92vw] object-contain rounded-sm transition-transform duration-150 ease-out will-change-transform shadow-2xl"
          style={{
            transform: `translate3d(${position.x}px, ${position.y}px, 0) scale(${scale})`
          }}
          draggable={false}
        />
      </div>

      {/* Help hint */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/60 text-xs px-3 py-1.5 rounded-full bg-black/40 backdrop-blur-sm pointer-events-none">
        Double-click or pinch to zoom • Drag to pan fabric details
      </div>
    </div>
  );
};
