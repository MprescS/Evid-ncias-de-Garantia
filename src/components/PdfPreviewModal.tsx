import React, { useState, useEffect } from 'react';
import { X, Download, Printer, Share2, FileText, CheckCircle2, AlertCircle } from 'lucide-react';
import { WarrantyRecord } from '../types';
import { generateWarrantyPdf } from '../utils/pdfGenerator';
import { generatePdfFileName, formatFileSize } from '../utils/formatters';

interface PdfPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  record: WarrantyRecord;
  onPdfGenerated?: () => void;
}

export const PdfPreviewModal: React.FC<PdfPreviewModalProps> = ({
  isOpen,
  onClose,
  record,
  onPdfGenerated
}) => {
  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null);
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fileName = generatePdfFileName(record);

  useEffect(() => {
    if (!isOpen) {
      if (pdfBlobUrl) {
        URL.revokeObjectURL(pdfBlobUrl);
        setPdfBlobUrl(null);
      }
      setPdfBytes(null);
      return;
    }

    generatePdfDocument();
  }, [isOpen, record]);

  const generatePdfDocument = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const bytes = await generateWarrantyPdf(record);
      setPdfBytes(bytes);

      const blob = new Blob([bytes.buffer as ArrayBuffer], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      setPdfBlobUrl(url);
      setIsLoading(false);

      if (onPdfGenerated) {
        onPdfGenerated();
      }
    } catch (err: any) {
      console.error('Error generating PDF:', err);
      setErrorMsg('Ocorreu um erro ao processar o relatório PDF. Verifique se as imagens estão acessíveis.');
      setIsLoading(false);
    }
  };

  const handleDownload = () => {
    if (!pdfBlobUrl) return;
    const a = document.createElement('a');
    a.href = pdfBlobUrl;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handlePrint = () => {
    if (!pdfBlobUrl) return;
    const printWindow = window.open(pdfBlobUrl, '_blank');
    if (printWindow) {
      printWindow.onload = () => {
        printWindow.print();
      };
    }
  };

  const handleShare = async () => {
    if (!pdfBytes) return;
    try {
      const file = new File([pdfBytes.buffer as ArrayBuffer], fileName, { type: 'application/pdf' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `Relatório de Evidências OS ${record.osNumber}`,
          text: `Evidências de reparo em garantia - Chassi ${record.chassisVin}`
        });
      } else {
        handleDownload();
      }
    } catch (err) {
      console.warn('Share not supported or dismissed:', err);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-xs p-3 md:p-6 animate-in fade-in">
      <div className="relative w-full max-w-5xl h-[92vh] bg-neutral-900 text-white border border-neutral-700 shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b border-neutral-800 bg-[#161616]">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-neutral-800 border border-neutral-700">
              <FileText className="w-5 h-5 text-[#D5001C]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold uppercase tracking-wider text-neutral-100">
                  Relatório de Evidências em Garantia
                </h3>
                <span className="text-[10px] font-mono px-1.5 py-0.5 bg-neutral-800 text-neutral-300 border border-neutral-700">
                  v{record.version || 1}
                </span>
              </div>
              <p className="text-xs text-neutral-400 font-mono mt-0.5">
                {fileName} {pdfBytes && `· ${formatFileSize(pdfBytes.byteLength)}`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              disabled={isLoading || !pdfBlobUrl}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-neutral-800 hover:bg-neutral-700 text-xs font-semibold uppercase tracking-wider text-neutral-200 hover:text-white transition-colors disabled:opacity-40"
              title="Imprimir documento"
            >
              <Printer className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Imprimir</span>
            </button>

            {typeof navigator !== 'undefined' && 'share' in navigator && (
              <button
                onClick={handleShare}
                disabled={isLoading || !pdfBytes}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-neutral-800 hover:bg-neutral-700 text-xs font-semibold uppercase tracking-wider text-neutral-200 hover:text-white transition-colors disabled:opacity-40"
                title="Compartilhar via aplicativo nativo"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Compartilhar</span>
              </button>
            )}

            <button
              onClick={handleDownload}
              disabled={isLoading || !pdfBlobUrl}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#D5001C] hover:bg-[#b00017] text-white text-xs font-bold uppercase tracking-wider transition-colors shadow-sm disabled:opacity-40"
              title="Baixar PDF no dispositivo"
            >
              <Download className="w-4 h-4" />
              <span>Baixar PDF</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 text-neutral-400 hover:text-white transition-colors ml-2"
              title="Fechar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Viewer */}
        <div className="flex-1 bg-neutral-950 flex items-center justify-center relative overflow-hidden">
          {isLoading ? (
            <div className="flex flex-col items-center gap-3 text-neutral-400">
              <div className="w-8 h-8 border-2 border-[#D5001C] border-t-transparent rounded-full animate-spin" />
              <p className="text-xs uppercase tracking-widest font-mono">
                Processando evidências e gerando PDF A4...
              </p>
            </div>
          ) : errorMsg ? (
            <div className="p-6 text-center max-w-md">
              <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-3" />
              <p className="text-sm text-neutral-300 mb-4">{errorMsg}</p>
              <button
                onClick={generatePdfDocument}
                className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-xs uppercase font-semibold"
              >
                Tentar Novamente
              </button>
            </div>
          ) : pdfBlobUrl ? (
            <iframe
              src={pdfBlobUrl}
              title="Visualizador de PDF"
              className="w-full h-full border-0 bg-neutral-800"
            />
          ) : null}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-2.5 bg-[#161616] border-t border-neutral-800 text-xs text-neutral-400 font-mono">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <span>Relatório validado · Formato A4 de alta resolução</span>
          </div>
          <span className="hidden sm:inline">Padrão Porsche Workshop Warranty Compliance</span>
        </div>
      </div>
    </div>
  );
};
