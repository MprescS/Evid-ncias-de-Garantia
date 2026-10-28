import { PDFDocument, rgb, StandardFonts, PDFPage, PDFFont } from 'pdf-lib';
import { WarrantyRecord, StoredEvidenceFile } from '../types';
import { formatDateBr, formatDateTimeBr, formatFileSize } from './formatters';

// A4 dimensions in points
const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 36;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

// Porsche visual identity colors
const COLOR_BLACK = rgb(0.08, 0.08, 0.08);
const COLOR_DARK_GRAY = rgb(0.2, 0.22, 0.25);
const COLOR_MUTED_GRAY = rgb(0.45, 0.48, 0.52);
const COLOR_LIGHT_BG = rgb(0.96, 0.96, 0.97);
const COLOR_BORDER = rgb(0.88, 0.89, 0.91);
const COLOR_RED = rgb(0.835, 0.0, 0.11); // Porsche Carmine Red

/**
 * Converts any image (JPEG, PNG, WebP, SVG, Blob) to a clean PNG ArrayBuffer
 * so pdf-lib embeds it with 100% reliability and original crisp aspect ratio.
 */
async function convertDataUrlToPngBuffer(dataUrl: string): Promise<Uint8Array | null> {
  try {
    if (!dataUrl) return null;

    // If it's a remote URL (e.g. Supabase Storage signed URL)
    if (dataUrl.startsWith('http://') || dataUrl.startsWith('https://')) {
      try {
        const response = await fetch(dataUrl);
        if (response.ok) {
          const blob = await response.blob();
          const buffer = await blob.arrayBuffer();
          // If it's already PNG or JPEG, return directly
          if (blob.type === 'image/png' || blob.type === 'image/jpeg') {
            return new Uint8Array(buffer);
          }
        }
      } catch (fetchErr) {
        console.warn('Fetch image fallback to Image object:', fetchErr);
      }
    }

    // Canvas normalization for base64 or other formats (WebP, HEIC, etc.)
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth || img.width || 800;
          canvas.height = img.naturalHeight || img.height || 600;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(null);
            return;
          }
          // White background fallback for transparency
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0);

          canvas.toBlob((blob) => {
            if (!blob) {
              resolve(null);
              return;
            }
            const reader = new FileReader();
            reader.onloadend = () => {
              if (reader.result instanceof ArrayBuffer) {
                resolve(new Uint8Array(reader.result));
              } else {
                resolve(null);
              }
            };
            reader.onerror = () => resolve(null);
            reader.readAsArrayBuffer(blob);
          }, 'image/png', 0.98);
        } catch (e) {
          console.error('Error drawing image to canvas:', e);
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = dataUrl;
    });
  } catch (err) {
    console.error('Error converting image for PDF:', err);
    return null;
  }
}

/**
 * Splits text into lines fitting within maxWidth for a given font and fontSize
 */
function wrapText(text: string, font: PDFFont, fontSize: number, maxWidth: number): string[] {
  const paragraphs = text.split('\n');
  const lines: string[] = [];

  for (const para of paragraphs) {
    if (para.trim() === '') {
      lines.push('');
      continue;
    }
    const words = para.split(' ');
    let currentLine = '';

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const width = font.widthOfTextAtSize(testLine, fontSize);
      if (width <= maxWidth) {
        currentLine = testLine;
      } else {
        if (currentLine) lines.push(currentLine);
        currentLine = word;
      }
    }
    if (currentLine) lines.push(currentLine);
  }

  return lines;
}

