"use client";

import * as React from "react";
import Cropper, { type Area } from "react-easy-crop";
import { ImagePlus, Loader2, RefreshCw, ZoomIn, ZoomOut } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";

const MIN_ZOOM = 1;
const MAX_ZOOM = 3;
const OUTPUT_SIZE = 512; // square px — high enough for retina, small enough to upload fast
const ACCEPT = "image/png,image/jpeg,image/webp";
const MAX_FILE_BYTES = 8 * 1024 * 1024; // 8 MB

interface AvatarUploadDialogProps {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  userId: string;
  onUploaded: (publicUrl: string) => void;
}

/**
 * Two-step dialog: pick a file, then crop/zoom inside a circular preview.
 * On save, the cropped region is rasterized to a 512×512 JPEG via canvas,
 * uploaded to the user's folder in the `avatars` bucket, and the resulting
 * public URL is handed back to the caller (which persists it to the
 * `profiles.avatar_url` column).
 */
export function AvatarUploadDialog({
  open, onOpenChange, userId, onUploaded,
}: AvatarUploadDialogProps) {
  const supabase = React.useMemo(() => createClient(), []);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const [imageSrc, setImageSrc] = React.useState<string | null>(null);
  const [crop, setCrop] = React.useState({ x: 0, y: 0 });
  const [zoom, setZoom] = React.useState(1);
  const [croppedAreaPx, setCroppedAreaPx] = React.useState<Area | null>(null);
  const [uploading, setUploading] = React.useState(false);

  // Reset state whenever the dialog closes so reopening starts fresh.
  React.useEffect(() => {
    if (open) return;
    setImageSrc(null);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPx(null);
    setUploading(false);
  }, [open]);

  const onCropComplete = React.useCallback((_area: Area, areaPx: Area) => {
    setCroppedAreaPx(areaPx);
  }, []);

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) {
      toast.error("Image too large", { description: "Max 8 MB." });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setImageSrc(reader.result);
        setCrop({ x: 0, y: 0 });
        setZoom(1);
      }
    };
    reader.readAsDataURL(file);
  }

  async function handleSave() {
    if (!imageSrc || !croppedAreaPx) return;
    setUploading(true);
    try {
      const blob = await renderCroppedJpeg(imageSrc, croppedAreaPx);
      // Path includes a timestamp so the public URL changes on each upload —
      // sidesteps any CDN/browser caching of the previous avatar.
      const path = `${userId}/avatar-${Date.now()}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, blob, {
          contentType: "image/jpeg",
          cacheControl: "3600",
          upsert: false,
        });
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      onUploaded(data.publicUrl);
      onOpenChange(false);
      toast.success("Avatar updated");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      toast.error(`Upload failed: ${msg}`);
    } finally {
      setUploading(false);
    }
  }

  const hasImage = !!imageSrc;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>Update profile picture</DialogTitle>
          <DialogDescription>
            {hasImage
              ? "Drag to reposition. Use the slider to zoom."
              : "PNG, JPG, or WebP — under 8 MB."}
          </DialogDescription>
        </DialogHeader>

        {hasImage ? (
          <div className="space-y-4">
            <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-black">
              <Cropper
                image={imageSrc!}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="round"
                showGrid={false}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
                objectFit="contain"
              />
            </div>

            <div className="flex items-center gap-3">
              <ZoomOut className="h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="range"
                min={MIN_ZOOM}
                max={MAX_ZOOM}
                step={0.01}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-muted accent-foreground"
                aria-label="Zoom"
              />
              <ZoomIn className="h-3.5 w-3.5 text-muted-foreground" />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
              >
                <RefreshCw className="h-3 w-3" />
                Change
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex aspect-square w-full flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-border bg-muted/20 text-muted-foreground transition-colors hover:bg-muted/40"
          >
            <ImagePlus className="h-8 w-8" />
            <div className="text-center">
              <div className="text-sm font-medium text-foreground">Choose an image</div>
              <div className="mt-0.5 text-[11px]">Click to browse</div>
            </div>
          </button>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPT}
          onChange={onFileChange}
          className="hidden"
        />

        <DialogFooter className="gap-2">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} disabled={uploading}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSave} disabled={!hasImage || uploading}>
            {uploading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Uploading…
              </>
            ) : (
              "Save"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Rasterize the crop selection onto a square canvas at OUTPUT_SIZE and return
 * a JPEG blob. Done client-side so we never upload more than the final
 * cropped image — no need to lug a 5MB original to Supabase.
 */
async function renderCroppedJpeg(imageSrc: string, area: Area): Promise<Blob> {
  const image = await loadImage(imageSrc);
  const canvas = document.createElement("canvas");
  canvas.width = OUTPUT_SIZE;
  canvas.height = OUTPUT_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");

  ctx.drawImage(
    image,
    area.x, area.y, area.width, area.height,
    0, 0, OUTPUT_SIZE, OUTPUT_SIZE,
  );

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Canvas toBlob failed"))),
      "image/jpeg",
      0.92,
    );
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(new Error(`Image load failed: ${String(e)}`));
    img.src = src;
  });
}
