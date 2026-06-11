/**
 * Utilidades de imagen para subir liviano a Storage sin perder calidad
 * perceptible. Se prefiere WebP (≈30% menos que JPEG a igual calidad) con
 * fallback a JPEG en navegadores que no lo soporten.
 */

/** Devuelve la extensión de archivo según el tipo MIME de un Blob. */
export function blobExt(blob: Blob): string {
  const t = blob.type;
  if (t.includes("webp")) return "webp";
  if (t.includes("png")) return "png";
  if (t.includes("jpeg") || t.includes("jpg")) return "jpg";
  if (t.includes("webm")) return "webm";
  if (t.includes("mp4")) return "mp4";
  if (t.includes("quicktime")) return "mov";
  return (t.split("/")[1] || "bin").replace(/[^a-z0-9]/gi, "");
}

function drawScaled(img: HTMLImageElement, max: number): HTMLCanvasElement | null {
  const scale = Math.min(1, max / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, w, h);
  return canvas;
}

/** toBlob prefiriendo WebP; si no está soportado, cae a JPEG. */
function canvasToBlobPreferWebp(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((webp) => {
      if (webp && webp.type === "image/webp") { resolve(webp); return; }
      canvas.toBlob((jpeg) => resolve(jpeg), "image/jpeg", quality);
    }, "image/webp", quality);
  });
}

/** toDataURL prefiriendo WebP; si no está soportado, cae a JPEG. */
function canvasToDataUrlPreferWebp(canvas: HTMLCanvasElement, quality: number): string {
  const webp = canvas.toDataURL("image/webp", quality);
  if (webp.startsWith("data:image/webp")) return webp;
  return canvas.toDataURL("image/jpeg", quality);
}

/** Lee un File como data URL. */
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result as string);
    fr.onerror = reject;
    fr.readAsDataURL(file);
  });
}

/**
 * Reduce una imagen (data URL) a una versión redimensionada y comprimida.
 * Devuelve un data URL (WebP o JPEG). Útil para avatares y miniaturas locales.
 */
export function compressImage(dataUrl: string, max = 64, quality = 0.5): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = drawScaled(img, max);
        resolve(canvas ? canvasToDataUrlPreferWebp(canvas, quality) : dataUrl);
      } catch { resolve(dataUrl); }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

/** Comprime una imagen (data URL) a un Blob (WebP/JPEG) de buena calidad para Storage. */
export function compressToBlob(dataUrl: string, max = 512, quality = 0.82): Promise<Blob | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = drawScaled(img, max);
        if (!canvas) { resolve(null); return; }
        canvasToBlobPreferWebp(canvas, quality).then(resolve);
      } catch { resolve(null); }
    };
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}
