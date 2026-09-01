"use client";

import { useEffect, useRef } from "react";

const WIDTH = 320;
const HEIGHT = 120;

function pointsToSvg(points: Array<{ x: number; y: number }>): string | null {
  if (points.length < 2) return null;
  const d = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`)
    .join(" ");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${HEIGHT}" width="${WIDTH}" height="${HEIGHT}"><path d="${d}" fill="none" stroke="#111" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

export function QuoteSignaturePad({
  onChange,
}: {
  onChange: (svg: string | null) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointsRef = useRef<Array<{ x: number; y: number }>>([]);
  const drawingRef = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.strokeStyle = "#111";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, []);

  const eventPoint = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * WIDTH;
    const y = ((event.clientY - rect.top) / rect.height) * HEIGHT;
    return {
      x: Math.max(0, Math.min(WIDTH, x)),
      y: Math.max(0, Math.min(HEIGHT, y)),
    };
  };

  const finishStroke = () => {
    drawingRef.current = false;
    onChange(pointsToSvg(pointsRef.current));
  };

  return (
    <div className="space-y-2">
      <canvas
        ref={canvasRef}
        width={WIDTH}
        height={HEIGHT}
        className="h-28 w-full touch-none rounded-md border border-neutral-300 bg-white"
        onPointerDown={(event) => {
          const point = eventPoint(event);
          if (!point) return;
          drawingRef.current = true;
          pointsRef.current.push(point);
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (!drawingRef.current) return;
          const point = eventPoint(event);
          const canvas = canvasRef.current;
          const ctx = canvas?.getContext("2d");
          if (!point || !ctx || !canvas) return;
          const prev = pointsRef.current[pointsRef.current.length - 1];
          pointsRef.current.push(point);
          if (prev) {
            ctx.beginPath();
            ctx.moveTo(prev.x, prev.y);
            ctx.lineTo(point.x, point.y);
            ctx.stroke();
          }
        }}
        onPointerUp={finishStroke}
        onPointerCancel={finishStroke}
      />
      <button
        type="button"
        className="text-xs text-muted-foreground underline-offset-2 hover:underline"
        onClick={() => {
          const canvas = canvasRef.current;
          const ctx = canvas?.getContext("2d");
          if (canvas && ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
          }
          pointsRef.current = [];
          onChange(null);
        }}
      >
        Clear drawing
      </button>
    </div>
  );
}
