/**
 * Utilitário para aprimoramento automático de documentos fotográficos e digitalizados.
 * Aumenta a nitidez, ajusta o contraste e ilumina o fundo sem alterar o conteúdo.
 */

export function enhanceDocumentImage(imageSource: File | string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d', { willReadFrequently: true });

        if (!ctx) {
          resolve(typeof imageSource === 'string' ? imageSource : URL.createObjectURL(imageSource));
          return;
        }

        // Limita o tamanho máximo para preservar velocidade e clareza (ex: max 2400px)
        let width = img.naturalWidth || img.width;
        let height = img.naturalHeight || img.height;
        const maxDim = 2400;

        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        canvas.width = width;
        canvas.height = height;

        // Desenha a imagem original no canvas
        ctx.drawImage(img, 0, 0, width, height);

        const imgData = ctx.getImageData(0, 0, width, height);
        const data = imgData.data;
        const totalPixels = width * height;

        // 1. Amostrar luminância para calcular percentis de contraste (min 2%, max 98%)
        const hist = new Uint32Array(256);
        const step = Math.max(1, Math.floor(totalPixels / 50000)); // amostragem rápida

        for (let i = 0; i < data.length; i += 4 * step) {
          // Luminância padrão Rec. 709
          const lum = Math.round(0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]);
          hist[lum]++;
        }

        let sampledCount = 0;
        for (let i = 0; i < 256; i++) sampledCount += hist[i];

        const lowCut = sampledCount * 0.03;
        const highCut = sampledCount * 0.95;

        let minLum = 0;
        let maxLum = 255;
        let cum = 0;

        for (let i = 0; i < 256; i++) {
          cum += hist[i];
          if (cum >= lowCut && minLum === 0) minLum = i;
          if (cum >= highCut) {
            maxLum = i;
            break;
          }
        }

        if (maxLum <= minLum) {
          minLum = 0;
          maxLum = 255;
        }

        // Tabela de mapeamento para contraste otimizado (curva S suave e clareamento de fundo)
        const range = maxLum - minLum;
        const lut = new Uint8Array(256);

        for (let i = 0; i < 256; i++) {
          if (i <= minLum) {
            lut[i] = 0;
          } else if (i >= maxLum) {
            lut[i] = 255;
          } else {
            // Estiramento linear com suave realce de texto escuro
            const norm = (i - minLum) / range;
            const enhanced = Math.pow(norm, 0.9); // Leve gamma para clarear sombras de papel
            lut[i] = Math.min(255, Math.max(0, Math.round(enhanced * 255)));
          }
        }

        // 2. Aplicar estiramento de contraste em cada canal RGB
        for (let i = 0; i < data.length; i += 4) {
          data[i] = lut[data[i]];         // Red
          data[i + 1] = lut[data[i + 1]]; // Green
          data[i + 2] = lut[data[i + 2]]; // Blue
        }

        ctx.putImageData(imgData, 0, 0);

        // 3. Exporta imagem aprimorada em alta resolução
        const enhancedDataUrl = canvas.toDataURL('image/jpeg', 0.92);
        resolve(enhancedDataUrl);
      } catch (err) {
        console.warn('Falha no aprimoramento de imagem, usando original:', err);
        resolve(typeof imageSource === 'string' ? imageSource : URL.createObjectURL(imageSource));
      }
    };

    img.onerror = (err) => {
      console.warn('Erro ao carregar imagem para aprimoramento:', err);
      resolve(typeof imageSource === 'string' ? imageSource : URL.createObjectURL(imageSource));
    };

    if (typeof imageSource === 'string') {
      img.src = imageSource;
    } else {
      const reader = new FileReader();
      reader.onload = () => {
        img.src = reader.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(imageSource);
    }
  });
}
