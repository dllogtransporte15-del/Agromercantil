# Instruções e Diretrizes do Projeto Agromercantil

## 1. Atualizações e Resumos de Versão (Changelog do Sistema)
- **Sempre que subir novas alterações, funcionalidades ou commits no projeto**, você deve atualizar o arquivo [`utils/systemUpdates.ts`](file:///c:/Users/davis/Documents/Agromercantil/utils/systemUpdates.ts).
- Adicione uma nova entrada no topo da lista `SYSTEM_RELEASES` contendo:
  - `id`: no formato `rel_YYYY_MM_DD_vX_Y_Z`
  - `version`: versão incrementada (ex: `v2.6.4`)
  - `date`: data atual (`DD/MM/AAAA`)
  - `title`: resumo das entregas
  - `summary`: explicação geral
  - `items`: itens detalhados com categoria (`feature`, `improvement`, `security`, `fix`), título e descrição clara.
- Isso alimenta automaticamente o modal "O que há de novo no Agromercantil Logística?" exibido no primeiro acesso de cada usuário.
