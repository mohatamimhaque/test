/**
 * Turn an image URL into a data URL suitable for html2canvas.
 *
 * Why this is needed: the R2 bucket sends no CORS headers, so drawing the
 * member photo straight onto a canvas taints it and `toDataURL()` throws a
 * SecurityError. html2canvas therefore cannot export the card as-is.
 *
 * Fetching through an XHR first does not help either — the response is opaque
 * without CORS. The robust fix is to configure CORS on the bucket (one-time
 * dashboard step, see README), but until that is done we degrade gracefully:
 * export the card WITHOUT the photo rather than failing outright.
 */

/**
 * Resolves to true when `url` can be drawn onto a canvas and read back.
 *
 * Use before calling html2canvas so the caller can decide whether to keep the
 * photo in the export or drop it. Times out after `timeoutMs` so a slow photo
 * never blocks the download indefinitely.
 */
export function isCanvasSafeImage(url: string, timeoutMs = 3000): Promise<boolean> {
  if (!url) return Promise.resolve(false);
  if (url.startsWith('data:')) return Promise.resolve(true);

  return new Promise((resolve) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext('2d');

    const finish = (ok: boolean) => {
      clearTimeout(timer);
      img.onload = null;
      img.onerror = null;
      resolve(ok);
    };

    const timer = setTimeout(() => finish(false), timeoutMs);

    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (!ctx) return finish(false);
      try {
        ctx.drawImage(img, 0, 0, 1, 1);
        ctx.getImageData(0, 0, 1, 1);
        finish(true);
      } catch {
        finish(false);
      }
    };
    img.onerror = () => finish(false);
    img.src = url;
  });
}
