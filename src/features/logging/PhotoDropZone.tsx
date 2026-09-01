import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PhotoDropZoneProps {
  onCapture: (dataUrl: string) => void;
}

export function PhotoDropZone({ onCapture }: PhotoDropZoneProps) {
  const [dragActive, setDragActive] = useState(false);
  const [webcamActive, setWebcamActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const stopWebcam = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setWebcamActive(false);
  }, []);

  useEffect(() => stopWebcam, [stopWebcam]);

  async function startWebcam() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      streamRef.current = stream;
      setWebcamActive(true);
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch (e) {
      console.error("Webcam access failed", e);
    }
  }

  function captureFromWebcam() {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    stopWebcam();
    onCapture(canvas.toDataURL("image/jpeg", 0.92));
  }

  function readFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => onCapture(reader.result as string);
    reader.readAsDataURL(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) readFile(file);
  }

  if (webcamActive) {
    return (
      <div className="relative overflow-hidden rounded-lg border-2 border-border">
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video ref={videoRef} autoPlay playsInline className="aspect-video w-full bg-black object-cover" />
        <button
          type="button"
          onClick={stopWebcam}
          className="absolute right-3 top-3 rounded-full bg-background/80 p-1.5 text-foreground backdrop-blur"
          aria-label="Close webcam"
        >
          <X className="size-4" />
        </button>
        <div className="absolute inset-x-0 bottom-4 flex justify-center">
          <Button onClick={captureFromWebcam} size="lg" className="gap-2">
            <Camera className="size-4" />
            Capture
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragActive(true);
      }}
      onDragLeave={() => setDragActive(false)}
      onDrop={handleDrop}
      className={cn(
        "relative flex flex-col items-center justify-center gap-4 rounded-lg border-2 border-dashed px-6 py-16 text-center transition-colors",
        dragActive ? "border-primary bg-primary/5" : "border-border bg-card"
      )}
    >
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={startWebcam}
        className="absolute right-3 top-3"
        aria-label="Use webcam"
      >
        <Camera className="size-4" />
      </Button>

      <div className="flex size-14 items-center justify-center rounded-full bg-muted">
        <Upload className="size-6 text-muted-foreground" />
      </div>
      <div>
        <p className="font-display text-base font-semibold text-foreground">
          Drop a meal photo here
        </p>
        <p className="mt-1 text-sm text-muted-foreground">or click to browse, or use the webcam</p>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="absolute inset-0 cursor-pointer opacity-0"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) readFile(file);
        }}
      />
    </div>
  );
}
