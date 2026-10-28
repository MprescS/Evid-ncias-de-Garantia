import React, { useEffect, useRef, useState } from 'react';
import { Film, RefreshCw, Check, X, AlertTriangle, Upload, Square, Circle, Video } from 'lucide-react';

interface VideoCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (dataUrl: string, fileName: string, fileSize: number) => void;
  fieldLabel: string;
}

export const VideoCaptureModal: React.FC<VideoCaptureModalProps> = ({
  isOpen,
  onClose,
  onCapture,
  fieldLabel
}) => {
  const videoPreviewRef = useRef<HTMLVideoElement>(null);
  const recordedVideoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const nativeCameraInputRef = useRef<HTMLInputElement>(null);
  const timerIntervalRef = useRef<any>(null);

  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recordedBlobUrl, setRecordedBlobUrl] = useState<string | null>(null);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize camera stream when opened
  useEffect(() => {
    if (!isOpen) {
      stopAll();
      setRecordedBlobUrl(null);
      setRecordedBlob(null);
      setIsRecording(false);
      setRecordingSeconds(0);
      setErrorMsg(null);
      return;
    }

    startCamera();

    return () => {
      stopAll();
    };
  }, [isOpen, facingMode]);

  const stopAll = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  const startCamera = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    stopAll();

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Navegador não suporta gravação direta de vídeo. Use a câmera nativa do sistema.');
      }

      // Try with video and audio
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: facingMode },
            width: { ideal: 1280 },
            height: { ideal: 720 }
          },
          audio: true
        });
      } catch (audioErr) {
        // Fallback to video only if audio permission was denied
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: facingMode },
            width: { ideal: 1280 },
            height: { ideal: 720 }
          },
          audio: false
        });
      }

      streamRef.current = stream;
      if (videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = stream;
        videoPreviewRef.current.play().catch(() => {});
      }
      setIsLoading(false);
    } catch (err: any) {
      console.warn('Video camera stream error:', err);
      setIsLoading(false);
      setErrorMsg(
        err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError'
          ? 'Permissão de acesso à câmera e microfone foi negada. Permita o acesso ou utilize a câmera nativa do dispositivo.'
          : 'Não foi possível inicializar a câmera para vídeo. Utilize a opção da câmera nativa do dispositivo.'
      );
    }
  };

  const toggleFacingMode = () => {
    if (isRecording) return;
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  const startRecording = () => {
    if (!streamRef.current) return;
    recordedChunksRef.current = [];
    setRecordingSeconds(0);

    try {
      // Determine best supported mime type
      const mimeTypes = [
        'video/mp4',
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus',
        'video/webm'
      ];
      let selectedMime = '';
      for (const mime of mimeTypes) {
        if (MediaRecorder.isTypeSupported(mime)) {
          selectedMime = mime;
          break;
        }
      }

      const recorder = new MediaRecorder(
        streamRef.current,
        selectedMime ? { mimeType: selectedMime } : undefined
      );

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          recordedChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const mime = selectedMime || 'video/mp4';
        const blob = new Blob(recordedChunksRef.current, { type: mime });
        setRecordedBlob(blob);
        const url = URL.createObjectURL(blob);
        setRecordedBlobUrl(url);
      };

      recorder.start(1000); // 1-second chunks
      mediaRecorderRef.current = recorder;
      setIsRecording(true);

      // Start elapsed timer
      timerIntervalRef.current = setInterval(() => {
        setRecordingSeconds((prev) => {
          // Max limit: 3 minutes (180s)
          if (prev >= 180) {
            stopRecording();
            return 180;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (err: any) {
      console.error('Failed to start MediaRecorder:', err);
      alert('Erro ao iniciar gravação de vídeo. Utilize a câmera nativa do dispositivo.');
    }
  };

  const stopRecording = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  const handleRetake = () => {
    if (recordedBlobUrl) {
      URL.revokeObjectURL(recordedBlobUrl);
    }
    setRecordedBlobUrl(null);
    setRecordedBlob(null);
    setRecordingSeconds(0);
    startCamera();
  };

  const handleConfirmVideo = () => {
    if (!recordedBlob) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const ext = recordedBlob.type.includes('webm') ? 'webm' : 'mp4';
      const fileName = `video_diagnostico_camera_${timestamp}.${ext}`;
      onCapture(dataUrl, fileName, recordedBlob.size);
      stopAll();
      onClose();
    };
    reader.readAsDataURL(recordedBlob);
  };

  const handleNativeVideoInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      onCapture(dataUrl, file.name, file.size);
      stopAll();
      onClose();
    };
    reader.readAsDataURL(file);
  };

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-xs p-4 animate-in fade-in">
      <div className="relative w-full max-w-2xl bg-[#111111] text-white border border-[#27272A] shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#27272A] bg-[#191919]">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[#D5001C]" />
            <h3 className="text-sm font-semibold tracking-wide uppercase text-neutral-100 flex items-center gap-2">
              <Film className="w-4 h-4 text-[#D5001C]" />
              Gravar Vídeo: <span className="text-neutral-400 font-normal">{fieldLabel}</span>
            </h3>
          </div>
          <button
            onClick={() => {
              stopAll();
              onClose();
            }}
            className="p-1.5 text-neutral-400 hover:text-white transition-colors"
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Viewport Area */}
        <div className="relative flex-1 bg-black flex items-center justify-center min-h-[360px] max-h-[500px] overflow-hidden">
          {recordedBlobUrl ? (
            <div className="relative w-full h-full flex flex-col items-center justify-center p-2">
              <video
                ref={recordedVideoRef}
                src={recordedBlobUrl}
                controls
                autoPlay
                className="max-h-[460px] max-w-full rounded-xs shadow-lg"
              />
              <div className="absolute top-4 left-4 bg-black/70 px-2.5 py-1 text-xs text-emerald-400 font-mono border border-emerald-500/40">
                PRÉVIA DO VÍDEO GRAVADO ({formatTimer(recordingSeconds)})
              </div>
            </div>
          ) : errorMsg ? (
            <div className="p-8 text-center max-w-md">
              <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-3" />
              <p className="text-sm text-neutral-300 mb-5 leading-relaxed">{errorMsg}</p>
              <button
                type="button"
                onClick={() => nativeCameraInputRef.current?.click()}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#D5001C] text-white text-xs font-semibold uppercase tracking-wider hover:bg-[#b00017] transition-colors"
              >
                <Video className="w-4 h-4" />
                Abrir Câmera de Vídeo do Dispositivo
              </button>
              <input
                ref={nativeCameraInputRef}
                type="file"
                accept="video/*"
                capture="environment"
                className="hidden"
                onChange={handleNativeVideoInput}
              />
            </div>
          ) : (
            <div className="relative w-full h-full flex items-center justify-center">
              {isLoading && (
                <div className="absolute z-10 flex flex-col items-center gap-2 text-neutral-400">
                  <RefreshCw className="w-6 h-6 animate-spin text-[#D5001C]" />
                  <span className="text-xs uppercase tracking-wider font-mono">
                    Conectando câmera e microfone...
                  </span>
                </div>
              )}
              <video
                ref={videoPreviewRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover max-h-[480px]"
              />

              {/* Recording indicator & timer overlay */}
              {isRecording && (
                <div className="absolute top-4 left-4 bg-black/80 px-3 py-1.5 border border-red-500/50 flex items-center gap-2.5 z-20">
                  <div className="w-3 h-3 rounded-full bg-red-600 animate-pulse" />
                  <span className="text-xs font-mono font-bold text-white tracking-widest">
                    REC {formatTimer(recordingSeconds)} / 03:00
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 bg-[#141414] border-t border-[#27272A]">
          {recordedBlobUrl ? (
            <>
              <button
                type="button"
                onClick={handleRetake}
                className="inline-flex items-center gap-2 px-4 py-2 border border-neutral-700 text-neutral-300 hover:text-white hover:border-neutral-500 text-xs font-medium uppercase tracking-wider transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Gravar Novamente
              </button>
              <button
                type="button"
                onClick={handleConfirmVideo}
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#D5001C] hover:bg-[#b00017] text-white text-xs font-semibold uppercase tracking-wider transition-colors shadow-md"
              >
                <Check className="w-4 h-4" />
                Usar Este Vídeo
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={toggleFacingMode}
                disabled={isLoading || isRecording || !!errorMsg}
                className="inline-flex items-center gap-2 px-3 py-2 text-neutral-400 hover:text-white text-xs uppercase tracking-wider disabled:opacity-30 transition-colors"
                title="Trocar câmera"
              >
                <RefreshCw className="w-4 h-4" />
                {facingMode === 'environment' ? 'Traseira' : 'Frontal'}
              </button>

              {/* Main Record Trigger */}
              {isRecording ? (
                <button
                  type="button"
                  onClick={stopRecording}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-full font-bold text-xs uppercase tracking-wider shadow-lg animate-pulse"
                >
                  <Square className="w-4 h-4 fill-white" />
                  Parar Gravação ({formatTimer(recordingSeconds)})
                </button>
              ) : (
                <button
                  type="button"
                  onClick={startRecording}
                  disabled={isLoading || !!errorMsg}
                  className="relative flex items-center justify-center w-14 h-14 rounded-full border-2 border-white hover:border-[#D5001C] transition-colors p-1 disabled:opacity-30"
                  title="Iniciar Gravação de Vídeo"
                >
                  <div className="w-full h-full bg-red-600 rounded-full active:scale-90 transition-transform" />
                </button>
              )}

              {/* Native Mobile Camera trigger */}
              <button
                type="button"
                onClick={() => nativeCameraInputRef.current?.click()}
                disabled={isRecording}
                className="inline-flex items-center gap-1.5 text-xs text-neutral-400 hover:text-white uppercase tracking-wider transition-colors"
                title="Usar aplicativo de câmera nativo do celular"
              >
                <Video className="w-3.5 h-3.5 text-[#D5001C]" />
                Câmera Nativa
              </button>
              <input
                ref={nativeCameraInputRef}
                type="file"
                accept="video/*"
                capture="environment"
                className="hidden"
                onChange={handleNativeVideoInput}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
};
