import React, { useEffect, useState } from 'react';
import { ArrowUpRight, Check, X } from 'lucide-react';
import { createLookbookShareUrl, createProductShareUrl } from '@/lib/shareLinks';

type ShareResource = 'lookbook' | 'product';

interface ShareButtonProps {
  resource: ShareResource;
  resourceId: string;
  title: string;
  description?: string;
  iconOnly?: boolean;
  label?: string;
  className?: string;
}

async function copyText(value: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const field = document.createElement('textarea');
  field.value = value;
  field.setAttribute('readonly', '');
  field.style.position = 'fixed';
  field.style.opacity = '0';
  field.style.pointerEvents = 'none';
  document.body.appendChild(field);
  field.select();
  const copied = document.execCommand('copy');
  field.remove();
  if (!copied) throw new Error('Clipboard copy is not available');
}

export const ShareButton: React.FC<ShareButtonProps> = ({
  resource,
  resourceId,
  title,
  description,
  iconOnly = false,
  label = 'Share',
  className = '',
}) => {
  const [notice, setNotice] = useState<{ text: string; failed: boolean; shareUrl?: string } | null>(null);
  const [isSharing, setIsSharing] = useState(false);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), notice.failed ? 12000 : 2800);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const getUrl = () => resource === 'lookbook'
    ? createLookbookShareUrl(resourceId, window.location.origin)
    : createProductShareUrl(resourceId, window.location.origin);

  const handleShare = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (isSharing) return;
    setIsSharing(true);
    const url = getUrl();

    try {
      if (typeof navigator.share === 'function') {
        await navigator.share({ title, text: description || title, url });
        setNotice({ text: 'Share sheet opened.', failed: false });
      } else {
        await copyText(url);
        setNotice({ text: 'Link copied to clipboard.', failed: false });
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return;
      try {
        await copyText(url);
        setNotice({ text: 'Link copied to clipboard.', failed: false });
      } catch {
        setNotice({
          text: 'Could not copy automatically. Select and copy this link:',
          failed: true,
          shareUrl: url,
        });
      }
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleShare}
        disabled={isSharing}
        aria-label={`Share ${title}`}
        title={`Share ${title}`}
        className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-full transition duration-200 hover:-translate-y-px hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8102E] focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-70 ${className}`}
      >
        <ArrowUpRight className="h-4 w-4 shrink-0" aria-hidden="true" />
        {!iconOnly && <span>{isSharing ? 'Sharing…' : label}</span>}
      </button>

      {notice && (
        <div
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className="muiro-share-toast fixed bottom-5 left-1/2 z-[100] flex w-max max-w-[calc(100vw-2rem)] -translate-x-1/2 items-start gap-3 rounded-2xl border border-white/10 bg-[#1A0F24] px-4 py-3 text-sm font-medium text-white shadow-[0_18px_50px_rgba(8,8,11,0.28)]"
        >
          <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#C8102E] text-white">
            {notice.failed ? <X className="h-4 w-4" aria-hidden="true" /> : <Check className="h-4 w-4" aria-hidden="true" />}
          </span>
          <span className="flex min-w-0 flex-col gap-1 leading-snug">
            <span>{notice.text}</span>
            {notice.shareUrl && (
              <span className="select-all break-all font-normal text-white/90" aria-label={`Share URL: ${notice.shareUrl}`}>
                {notice.shareUrl}
              </span>
            )}
          </span>
        </div>
      )}
    </>
  );
};
