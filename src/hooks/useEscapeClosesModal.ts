import { useEffect } from 'react';

const CLOSE_LABEL = /^(tutup\b.*|close|batal|kembali)$/i;

const isVisible = (element: Element): boolean => element.getClientRects().length > 0;

/** Tombol penutup di dalam pop-up: berlabel tutup/batal, atau tombol ikon X. */
const findCloseButton = (overlay: Element): HTMLElement | null => {
  const buttons = Array.from(overlay.querySelectorAll<HTMLButtonElement>('button:not([disabled])')).filter(isVisible);
  return (
    buttons.find((button) => button.hasAttribute('data-modal-close')) ??
    buttons.find((button) => CLOSE_LABEL.test(button.getAttribute('aria-label') ?? button.getAttribute('title') ?? '')) ??
    buttons.find((button) => button.querySelector('svg.lucide-x')) ??
    buttons.find((button) => /^(✕|×|batal|tutup)$/i.test(button.textContent?.trim() ?? '')) ??
    null
  );
};

/**
 * Tombol Esc menutup pop-up yang paling atas. Pop-up di aplikasi ini berupa lapisan `fixed inset-0`;
 * Esc "menekan" tombol tutup/batal di dalamnya, jadi perilakunya sama dengan klik tombol itu.
 */
export const useEscapeClosesModal = (): void => {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented || event.isComposing) {
        return;
      }
      const overlays = Array.from(document.querySelectorAll('.fixed.inset-0')).filter(isVisible);
      for (let i = overlays.length - 1; i >= 0; i--) {
        const overlay = overlays[i];
        const closeButton = findCloseButton(overlay);
        if (closeButton) {
          event.preventDefault();
          closeButton.click();
          return;
        }
        if (overlay.getAttribute('aria-hidden') === 'true' && overlay instanceof HTMLElement) {
          event.preventDefault();
          overlay.click(); // latar menu samping di HP
          return;
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);
};
