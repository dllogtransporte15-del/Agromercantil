/**
 * imageEnhancer.ts
 *
 * Utilitário executado antes do OCR e da exibição:
 * - Carrega a imagem em um HTMLCanvasElement off-screen.
 * - Auto-Contraste e Equalização de Histograma (percentis 3% e 95%, gamma 0.9).
 * - Nitidez e Realce de Contornos (Sharpening Convolution).
 * - Exporta em alta definição (image/jpeg, qualidade 0.92).
 */

export interface EnhancedImageResult {
  file: File;
  dataUrl: string;
  width: number;
  height: number;
}

/**
 * Converte um File, Blob ou DataURL em um HTMLImageElement carregado.
 */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(new Error(`Falha ao carregar imagem para aprimoramento: ${err}`));
    img.src = src;
  });
}

function fileToDataUrl(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve((e.target?.result as string) || '');
    reader.onerror = (e) => reject(e);
    reader.readAsDataURL(file);
  });
}

/**
 * Aplica auto-contraste com corte nos percentis 3% (preto) e 95% (branco) e correção gamma suave (0.9).
 */
function applyHistogramEqualizationAndContrast(
  imageData: ImageData,
  gamma: number = 0.9,
  pLow: number = 0.03,
  pHigh: number = 0.95
): ImageData {
  const data = imageData.data;
  const numPixels = data.length / 4;

  // 1. Calcula o histograma de luminância
  const hist = new Uint32Array(256);
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const lum = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
    hist[lum]++;
  }

  // 2. Encontra os limites dos percentis 3% e 95%
  const lowCount = Math.floor(numPixels * pLow);
  const highCount = Math.floor(numPixels * pHigh);

  let acc = 0;
  let minLum = 0;
  let maxLum = 255;

  for (let i = 0; i < 256; i++) {
    acc += hist[i];
    if (acc >= lowCount && minLum === 0) {
      minLum = i;
    }
    if (acc >= highCount) {
      maxLum = i;
      break;
    }
  }

  if (maxLum <= minLum) {
    maxLum = 255;
    minLum = 0;
  }

  const range = maxLum - minLum;
  const invGamma = 1.0 / gamma;

  // 3. Precalcula a tabela de lookup (LUT) para velocidade máxima
  const lut = new Uint8Array(256);
  for (let i = 0; i < 256; i++) {
    let norm = (i - minLum) / range;
    if (norm < 0) norm = 0;
    if (norm > 1) norm = 1;
    // Curva gamma
    const corrected = Math.pow(norm, invGamma);
    lut[i] = Math.min(255, Math.max(0, Math.round(corrected * 255)));
  }

  // 4. Aplica LUT a cada canal RGB
  for (let i = 0; i < data.length; i += 4) {
    data[i] = lut[data[i]];         // R
    data[i + 1] = lut[data[i + 1]]; // G
    data[i + 2] = lut[data[i + 2]]; // B
    // Alpha permanece intacto
  }

  return imageData;
}

/**
 * Aplica filtro de nitidez (Sharpening / High-Pass) para realçar anotações à caneta e letras impressas.
 */
function applySharpening(
  ctx: CanvasRenderingContext2D,
  imageData: ImageData,
  strength: number = 0.35
): ImageData {
  const w = imageData.width;
  const h = imageData.height;
  const src = imageData.data;
  const output = ctx.createImageData(w, h);
  const dst = output.data;

  // Copia bordas sem modificar
  dst.set(src);

  // Kernel de Sharpening suave:
  // [  0, -w/4,  0 ]
  // [ -w/4, 1 + w, -w/4 ]
  // [  0, -w/4,  0 ]
  const s4 = strength * 0.25;
  const centerWeight = 1 + strength;

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = (y * w + x) * 4;
      const top = ((y - 1) * w + x) * 4;
      const bottom = ((y + 1) * w + x) * 4;
      const left = (y * w + (x - 1)) * 4;
      const right = (y * w + (x + 1)) * 4;

      for (let c = 0; c < 3; c++) {
        const val =
          centerWeight * src[idx + c] -
          s4 * (src[top + c] + src[bottom + c] + src[left + c] + src[right + c]);
        dst[idx + c] = val < 0 ? 0 : val > 255 ? 255 : val;
      }
      dst[idx + 3] = src[idx + 3]; // Alpha
    }
  }

  return output;
}

/**
 * Função principal para aprimorar uma imagem de documento/roteiro em Canvas.
 * Retorna o arquivo aprimorado e o dataUrl para visualização em alta fidelidade.
 */
export async function enhanceDocumentImage(
  input: File | Blob | string,
  fileName: string = 'documento_aprimorado.jpg'
): Promise<EnhancedImageResult> {
  const srcUrl = typeof input === 'string' ? input : await fileToDataUrl(input);
  const img = await loadImage(srcUrl);

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  if (!ctx) {
    throw new Error('Não foi possível obter contexto 2D do Canvas para processar imagem.');
  }

  // Define dimensões (com limite máximo de 2800px para não estourar memória em dispositivos móveis)
  const maxDim = 2800;
  let targetWidth = img.naturalWidth || img.width;
  let targetHeight = img.naturalHeight || img.height;

  if (targetWidth > maxDim || targetHeight > maxDim) {
    if (targetWidth > targetHeight) {
      targetHeight = Math.round((targetHeight * maxDim) / targetWidth);
      targetWidth = maxDim;
    } else {
      targetWidth = Math.round((targetWidth * maxDim) / targetHeight);
      targetHeight = maxDim;
    }
  }

  canvas.width = targetWidth;
  canvas.height = targetHeight;

  // Desenha no canvas
  ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

  // 1. Obtém os pixels brutos
  let imgData = ctx.getImageData(0, 0, targetWidth, targetHeight);

  // 2. Aplica Auto-Contraste e Equalização de Histograma (elimina sombras acinzentadas)
  imgData = applyHistogramEqualizationAndContrast(imgData, 0.9, 0.03, 0.95);

  // 3. Aplica Sharpening para destacar letras e anotações à caneta
  imgData = applySharpening(ctx, imgData, 0.4);

  // Coloca de volta no Canvas
  ctx.putImageData(imgData, 0, 0);

  // 4. Exporta em alta definição JPEG 0.92
  const enhancedDataUrl = canvas.toDataURL('image/jpeg', 0.92);

  // Converte dataUrl em File
  const byteString = atob(enhancedDataUrl.split(',')[1]);
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }
  const blob = new Blob([ab], { type: 'image/jpeg' });
  const enhancedFile = new File([blob], fileName.endsWith('.jpg') || fileName.endsWith('.jpeg') ? fileName : `${fileName}.jpg`, {
    type: 'image/jpeg',
    lastModified: Date.now()
  });

  return {
    file: enhancedFile,
    dataUrl: enhancedDataUrl,
    width: targetWidth,
    height: targetHeight
  };
}
