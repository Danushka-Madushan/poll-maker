import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  RotateCcw,
  RotateCw,
  ZoomIn,
  ZoomOut,
  RotateCcw as ResetIcon,
  Check,
  X,
  Move,
  Crop,
} from 'lucide-react';
import { cropWithTransform } from '../../utils/image';

interface ImageCropModalProps {
  isOpen: boolean;
  imageSrc: string;
  onApply: (croppedDataUrl: string) => void;
  onCancel: () => void;
}

const CROP_VIEW_SIZE = 320; // 320x320px viewfinder on screen

const ImageCropModal: React.FC<ImageCropModalProps> = ({
  isOpen,
  imageSrc,
  onApply,
  onCancel,
}) => {
  const [zoom, setZoom] = useState(1.0);
  const [rotation, setRotation] = useState(0);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [posStart, setPosStart] = useState({ x: 0, y: 0 });
  const [imageMeta, setImageMeta] = useState<{ width: number; height: number } | null>(null);
  const [applying, setApplying] = useState(false);
  const [viewSize, setViewSize] = useState(CROP_VIEW_SIZE);

  const containerRef = useRef<HTMLDivElement>(null);

  // Measure rendered viewfinder size for responsive mobile scaling
  useEffect(() => {
    if (!isOpen) return;
    const updateSize = () => {
      if (containerRef.current) {
        setViewSize(containerRef.current.clientWidth || CROP_VIEW_SIZE);
      }
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, [isOpen]);

  // Load natural dimensions whenever imageSrc changes
  useEffect(() => {
    if (!imageSrc) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      setImageMeta({ width: img.naturalWidth, height: img.naturalHeight });
      // Reset position, zoom, rotation on new image
      setPosition({ x: 0, y: 0 });
      setZoom(1.0);
      setRotation(0);
    };
    img.src = imageSrc;
  }, [imageSrc]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel]);

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
    setPosStart({ ...position });
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStart.x;
    const dy = e.clientY - dragStart.y;
    setPosition({
      x: posStart.x + dx,
      y: posStart.y + dy,
    });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (isDragging) {
      setIsDragging(false);
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setZoom((prev) => {
      const delta = e.deltaY * -0.0015;
      const next = Math.min(3.0, Math.max(0.5, prev + delta));
      return Number(next.toFixed(2));
    });
  };

  const rotate = (deltaDeg: number) => {
    setRotation((prev) => (prev + deltaDeg + 360) % 360);
  };

  const resetAll = () => {
    setPosition({ x: 0, y: 0 });
    setZoom(1.0);
    setRotation(0);
  };

  const handleApply = useCallback(async () => {
    if (!imageSrc || applying) return;
    setApplying(true);
    try {
      const cropped = await cropWithTransform(
        imageSrc,
        {
          x: position.x,
          y: position.y,
          zoom,
          rotation,
          cropDisplaySize: viewSize,
        },
        600,
        0.82
      );
      onApply(cropped);
    } catch (err) {
      console.error('Cropping error:', err);
    } finally {
      setApplying(false);
    }
  }, [imageSrc, position, zoom, rotation, viewSize, applying, onApply]);

  if (!isOpen || !imageSrc) return null;

  // Compute CSS base scale for image to cover the viewfinder box initially
  let baseScale = 1;
  if (imageMeta) {
    const isRotated = rotation % 180 !== 0;
    const effW = isRotated ? imageMeta.height : imageMeta.width;
    const effH = isRotated ? imageMeta.width : imageMeta.height;
    baseScale = Math.max(viewSize / effW, viewSize / effH);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="crop-modal-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        background: 'rgba(13, 11, 16, 0.92)',
        backdropFilter: 'blur(3px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        style={{
          background: 'var(--ink)',
          border: '4px solid var(--pumpkin)',
          boxShadow: '8px 8px 0 var(--pumpkin)',
          width: '100%',
          maxWidth: 560,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {/* Top hazard stripes */}
        <div className="hazard-stripes" style={{ height: 6, width: '100%' }} />

        {/* Modal Header */}
        <div
          style={{
            padding: '12px 18px',
            borderBottom: '3px solid var(--bone)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--ink)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Crop size={20} color="var(--pumpkin)" />
            <h2
              id="crop-modal-title"
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 16,
                color: 'var(--bone)',
                margin: 0,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              CROP & ROTATE CONTESTANT PHOTO
            </h2>
          </div>
          <button
            className="btn-ghost"
            onClick={onCancel}
            aria-label="Close"
            style={{ padding: '4px 8px', border: 'none', color: 'var(--ash)' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          {/* Viewfinder Instructions Banner */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--pumpkin)', fontFamily: 'var(--font-mono)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            <Move size={14} />
            <span>DRAG IMAGE TO POSITION · SCROLL TO ZOOM</span>
          </div>

          {/* 1:1 Viewfinder Square */}
          <div
            ref={containerRef}
            className="crop-modal-viewfinder"
            style={{
              width: CROP_VIEW_SIZE,
              height: CROP_VIEW_SIZE,
              background: 'var(--void)',
              border: '3px solid var(--pumpkin)',
              boxShadow: '4px 4px 0 var(--bone)',
              position: 'relative',
              overflow: 'hidden',
              cursor: isDragging ? 'grabbing' : 'grab',
              touchAction: 'none',
              userSelect: 'none',
            }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onWheel={handleWheel}
          >
            {/* The Image being transformed */}
            {imageSrc && (
              <img
                src={imageSrc}
                alt="Source preview"
                draggable={false}
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: `translate(calc(-50% + ${position.x}px), calc(-50% + ${position.y}px)) rotate(${rotation}deg) scale(${zoom * baseScale})`,
                  transformOrigin: 'center center',
                  pointerEvents: 'none',
                  userSelect: 'none',
                  maxWidth: 'none',
                  maxHeight: 'none',
                }}
              />
            )}

            {/* Rule-of-Thirds Grid Overlay */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                pointerEvents: 'none',
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1fr',
                gridTemplateRows: '1fr 1fr 1fr',
                border: '1px solid rgba(244, 238, 223, 0.1)',
              }}
            >
              {[...Array(9)].map((_, i) => (
                <div key={i} style={{ border: '1px dashed rgba(244, 238, 223, 0.2)' }} />
              ))}
            </div>

            {/* Corner Reticles (Brutalist Viewfinder Accents) */}
            <div style={{ position: 'absolute', top: 6, left: 6, width: 14, height: 14, borderTop: '3px solid var(--pumpkin)', borderLeft: '3px solid var(--pumpkin)', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', top: 6, right: 6, width: 14, height: 14, borderTop: '3px solid var(--pumpkin)', borderRight: '3px solid var(--pumpkin)', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', bottom: 6, left: 6, width: 14, height: 14, borderBottom: '3px solid var(--pumpkin)', borderLeft: '3px solid var(--pumpkin)', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', bottom: 6, right: 6, width: 14, height: 14, borderBottom: '3px solid var(--pumpkin)', borderRight: '3px solid var(--pumpkin)', pointerEvents: 'none' }} />
          </div>

          {/* Controls Cluster */}
          <div className="crop-modal-controls" style={{ width: '100%', maxWidth: CROP_VIEW_SIZE, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Zoom Slider Row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button
                className="btn-ghost"
                onClick={() => setZoom((z) => Math.max(0.5, Number((z - 0.1).toFixed(2))))}
                title="Zoom Out"
                style={{ width: 34, height: 34, padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <ZoomOut size={16} />
              </button>
              <input
                type="range"
                className="brutalist-slider"
                min="0.5"
                max="3.0"
                step="0.05"
                value={zoom}
                onChange={(e) => setZoom(parseFloat(e.target.value))}
                aria-label="Zoom scale"
              />
              <button
                className="btn-ghost"
                onClick={() => setZoom((z) => Math.min(3.0, Number((z + 0.1).toFixed(2))))}
                title="Zoom In"
                style={{ width: 34, height: 34, padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <ZoomIn size={16} />
              </button>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--pumpkin)', minWidth: 44, textAlign: 'right', fontWeight: 700 }}>
                {Math.round(zoom * 100)}%
              </span>
            </div>

            {/* Rotation & Reset Buttons Row */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  className="btn-secondary"
                  onClick={() => rotate(-90)}
                  style={{ fontSize: 12, height: 36, padding: '0 12px', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                  title="Rotate 90 degrees counter-clockwise"
                >
                  <RotateCcw size={14} /> -90°
                </button>
                <button
                  className="btn-secondary"
                  onClick={() => rotate(90)}
                  style={{ fontSize: 12, height: 36, padding: '0 12px', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                  title="Rotate 90 degrees clockwise"
                >
                  <RotateCw size={14} /> +90°
                </button>
              </div>

              <button
                className="btn-ghost"
                onClick={resetAll}
                style={{ fontSize: 12, height: 36, padding: '0 14px', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                title="Reset zoom, rotation, and position"
              >
                <ResetIcon size={14} /> RESET
              </button>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div
          style={{
            borderTop: '3px solid var(--bone)',
            padding: '14px 20px',
            background: 'var(--ink)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: 12,
          }}
        >
          <button
            className="btn-secondary"
            onClick={onCancel}
            disabled={applying}
            style={{ fontSize: 13, height: 44, padding: '0 20px' }}
          >
            CANCEL
          </button>
          <button
            className="btn-primary"
            onClick={handleApply}
            disabled={applying}
            style={{
              fontSize: 13,
              height: 44,
              padding: '0 22px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              boxShadow: '4px 4px 0 var(--bone)',
            }}
          >
            <Check size={16} strokeWidth={2.5} />
            {applying ? 'CROPPING…' : 'APPLY CROP'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImageCropModal;
