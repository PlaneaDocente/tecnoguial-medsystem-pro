'use client';

import { useRef, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

interface SignaturePadProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (signatureDataUrl: string) => void;
  onClear?: () => void;
  initialSignature?: string;
}

export function SignaturePad({
  open,
  onOpenChange,
  onSave,
  onClear,
  initialSignature,
}: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);

  useEffect(() => {
    if (open && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Set canvas size
        canvas.width = canvas.offsetWidth;
        canvas.height = 200;

        // Set drawing styles
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // Load initial signature if provided
        if (initialSignature) {
          const img = new Image();
          img.onload = () => {
            ctx.drawImage(img, 0, 0);
            setHasSignature(true);
          };
          img.src = initialSignature;
        }
      }
    }
  }, [open, initialSignature]);

  const getPosition = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    if ('touches' in e) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY,
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;

    setIsDrawing(true);
    const pos = getPosition(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    setHasSignature(true);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;

    const pos = getPosition(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx || !canvas) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
    onClear?.();
  };

  const saveSignature = () => {
    if (!canvasRef.current || !hasSignature) return;

    const dataUrl = canvasRef.current.toDataURL('image/png');
    onSave(dataUrl);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Firma Digital</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-slate-500">
            Dibuja tu firma en el recuadro inferior usando el mouse o tu dedo.
          </p>

          <div className="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg overflow-hidden">
            <canvas
              ref={canvasRef}
              className="w-full h-[200px] bg-white dark:bg-slate-800 cursor-crosshair touch-none"
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
            />
          </div>

          <div className="flex justify-between items-center">
            <p className="text-xs text-slate-400">
              * Tu firma será guardada de forma segura
            </p>
            <Button variant="outline" size="sm" onClick={clearCanvas}>
              Limpiar
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={saveSignature} disabled={!hasSignature}>
            Guardar Firma
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
