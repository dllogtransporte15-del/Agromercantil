# Regra de Atualização do Resumo do Sistema (Changelog / O Que Há de Novo)

Sempre que novas funcionalidades, melhorias, regras de negócio ou correções forem desenvolvidas e preparadas para entrega/commit no projeto **Transcunha Logística**:

1. **Atualização Obrigatória do `utils/systemUpdates.ts`**:
   - Adicionar um novo objeto no topo do array `SYSTEM_RELEASES`.
   - Gerar um `id` exclusivo no padrão `rel_YYYY_MM_DD_vX_Y_Z`.
   - Incrementar o número da versão (`version`), por exemplo `v2.6.0`, `v2.6.1`, etc.
   - Informar a data atual no formato `DD/MM/AAAA`.
   - Definir um `title` impactante e um `summary` explicativo das novidades.
   - Listar os `items` detalhados com título, descrição e respectiva categoria (`feature`, `improvement`, `security` ou `fix`).

2. **Exibição Automática para os Usuários**:
   - Como o componente `SystemUpdateModal` monitora o `LATEST_SYSTEM_RELEASE.id`, ao atualizar este arquivo todos os usuários logados visualizarão o modal de novidades no primeiro acesso após a subida do commit.
