import React, { useEffect, useRef, useState } from 'react';
import { Camera, RefreshCw, Check, X, AlertTriangle, Upload } from 'lucide-react';

interface CameraCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (dataUrl: string, fileName: string, fileSize: number) => void;
  fieldLabel: string;
}

export const CameraCaptureModal: React.FC<CameraCaptureModalProps> = ({
  isOpen,
  onClose,
  onCapture,
  fieldLabel
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fallbackInputRef = useRef<HTMLInputElement>(null);

  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [capturedDataUrl, setCapturedDataUrl] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [flashActive, setFlashActive] = useState(false);

  // Initialize camera stream
  useEffect(() => {
    if (!isOpen) {
      stopStream();
      setCapturedDataUrl(null);
      setErrorMsg(null);
      return;
    }

    startCamera();

    return () => {
      stopStream();
    };
  }, [isOpen, facingMode]);

  const stopStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  const startCamera = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    stopStream();

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Navegador não suporta acesso direto à câmera. Use o seletor de arquivos.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 3840, min: 1280 },
          height: { ideal: 2160, min: 720 }
        },
        audio: false
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }
      setIsLoading(false);
    } catch (err: any) {
      console.warn('Camera stream error:', err);
      setIsLoading(false);
      setErrorMsg(
        err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError'
          ? 'Permissão de acesso à câmera foi negada. Permita o uso da câmera no navegador ou utilize o seletor de arquivos.'
          : 'Não foi possível inicializar a câmera do dispositivo. Utilize a opção de upload alternativo.'
      );
    }
  };

  const toggleFacingMode = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  const takeSnapshot = () => {
    if (!videoRef.current) return;

    // Flash animation
    setFlashActive(true);
    setTimeout(() => setFlashActive(false), 200);

    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1920;
    canvas.height = video.videoHeight || 1080;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Highest quality image rendering
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.98);
    setCapturedDataUrl(dataUrl);
  };

  const handleConfirmPhoto = () => {
    if (!capturedDataUrl) return;

    // Approximate size from base64
    const approxSize = Math.round((capturedDataUrl.length * 3) / 4);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `foto_camera_${timestamp}.jpg`;

    onCapture(capturedDataUrl, fileName, approxSize);
    stopStream();
    onClose();
  };

  const handleRetake = () => {
    setCapturedDataUrl(null);
  };

  const handleFallbackFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      onCapture(dataUrl, file.name, file.size);
      stopStream();
      onClose();
    };
    reader.readAsDataURL(file);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-in fade-in">
      <div className="relative w-full max-w-2xl bg-[#111111] text-white border border-[#27272A] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#27272A] bg-[#191919]">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[#D5001C]" />
            <h3 className="text-sm font-semibold tracking-wide uppercase text-neutral-100">
              Captura de Evidência: <span className="text-neutral-400 font-normal">{fieldLabel}</span>
            </h3>
          </div>
          <button
            onClick={() => {
              stopStream();
              onClose();
            }}
            className="p-1.5 text-neutral-400 hover:text-white transition-colors"
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Viewport Area */}
        <div className="relative flex-1 bg-black flex items-center justify-center min-h-[360px] max-h-[520px] overflow-hidden">
          {flashActive && <div className="absolute inset-0 bg-white z-30 transition-opacity" />}

          {capturedDataUrl ? (
            <div className="relative w-full h-full flex items-center justify-center p-2">
              <img
                src={capturedDataUrl}
                alt="Foto capturada"
                className="max-h-[480px] max-w-full object-contain border border-[#333]"
              />
              <div className="absolute top-4 left-4 bg-black/60 px-2 py-1 text-xs text-emerald-400 font-mono border border-emerald-500/30">
                PRÉ-VISUALIZAÇÃO DE CAPTURA
              </div>
            </div>
          ) : errorMsg ? (
            <div className="p-8 text-center max-w-md">
              <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-3" />
              <p className="text-sm text-neutral-300 mb-5 leading-relaxed">{errorMsg}</p>
              <button
                type="button"
                onClick={() => fallbackInputRef.current?.click()}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#D5001C] text-white text-xs font-semibold uppercase tracking-wider hover:bg-[#b00017] transition-colors"
              >
                <Upload className="w-4 h-4" />
                Selecionar Arquivo no Dispositivo
              </button>
              <input
                ref={fallbackInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleFallbackFileSelect}
              />
            </div>
          ) : (
            <div className="relative w-full h-full flex items-center justify-center">
              {isLoading && (
                <div className="absolute z-10 flex flex-col items-center gap-2 text-neutral-400">
                  <RefreshCw className="w-6 h-6 animate-spin text-[#D5001C]" />
                  <span className="text-xs uppercase tracking-wider">Acessando sensor da câmera...</span>
                </div>
              )}
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover max-h-[500px]"
              />
              {/* Overlay Rule of Thirds Guide */}
              <div className="absolute inset-0 pointer-events-none border border-white/10 grid grid-cols-3 grid-rows-3 opacity-30">
                <div className="border-r border-b border-white/20" />
                <div className="border-r border-b border-white/20" />
                <div className="border-b border-white/20" />
                <div className="border-r border-b border-white/20" />
                <div className="border-r border-b border-white/20" />
                <div className="border-b border-white/20" />
                <div className="border-r border-white/20" />
                <div className="border-r border-white/20" />
                <div />
              </div>
            </div>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex items-center justify-between px-6 py-4 bg-[#141414] border-t border-[#27272A]">
          {capturedDataUrl ? (
            <>
              <button
                type="button"
                onClick={handleRetake}
                className="inline-flex items-center gap-2 px-4 py-2 border border-neutral-700 text-neutral-300 hover:text-white hover:border-neutral-500 text-xs font-medium uppercase tracking-wider transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Tirar Outra
              </button>
              <button
                type="button"
                onClick={handleConfirmPhoto}
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#D5001C] hover:bg-[#b00017] text-white text-xs font-semibold uppercase tracking-wider transition-colors shadow-md"
              >
                <Check className="w-4 h-4" />
                Usar Esta Foto
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={toggleFacingMode}
                disabled={isLoading || !!errorMsg}
                className="inline-flex items-center gap-2 px-3 py-2 text-neutral-400 hover:text-white text-xs uppercase tracking-wider disabled:opacity-30 transition-colors"
                title="Trocar para câmera frontal/traseira"
              >
                <RefreshCw className="w-4 h-4" />
                {facingMode === 'environment' ? 'Traseira (Principal)' : 'Frontal'}
              </button>

              <button
                type="button"
                onClick={takeSnapshot}
                disabled={isLoading || !!errorMsg}
                className="relative flex items-center justify-center w-14 h-14 rounded-full border-2 border-white hover:border-[#D5001C] transition-colors p-1 disabled:opacity-30"
                title="Capturar Foto"
              >
                <div className="w-full h-full bg-white rounded-full active:scale-90 transition-transform" />
              </button>

              <button
                type="button"
                onClick={() => fallbackInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 text-xs text-neutral-400 hover:text-white uppercase tracking-wider transition-colors"
                title="Fazer upload de foto já existente"
              >
                <Upload className="w-3.5 h-3.5" />
                Arquivo
              </button>
              <input
                ref={fallbackInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFallbackFileSelect}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
};
