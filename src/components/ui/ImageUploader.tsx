import React, { useCallback, useRef, useState } from 'react';
import { cropToSquare, fileToDataUrl, validateImageFile } from '../../utils/image';

interface ImageUploaderProps {
  value?: string;        // current data URL
  onChange: (dataUrl: string) => void;
  onError?: (msg: string) => void;
  disabled?: boolean;
}

/**
 * Click / drag-and-drop image uploader with automatic 1:1 square crop.
 * Shows existing image or an empty dashed placeholder.
 */
const ImageUploader: React.FC<ImageUploaderProps> = ({ value, onChange, onError, disabled }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const processFile = useCallback(async (file: File) => {
    const err = validateImageFile(file);
    if (err) { onError?.(err); return; }

    setLoading(true);
    try {
      const dataUrl = await fileToDataUrl(file);
      const cropped = await cropToSquare(dataUrl);
      onChange(cropped);
    } catch {
      onError?.('Failed to process image. Please try another file.');
    } finally {
      setLoading(false);
    }
  }, [onChange, onError]);

  const handleFiles = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return;
    processFile(files[0]);
  }, [processFile]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (!disabled) handleFiles(e.dataTransfer.files);
  }, [disabled, handleFiles]);

  return (
    <div
      className={`option-card-empty ${dragOver ? 'border-pumpkin' : ''}`}
      style={{
        border: dragOver ? '3px solid var(--pumpkin)' : undefined,
        position: 'relative',
        overflow: 'hidden',
      }}
      onClick={() => !disabled && inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-label="Upload image"
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); inputRef.current?.click(); } }}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        style={{ display: 'none' }}
        onChange={(e) => handleFiles(e.target.files)}
      />

      {loading ? (
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ash)' }}>
          PROCESSING…
        </span>
      ) : value ? (
        <>
          <img
            src={value}
            alt="Option"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
          />
          {!disabled && (
            <div style={{
              position: 'absolute', inset: 0,
              background: 'rgba(13,11,16,0.6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              opacity: 0, transition: 'opacity 120ms',
            }}
              className="img-hover-overlay"
            >
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--bone)' }}>
                CHANGE
              </span>
            </div>
          )}
        </>
      ) : (
        <>
          <svg width="32" height="32" viewBox="0 0 32 32" fill="currentColor" aria-hidden="true">
            <rect x="14" y="4" width="4" height="16" />
            <rect x="6" y="12" width="20" height="4" />
            <rect x="4" y="24" width="24" height="4" />
          </svg>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, textAlign: 'center', lineHeight: 1.4 }}>
            DROP IMAGE<br />OR CLICK
          </span>
        </>
      )}

      <style>{`
        .img-hover-overlay { opacity: 0 !important; }
        [role="button"]:hover .img-hover-overlay { opacity: 1 !important; }
      `}</style>
    </div>
  );
};

export default ImageUploader;
