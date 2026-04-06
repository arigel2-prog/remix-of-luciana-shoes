import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, X, ZoomIn, ZoomOut } from "lucide-react";
import { useState, useCallback } from "react";

interface ImageLightboxProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  src: string;
  alt?: string;
}

export function ImageLightbox({ open, onOpenChange, src, alt }: ImageLightboxProps) {
  const [scale, setScale] = useState(1);

  const zoomIn = useCallback(() => setScale((s) => Math.min(s + 0.5, 4)), []);
  const zoomOut = useCallback(() => setScale((s) => Math.max(s - 0.5, 0.5)), []);
  const resetZoom = useCallback(() => setScale(1), []);

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) resetZoom(); }}>
      <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 border-none bg-black/95 overflow-hidden flex flex-col items-center justify-center">
        <div className="absolute top-3 right-3 z-50 flex gap-2">
          <Button variant="ghost" size="icon" onClick={zoomOut} className="text-white hover:bg-white/20 h-8 w-8">
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={zoomIn} className="text-white hover:bg-white/20 h-8 w-8">
            <ZoomIn className="h-4 w-4" />
          </Button>
        </div>
        <div
          className="flex-1 flex items-center justify-center w-full overflow-auto cursor-grab active:cursor-grabbing p-4"
          onClick={() => { onOpenChange(false); resetZoom(); }}
        >
          <img
            src={src}
            alt={alt || ""}
            className="max-w-full max-h-[85vh] object-contain transition-transform duration-200"
            style={{ transform: `scale(${scale})` }}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
