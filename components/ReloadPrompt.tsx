import React from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

export function ReloadPrompt() {
  useRegisterSW({
    onRegistered(r: any) {
      // Verifica se há atualizações a cada 1 minuto (60000 ms)
      if (r) {
        setInterval(() => {
          r.update();
        }, 60 * 1000);
      }
    },
    onRegisterError(error: any) {
      console.log('SW registration error', error);
    },
  });

  return null;
}
