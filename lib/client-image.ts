"use client";

import { useEffect } from "react";

const MAX_EDGE = 1600;
const QUALITY = 0.82;

function extensionFor(mime: string) {
  if (mime === "image/webp") return "webp";
  if (mime === "image/png") return "png";
  return "jpg";
}

async function decodeImage(file: File): Promise<{ image: ImageBitmap | HTMLImageElement; width: number; height: number; cleanup: () => void }> {
  if (typeof createImageBitmap === "function") {
    const bitmap = await createImageBitmap(file);
    return { image: bitmap, width: bitmap.width, height: bitmap.height, cleanup: () => bitmap.close?.() };
  }
  const url = URL.createObjectURL(file);
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = reject;
    el.src = url;
  });
  return { image: img, width: img.naturalWidth || img.width, height: img.naturalHeight || img.height, cleanup: () => URL.revokeObjectURL(url) };
}

export async function prepareImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  try {
    const { image, width, height, cleanup } = await decodeImage(file);
    try {
      const longestEdge = Math.max(width, height);
      const scale = longestEdge > MAX_EDGE ? MAX_EDGE / longestEdge : 1;
      const targetWidth = Math.max(1, Math.round(width * scale));
      const targetHeight = Math.max(1, Math.round(height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return file;
      ctx.drawImage(image as CanvasImageSource, 0, 0, targetWidth, targetHeight);
      const outputType = file.type === "image/webp" ? "image/webp" : "image/jpeg";
      const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, outputType, QUALITY));
      if (!blob || blob.size >= file.size) return file;
      const name = file.name.replace(/\.[^.]+$/, "") + "." + extensionFor(outputType);
      return new File([blob], name, { type: outputType });
    } finally {
      cleanup();
    }
  } catch {
    return file;
  }
}

export function extractImageFromClipboard(e: ClipboardEvent): File | null {
  const items = e.clipboardData?.items;
  if (!items) return null;
  for (const item of Array.from(items)) {
    if (item.type.startsWith("image/")) return item.getAsFile();
  }
  return null;
}

export function usePasteImage(onImage: (file: File) => void, enabled = true): void {
  useEffect(() => {
    if (!enabled) return;
    const handler = async (e: ClipboardEvent) => {
      const file = extractImageFromClipboard(e);
      if (!file) return;
      e.preventDefault();
      onImage(await prepareImage(file));
    };
    window.addEventListener("paste", handler);
    return () => window.removeEventListener("paste", handler);
  }, [enabled, onImage]);
}
