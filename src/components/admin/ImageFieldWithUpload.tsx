import React, { useRef, useState, useEffect } from 'react';
import { Plus, X, Image as ImageIcon, AlertCircle } from 'lucide-react';
import { api, isValidImageUrl } from '@/lib/api';

interface ImageFieldWithUploadProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  helper?: string;
  /** Custom class for the preview image element (e.g. aspect ratio). */
  previewClassName?: string;
  hint?: string;
}

/**
 * Shared admin image input. Uploads use the configured MUIRO API backend;
 * production uploads are stored in Supabase Storage and return a public URL.
 * The parent form saves that URL alongside the associated CMS record.
 */
export const ImageFieldWithUpload: React.FC<ImageFieldWithUploadProps> = ({
  label,
  value,
  onChange,
  placeholder,
  required,
  helper,
  previewClassName = 'h-20 w-16 rounded-lg border border-[#e8e2dc] object-cover bg-[#f4efe9]',
  hint
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [urlTouched, setUrlTouched] = useState(false);
  const [previewFailed, setPreviewFailed] = useState(false);

  // Reset the preview error whenever the value changes (new URL / upload).
  useEffect(() => {
    setPreviewFailed(false);
  }, [value]);

  const isUrlInvalid = urlTouched && Boolean(value.trim()) && !isValidImageUrl(value.trim());

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploadError(null);
    if (!file.type.startsWith('image/')) {
      setUploadError('Please choose an image file (JPEG, PNG, WebP, GIF, or AVIF).');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setUploadError('Image is larger than 8 MB. Please choose a smaller file.');
      return;
    }
    setIsUploading(true);
    try {
      const result = await api.uploadImage(file);
      onChange(result.url);
      setUrlTouched(false);
    } catch (err: any) {
      setUploadError(err.message || 'Upload failed. Check the server connection.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div>
      <label className="block text-xs font-semibold uppercase text-[#6e6761] mb-1">
        {label}
      </label>

      <div className="flex items-center gap-3">
        <div className="relative w-16 h-20 shrink-0 rounded-lg border border-[#e8e2dc] overflow-hidden bg-[#f4f4f2]">
          {value ? (
            <img
              src={value}
              alt="Preview"
              className={`w-16 h-20 object-cover ${previewClassName || ''} ${
                previewFailed ? 'hidden' : ''
              }`}
              onError={() => setPreviewFailed(true)}
              onLoad={() => setPreviewFailed(false)}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <ImageIcon className="w-5 h-5 text-[#bdb4ab]" />
            </div>
          )}

          {previewFailed && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-[#f4efe9] border-rose-200">
              <AlertCircle className="w-4 h-4 text-rose-500" />
              <span className="text-[9px] leading-tight text-rose-600 font-semibold text-center px-1">
                Preview failed
              </span>
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex gap-2">
            <input
              type="text"
              value={value}
              required={required}
              onChange={(e) => {
                onChange(e.target.value);
                setUrlTouched(true);
              }}
              onBlur={() => setUrlTouched(true)}
              placeholder={placeholder || 'Paste a public image URL or upload from your device'}
              className={`w-full p-2.5 border rounded-lg text-sm bg-[#fcfbf9] text-[#181512] outline-none ${
                isUrlInvalid
                  ? 'border-rose-400 focus:border-rose-400 bg-rose-50/30'
                  : 'border-[#e8e2dc] focus:border-[#181512]'
              }`}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2.5 rounded-lg border border-[#181512] text-[#181512] text-xs font-bold uppercase tracking-wider hover:bg-[#181512] hover:text-white disabled:opacity-50 transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isUploading ? 'Uploading…' : 'Upload'}</span>
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
            className="hidden"
            onChange={handleFile}
          />
          {isUrlInvalid && (
            <p className="text-[11px] text-rose-600 mt-1">
              Enter a site-relative asset path or a valid public http(s) image URL —
              local filesystem paths are not valid here.
            </p>
          )}
          {uploadError && (
            <p className="text-[11px] text-rose-600 mt-1">{uploadError}</p>
          )}
          {previewFailed && (
            <p className="text-[11px] text-rose-600 mt-1">
              This image could not be loaded — check the URL or upload a new file.
            </p>
          )}
          {hint && !uploadError && !isUrlInvalid && !previewFailed && (
            <p className="text-[11px] text-[#8c827a] mt-1">{hint}</p>
          )}
        </div>

        {value && (
          <button
            type="button"
            onClick={() => {
              onChange('');
              setUrlTouched(true);
            }}
            title="Clear image"
            aria-label={`Clear ${label}`}
            className="shrink-0 p-1.5 text-[#6e6761] hover:text-rose-600 rounded hover:bg-rose-50 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {helper && <p className="text-[11px] text-[#8c827a] mt-1">{helper}</p>}
    </div>
  );
};
