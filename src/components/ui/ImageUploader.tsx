import React, { useCallback, useRef, useState } from 'react';
import { Upload, RefreshCw, AlertCircle } from 'lucide-react';
import { cropToSquare, fileToDataUrl, validateImageFile } from '../../utils/image';

interface ImageUploaderProps {
  value?: string;        // current data URL
  onChange: (dataUrl: string) => void;
  onError?: (msg: string) => void;
  errorMessage?: string;
  disabled?: boolean;
}

/**
 * Click / drag-and-drop image uploader with automatic 1:1 square crop.
 * Shows existing image or an empty dashed placeholder.
 */
const ImageUploader: React.FC<ImageUploaderProps> = ({ value, onChange, onError, errorMessage, disabled }) => {
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
        border: errorMessage ? '3px solid var(--blood)' : dragOver ? '3px solid var(--pumpkin)' : undefined,
        position: 'relative',
        overflow: 'hidden',
        background: errorMessage ? 'rgba(224, 40, 60, 0.08)' : undefined,
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
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
          <RefreshCw size={24} className="animate-spin text-[var(--pumpkin)]" />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ash)' }}>
            CROPPING…
          </span>
        </div>
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
              background: 'rgba(13,11,16,0.65)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              opacity: 0, transition: 'opacity 120ms',
            }}
              className="img-hover-overlay"
            >
              <Upload size={16} color="var(--bone)" />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--bone)', fontWeight: 700 }}>
                CHANGE
              </span>
            </div>
          )}
        </>
      ) : (
        <>
          {errorMessage ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '0 8px', textAlign: 'center' }}>
              <AlertCircle size={28} color="var(--blood)" />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--blood)', lineHeight: 1.3, fontWeight: 700, textTransform: 'uppercase' }}>
                {errorMessage}
              </span>
            </div>
          ) : (
            <>
              <Upload size={28} strokeWidth={2.5} color="var(--ash)" />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, textAlign: 'center', lineHeight: 1.4, color: 'var(--bone)' }}>
                DROP IMAGE<br />OR CLICK
              </span>
            </>
          )}
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