export async function generateWarrantyPdf(record: WarrantyRecord): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();

  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontMono = await pdfDoc.embedFont(StandardFonts.Courier);

  const generationDateStr = formatDateTimeBr(new Date().toISOString());

  // Collect created pages to inject headers and footers at the end with exact total page count
  const pages: PDFPage[] = [];

  let currentPage = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  pages.push(currentPage);
  let y = PAGE_HEIGHT - MARGIN;

  // Function to ensure vertical space, creating a new page if needed
  const ensureSpace = (requiredHeight: number): void => {
    if (y - requiredHeight < MARGIN + 40) {
      currentPage = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      pages.push(currentPage);
      y = PAGE_HEIGHT - MARGIN - 30; // Leave room for running header on page 2+
    }
  };

  // ==========================================
  // PAGE 1: TITLE & REPAIR IDENTIFICATION
  // ==========================================
  // Top Porsche-inspired red stripe
  currentPage.drawRectangle({
    x: MARGIN,
    y: y,
    width: CONTENT_WIDTH,
    height: 3,
    color: COLOR_RED
  });
  y -= 14;

  // Title
  currentPage.drawText('RELATÓRIO DE EVIDÊNCIAS DE REPARO EM GARANTIA', {
    x: MARGIN,
    y: y,
    size: 14,
    font: fontBold,
    color: COLOR_BLACK
  });
  y -= 12;

  currentPage.drawText('DOCUMENTO TÉCNICO OFICIAL DE AUDITORIA E ARQUIVAMENTO', {
    x: MARGIN,
    y: y,
    size: 7.5,
    font: fontRegular,
    color: COLOR_MUTED_GRAY
  });
  y -= 16;

  // Identification Box
  const boxHeight = 72;
  currentPage.drawRectangle({
    x: MARGIN,
    y: y - boxHeight,
    width: CONTENT_WIDTH,
    height: boxHeight,
    color: COLOR_LIGHT_BG,
    borderColor: COLOR_BORDER,
    borderWidth: 1
  });

  const colWidth = CONTENT_WIDTH / 4;
  const colY = y - 18;

  // Col 1: OS
  currentPage.drawText('NÚMERO DA OS', { x: MARGIN + 12, y: colY, size: 7.5, font: fontBold, color: COLOR_MUTED_GRAY });
  currentPage.drawText(record.osNumber || 'NÃO INFORMADO', {
    x: MARGIN + 12,
    y: colY - 14,
    size: 11,
    font: fontBold,
    color: COLOR_BLACK
  });

  // Col 2: VIN / Chassi
  currentPage.drawText('CHASSI (VIN)', { x: MARGIN + colWidth + 12, y: colY, size: 7.5, font: fontBold, color: COLOR_MUTED_GRAY });
  currentPage.drawText(record.chassisVin || 'NÃO INFORMADO', {
    x: MARGIN + colWidth + 12,
    y: colY - 14,
    size: 10,
    font: fontMono,
    color: COLOR_BLACK
  });

  // Col 3: Técnico
  currentPage.drawText('TÉCNICO RESPONSÁVEL', { x: MARGIN + colWidth * 2 + 12, y: colY, size: 7.5, font: fontBold, color: COLOR_MUTED_GRAY });
  currentPage.drawText(record.technician || 'NÃO INFORMADO', {
    x: MARGIN + colWidth * 2 + 12,
    y: colY - 14,
    size: 9.5,
    font: fontRegular,
    color: COLOR_BLACK
  });

  // Col 4: Data do Reparo
  currentPage.drawText('DATA DO REPARO', { x: MARGIN + colWidth * 3 + 12, y: colY, size: 7.5, font: fontBold, color: COLOR_MUTED_GRAY });
  currentPage.drawText(formatDateBr(record.repairDate), {
    x: MARGIN + colWidth * 3 + 12,
    y: colY - 14,
    size: 10,
    font: fontBold,
    color: COLOR_BLACK
  });

  // Second row of metadata inside box
  const row2Y = colY - 34;
  currentPage.drawText(`Status: ${record.status === 'finalizado' ? 'Finalizado' : 'Em preenchimento'}`, {
    x: MARGIN + 12,
    y: row2Y,
    size: 8,
    font: fontRegular,
    color: COLOR_DARK_GRAY
  });
  currentPage.drawText(`Versão do Relatório: v${record.version || 1}`, {
    x: MARGIN + colWidth + 12,
    y: row2Y,
    size: 8,
    font: fontRegular,
    color: COLOR_DARK_GRAY
  });
  currentPage.drawText(`ID Interno: ${record.id}`, {
    x: MARGIN + colWidth * 2 + 12,
    y: row2Y,
    size: 7.5,
    font: fontMono,
    color: COLOR_MUTED_GRAY
  });
  currentPage.drawText(`Emissão: ${generationDateStr}`, {
    x: MARGIN + colWidth * 3 + 12,
    y: row2Y,
    size: 7.5,
    font: fontRegular,
    color: COLOR_MUTED_GRAY
  });

  y -= boxHeight + 18;

  // ==========================================
  // SEÇÃO 1: RELATÓRIO TÉCNICO
  // ==========================================
  currentPage.drawText('1. RELATÓRIO TÉCNICO E DIAGNÓSTICO', {
    x: MARGIN,
    y: y,
    size: 10,
    font: fontBold,
    color: COLOR_BLACK
  });
  y -= 4;
  currentPage.drawLine({
    start: { x: MARGIN, y },
    end: { x: MARGIN + CONTENT_WIDTH, y },
    thickness: 0.5,
    color: COLOR_BORDER
  });
  y -= 12;

  const reportText = record.technicalReport && record.technicalReport.trim() !== ''
    ? record.technicalReport
    : 'Nenhum detalhe técnico registrado no relatório.';

  const reportLines = wrapText(reportText, fontRegular, 9, CONTENT_WIDTH - 16);
  const lineHeight = 13;
  const padding = 8;
  const reportBlockHeight = Math.max(40, reportLines.length * lineHeight + padding * 2);

  // If report block fits on current page
  if (y - reportBlockHeight >= MARGIN + 40) {
    currentPage.drawRectangle({
      x: MARGIN,
      y: y - reportBlockHeight,
      width: CONTENT_WIDTH,
      height: reportBlockHeight,
      color: COLOR_LIGHT_BG,
      borderColor: COLOR_BORDER,
      borderWidth: 0.5
    });

    let lineY = y - padding - 8;
    for (const line of reportLines) {
      currentPage.drawText(line, {
        x: MARGIN + 8,
        y: lineY,
        size: 9,
        font: fontRegular,
        color: COLOR_DARK_GRAY
      });
      lineY -= lineHeight;
    }
    y -= reportBlockHeight + 16;
  } else {
    // Multi-line report spanning across pages if very long
    for (const line of reportLines) {
      ensureSpace(lineHeight + 6);
      currentPage.drawText(line, {
        x: MARGIN + 8,
        y,
        size: 9,
        font: fontRegular,
        color: COLOR_DARK_GRAY
      });
      y -= lineHeight;
    }
    y -= 14;
  }

  // ==========================================
  // SEÇÃO 2: VÍDEOS DE DIAGNÓSTICO
  // ==========================================
  ensureSpace(90);
  currentPage.drawText('2. VÍDEOS DE DIAGNÓSTICO', {
    x: MARGIN,
    y: y,
    size: 10,
    font: fontBold,
    color: COLOR_BLACK
  });
  y -= 4;
  currentPage.drawLine({
    start: { x: MARGIN, y },
    end: { x: MARGIN + CONTENT_WIDTH, y },
    thickness: 0.5,
    color: COLOR_BORDER
  });
  y -= 12;

  const videoFields: { key: 'video1' | 'video2'; label: string }[] = [
    { key: 'video1', label: 'Vídeo de Diagnóstico 1' },
    { key: 'video2', label: 'Vídeo de Diagnóstico 2' }
  ];

  const videoCardWidth = (CONTENT_WIDTH - 12) / 2;
  const videoCardHeight = 54;

  videoFields.forEach((vField, idx) => {
    const cardX = MARGIN + idx * (videoCardWidth + 12);
    const video = record.evidences[vField.key];

    currentPage.drawRectangle({
      x: cardX,
      y: y - videoCardHeight,
      width: videoCardWidth,
      height: videoCardHeight,
      color: COLOR_LIGHT_BG,
      borderColor: COLOR_BORDER,
      borderWidth: 0.5
    });

    currentPage.drawText(vField.label.toUpperCase(), {
      x: cardX + 10,
      y: y - 14,
      size: 8,
      font: fontBold,
      color: COLOR_BLACK
    });

    if (video) {
      currentPage.drawText(`Status: Anexado (${formatFileSize(video.fileSize)})`, {
        x: cardX + 10,
        y: y - 26,
        size: 8,
        font: fontRegular,
        color: COLOR_DARK_GRAY
      });
      currentPage.drawText(`Arquivo: ${video.fileName.length > 35 ? video.fileName.substring(0, 32) + '...' : video.fileName}`, {
        x: cardX + 10,
        y: y - 38,
        size: 7.5,
        font: fontMono,
        color: COLOR_MUTED_GRAY
      });
      currentPage.drawText('Disponível para reprodução e download no sistema.', {
        x: cardX + 10,
        y: y - 48,
        size: 6.5,
        font: fontRegular,
        color: COLOR_MUTED_GRAY
      });
    } else {
      currentPage.drawText('Status: Não anexado', {
        x: cardX + 10,
        y: y - 28,
        size: 8,
        font: fontRegular,
        color: COLOR_MUTED_GRAY
      });
      currentPage.drawText('Nenhum arquivo de vídeo registrado para este campo.', {
        x: cardX + 10,
        y: y - 42,
        size: 7,
        font: fontRegular,
        color: COLOR_MUTED_GRAY
      });
    }
  });

  y -= videoCardHeight + 16;

  // ==========================================
  // SEÇÃO 3: FOTOGRAFIAS DE DIAGNÓSTICO
  // ==========================================
  ensureSpace(60);
  currentPage.drawText('3. FOTOGRAFIAS DE DIAGNÓSTICO', {
    x: MARGIN,
    y: y,
    size: 10,
    font: fontBold,
    color: COLOR_BLACK
  });
  y -= 4;
  currentPage.drawLine({
    start: { x: MARGIN, y },
    end: { x: MARGIN + CONTENT_WIDTH, y },
    thickness: 0.5,
    color: COLOR_BORDER
  });
  y -= 14;

  const photoFields: { key: 'photo1' | 'photo2' | 'photo3' | 'photo4'; title: string }[] = [
    { key: 'photo1', title: 'Foto 1 - Visão Geral do Reparo' },
    { key: 'photo2', title: 'Foto 2 - Evidência Direta da Falha' },
    { key: 'photo3', title: 'Foto 3 - Detalhe / Macro da Avaria' },
    { key: 'photo4', title: 'Foto 4 - Contexto / Medição Adicional' }
  ];

  // We layout photos in pairs (2 per row)
  const photoCardWidth = (CONTENT_WIDTH - 12) / 2;
  const photoCardHeight = 160;

  for (let i = 0; i < photoFields.length; i += 2) {
    ensureSpace(photoCardHeight + 20);

    for (let j = 0; j < 2; j++) {
      const photoItem = photoFields[i + j];
      if (!photoItem) continue;

      const px = MARGIN + j * (photoCardWidth + 12);
      const photoData = record.evidences[photoItem.key];

      currentPage.drawRectangle({
        x: px,
        y: y - photoCardHeight,
        width: photoCardWidth,
        height: photoCardHeight,
        color: COLOR_LIGHT_BG,
        borderColor: COLOR_BORDER,
        borderWidth: 0.5
      });

      // Label Header
      currentPage.drawText(photoItem.title.toUpperCase(), {
        x: px + 8,
        y: y - 12,
        size: 7.5,
        font: fontBold,
        color: COLOR_BLACK
      });

      if (photoData && photoData.dataUrl) {
        // Embed image
        const imgBuffer = await convertDataUrlToPngBuffer(photoData.dataUrl);
        if (imgBuffer) {
          try {
            const embeddedImg = await pdfDoc.embedPng(imgBuffer);
            const imgBoxW = photoCardWidth - 16;
            const imgBoxH = photoCardHeight - 38;

            // Preserve aspect ratio
            const scale = Math.min(imgBoxW / embeddedImg.width, imgBoxH / embeddedImg.height);
            const renderW = embeddedImg.width * scale;
            const renderH = embeddedImg.height * scale;
            const renderX = px + 8 + (imgBoxW - renderW) / 2;
            const renderY = (y - photoCardHeight + 20) + (imgBoxH - renderH) / 2;

            currentPage.drawImage(embeddedImg, {
              x: renderX,
              y: renderY,
              width: renderW,
              height: renderH
            });
          } catch (e) {
            console.error('Failed to embed photo:', e);
            currentPage.drawText('Falha no processamento da imagem', {
              x: px + 12,
              y: y - 70,
              size: 8,
              font: fontRegular,
              color: COLOR_RED
            });
          }
        }

        // Subtitle with filename and size
        currentPage.drawText(`${photoData.fileName} · ${formatFileSize(photoData.fileSize)}`, {
          x: px + 8,
          y: y - photoCardHeight + 7,
          size: 6.5,
          font: fontMono,
          color: COLOR_MUTED_GRAY
        });
      } else {
        // Not attached placeholder
        currentPage.drawText('NÃO ANEXADO', {
          x: px + photoCardWidth / 2 - 30,
          y: y - photoCardHeight / 2,
          size: 9,
          font: fontBold,
          color: COLOR_MUTED_GRAY
        });
        currentPage.drawText('Nenhuma foto anexada para este campo.', {
          x: px + 10,
          y: y - photoCardHeight + 10,
          size: 7,
          font: fontRegular,
          color: COLOR_MUTED_GRAY
        });
      }
    }

    y -= photoCardHeight + 14;
  }

  // ==========================================
  // SEÇÃO 4: ETIQUETAS DAS PEÇAS (NOVA VS SUBSTITUÍDA)
  // ==========================================
  // Put Section 4 on a new page to guarantee full legibility and pristine presentation
  currentPage = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  pages.push(currentPage);
  y = PAGE_HEIGHT - MARGIN - 20;

  currentPage.drawText('4. EVIDÊNCIAS DE PEÇAS: NOVAS X SUBSTITUÍDAS (FOTOS E ETIQUETAS)', {
    x: MARGIN,
    y: y,
    size: 10,
    font: fontBold,
    color: COLOR_BLACK
  });
  y -= 4;
  currentPage.drawLine({
    start: { x: MARGIN, y },
    end: { x: MARGIN + CONTENT_WIDTH, y },
    thickness: 0.5,
    color: COLOR_BORDER
  });
  y -= 14;

  const partEvidenceGroups = [
    {
      groupTitle: 'A. PEÇA NOVA (PEÇA GENUÍNA DE REPOSIÇÃO)',
      items: [
        { key: 'newPartPhoto' as const, label: 'Foto da Peça Nova (Visão Geral)' },
        { key: 'newPartLabel1' as const, label: 'Etiqueta da Peça Nova 1 (Embalagem / P/N)' },
        { key: 'newPartLabel2' as const, label: 'Etiqueta da Peça Nova 2 (Gravação / QR Code)' }
      ]
    },
    {
      groupTitle: 'B. PEÇA SUBSTITUÍDA (PEÇA AVARIADA REMOVIDA)',
      items: [
        { key: 'replacedPartPhoto' as const, label: 'Foto da Peça Substituída (Visão Geral)' },
        { key: 'replacedPartLabel1' as const, label: 'Etiqueta da Peça Substituída 1 (P/N Visível)' },
        { key: 'replacedPartLabel2' as const, label: 'Etiqueta da Peça Substituída 2 (Série / Lote)' }
      ]
    }
  ];

  const partCardWidth = (CONTENT_WIDTH - 12) / 2;
  const partCardHeight = 185;

  for (const group of partEvidenceGroups) {
    ensureSpace(30);
    currentPage.drawText(group.groupTitle, {
      x: MARGIN,
      y: y,
      size: 8.5,
      font: fontBold,
      color: COLOR_DARK_GRAY
    });
    y -= 12;

    for (let i = 0; i < group.items.length; i += 2) {
      ensureSpace(partCardHeight + 16);

      for (let j = 0; j < 2; j++) {
        const item = group.items[i + j];
        if (!item) continue;

        const lx = MARGIN + j * (partCardWidth + 12);
        const partFile = record.evidences[item.key];

        currentPage.drawRectangle({
          x: lx,
          y: y - partCardHeight,
          width: partCardWidth,
          height: partCardHeight,
          color: COLOR_LIGHT_BG,
          borderColor: COLOR_BORDER,
          borderWidth: 0.5
        });

        // Header
        currentPage.drawText(item.label.toUpperCase(), {
          x: lx + 8,
          y: y - 12,
          size: 7.5,
          font: fontBold,
          color: COLOR_BLACK
        });

        if (partFile && partFile.dataUrl) {
          const imgBuffer = await convertDataUrlToPngBuffer(partFile.dataUrl);
          if (imgBuffer) {
            try {
              const embeddedImg = await pdfDoc.embedPng(imgBuffer);
              const imgBoxW = partCardWidth - 16;
              const imgBoxH = partCardHeight - 40;

              const scale = Math.min(imgBoxW / embeddedImg.width, imgBoxH / embeddedImg.height);
              const renderW = embeddedImg.width * scale;
              const renderH = embeddedImg.height * scale;
              const renderX = lx + 8 + (imgBoxW - renderW) / 2;
              const renderY = (y - partCardHeight + 20) + (imgBoxH - renderH) / 2;

              currentPage.drawImage(embeddedImg, {
                x: renderX,
                y: renderY,
                width: renderW,
                height: renderH
              });
            } catch (e) {
              console.error('Failed to embed part photo:', e);
              currentPage.drawText('Falha no processamento da imagem', {
                x: lx + 10,
                y: y - 80,
                size: 8,
                font: fontRegular,
                color: COLOR_RED
              });
            }
          }

          currentPage.drawText(`${partFile.fileName} · ${formatFileSize(partFile.fileSize)}`, {
            x: lx + 8,
            y: y - partCardHeight + 8,
            size: 6.5,
            font: fontMono,
            color: COLOR_MUTED_GRAY
          });
        } else {
          currentPage.drawText('NÃO ANEXADO', {
            x: lx + partCardWidth / 2 - 30,
            y: y - partCardHeight / 2,
            size: 9,
            font: fontBold,
            color: COLOR_MUTED_GRAY
          });
          currentPage.drawText('Nenhuma imagem registrada para este campo.', {
            x: lx + 10,
            y: y - partCardHeight + 10,
            size: 7,
            font: fontRegular,
            color: COLOR_MUTED_GRAY
          });
        }
      }

      y -= partCardHeight + 14;
    }

    y -= 10;
  }

  // ==========================================
  // RUNNING HEADERS & FOOTERS (ALL PAGES)
  // ==========================================
  const totalPages = pages.length;

  pages.forEach((page, index) => {
    const pageNum = index + 1;

    // Running Header for pages > 1
    if (pageNum > 1) {
      page.drawText(`OS: ${record.osNumber || '-'} · CHASSI: ${record.chassisVin || '-'} · RELATÓRIO DE GARANTIA`, {
        x: MARGIN,
        y: PAGE_HEIGHT - 22,
        size: 7,
        font: fontBold,
        color: COLOR_MUTED_GRAY
      });
      page.drawLine({
        start: { x: MARGIN, y: PAGE_HEIGHT - 26 },
        end: { x: MARGIN + CONTENT_WIDTH, y: PAGE_HEIGHT - 26 },
        thickness: 0.5,
        color: COLOR_BORDER
      });
    }

    // Running Footer (All pages)
    const footerY = 22;
    page.drawLine({
      start: { x: MARGIN, y: footerY + 10 },
      end: { x: MARGIN + CONTENT_WIDTH, y: footerY + 10 },
      thickness: 0.5,
      color: COLOR_BORDER
    });

    page.drawText(`OS: ${record.osNumber || '-'} | CHASSI: ${record.chassisVin || '-'} | VERSÃO: v${record.version || 1}`, {
      x: MARGIN,
      y: footerY,
      size: 7,
      font: fontMono,
      color: COLOR_MUTED_GRAY
    });

    page.drawText(`Página ${pageNum} de ${totalPages} · Gerado em ${generationDateStr}`, {
      x: MARGIN + CONTENT_WIDTH - 190,
      y: footerY,
      size: 7,
      font: fontRegular,
      color: COLOR_MUTED_GRAY
    });
  });

  return await pdfDoc.save();
}
