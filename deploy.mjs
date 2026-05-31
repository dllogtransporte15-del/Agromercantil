import { execSync } from 'child_process';

try {
  console.log('Adicionando arquivos ao Git...');
  execSync('git add .', { stdio: 'inherit' });

  console.log('Realizando o commit...');
  // Pega a data e hora atual para o nome do commit
  const date = new Date().toLocaleString('pt-BR');
  execSync(`git commit -m "Deploy automático: ${date}"`, { stdio: 'inherit' });

  console.log('Enviando para o GitHub (o que aciona a Vercel automaticamente)...');
  execSync('git push', { stdio: 'inherit' });

  console.log('✅ Deploy enviado com sucesso! A Vercel iniciará o build automaticamente.');
} catch (error) {
  // Ignora erros se não houver nada para commitar
  if (error.message && error.message.includes('nothing to commit')) {
    console.log('✅ Nenhuma alteração nova para enviar.');
  } else {
    console.error('❌ Erro durante o deploy:', error.message);
  }
}
