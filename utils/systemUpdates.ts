export interface UpdateItem {
  title: string;
  description: string;
  category: 'feature' | 'improvement' | 'fix' | 'security';
  icon?: string;
}

export interface SystemRelease {
  id: string;
  version: string;
  date: string;
  title: string;
  summary: string;
  items: UpdateItem[];
}

/**
 * Registro de versões e atualizações do sistema Agromercantil.
 * Sempre que subir uma nova atualização ou commit com novidades,
 * incremente a versão ou adicione um novo registro no topo da lista.
 */
export const SYSTEM_RELEASES: SystemRelease[] = [
  {
    id: 'rel_2026_09_23_v2_7_3',
    version: 'v2.7.3',
    date: '23/09/2026',
    title: 'Duplicação Rápida de Ordens de Carga',
    summary: 'Nova funcionalidade que permite duplicar qualquer ordem de carga existente para criar uma nova carga baseada nela, com todos os dados de cliente, rotas, valores por tonelada, regras de pedágio, ICMS, tipos de veículos e anexos pré-preenchidos.',
    items: [
      {
        category: 'feature',
        title: 'Ação de Duplicar Carga no Menu de Operações',
        description: 'Adicionada a opção "Duplicar Carga" no menu de ações rápidas da tabela de cargas e no modal de detalhes da carga.'
      },
      {
        category: 'feature',
        title: 'Pré-preenchimento Inteligente e Sequenciamento Automático',
        description: 'Ao duplicar, o formulário é carregado com as rotas, cliente, produto, valores de frete empresa/motorista e regras da carga de origem, gerando um novo número sequencial limpo (sem volumes herdados).'
      },
      {
        category: 'improvement',
        title: 'Identificação Visual do Modo Duplicação',
        description: 'Identificação visual clara no formulário com badge "Nova Carga Duplicada" e banner explicativo indicando a carga base utilizada.'
      },
      {
        category: 'improvement',
        title: 'Ajuste no Prompt Fretebras',
        description: 'Configuração do texto copiado do Prompt Fretebras para constar sempre "VALOR: A combinar" e "FORMA DE PAGAMENTO: Pix, Outro*".'
      },
      {
        category: 'improvement',
        title: 'Novo Padrão de Divulgação de Cargas',
        description: 'Estruturação do texto copiado em "Divulgar Cargas" com linha dedicada para o produto, valores separados PJ e PF por tonelada (com pedágio quando houver), tipos de carroceria e links de coleta/entrega.'
      }
    ]
  },
  {
    id: 'rel_2026_09_19_v2_7_2',
    version: 'v2.7.2',
    date: '19/09/2026',
    title: 'Cotações por Tonelada e Painel das Últimas 5 Cotações',
    summary: 'Aprimoramentos no Simulador de Frete e Histórico Operacional: exibição destacada do valor por tonelada e novo painel com as últimas 5 cotações salvas integrado na coluna lateral de fechamento, com carregamento ágil no simulador.',
    items: [
      {
        category: 'feature',
        title: 'Cálculo de Incidência de ICMS nas Cotações',
        description: 'Adicionada opção para declarar incidência de ICMS com alíquota personalizada na cotação de frete, calculando automaticamente a dedução tributária, frete líquido da empresa e margem operacional real.'
      },
      {
        category: 'feature',
        title: 'Painel das Últimas 5 Cotações Salvas',
        description: 'Exibição direta das últimas 5 cotações realizadas abaixo do Fechamento no simulador, permitindo recarregar os dados na tela com um único clique ou navegar para o histórico completo.'
      },
      {
        category: 'improvement',
        title: 'Valor por Tonelada em Destaque Principal',
        description: 'Os cards de cotações no histórico operacional e no simulador agora apresentam o valor unitário por tonelada no cabeçalho e na performance financeira.'
      },
      {
        category: 'improvement',
        title: 'Aproveitamento das Margens Laterais e Expansão Horizontal',
        description: 'Ampliado em 15% o espaçamento útil horizontal das janelas de Parâmetros, Mapa e Fechamento no simulador de cotações, eliminando margens vazias e melhorando a visualização de dados.'
      },
      {
        category: 'fix',
        title: 'Tratamento Robusto na Formatação Monetária',
        description: 'Sanitização contra valores nulos e indefinidos, prevenindo a exibição de NaN em campos de custo.'
      },
      {
        category: 'fix',
        title: 'Resiliência no Salvamento de Cotações com Schema Adaptativo',
        description: 'Implementado tratamento para compatibilidade com PostgREST e eliminação automática de campos não migrados no banco, garantindo que o salvamento nunca falhe.'
      }
    ]
  },
  {
    id: 'rel_2026_09_17_v2_7_1',
    version: 'v2.7.1',
    date: '17/09/2026',
    title: 'Ajuste de Preenchimento Total da Tela de Login',
    summary: 'Configuração aprimorada de layout e plano de fundo da tela de login para preencher 100% da tela em qualquer resolução e proporção, eliminando áreas em branco na parte inferior.',
    items: [
      {
        category: 'improvement',
        title: 'Fundo Full-Screen sem Espaços em Branco',
        description: 'Eliminada a restrição de escala que gerava faixas em branco na base da tela de login; o gradiente verde floresta e a malha quadriculada agora cobrem toda a área visível de forma consistente.'
      },
      {
        category: 'fix',
        title: 'Estabilização de Cores de Fundo do HTML/Body',
        description: 'Garantida a persistência da cor temática de fundo nos elementos raiz durante a exibição do portal de acesso.'
      }
    ]
  },
  {
    id: 'rel_2026_09_17_v2_7_0',
    version: 'v2.7.0',
    date: '17/09/2026',
    title: 'Estabilização no Salvamento de Cotações no Histórico',
    summary: 'Aprimoramento completo no mecanismo de gravação e tratamento de erros das cotações de frete, com compatibilidade de formato de identificador (UUID/texto), recuperação automática contra colunas ausentes e fluxo seguro para cadastro de clientes rápidos.',
    items: [
      {
        category: 'fix',
        title: 'Gravação de Cotações com Tratamento de Erros Resiliente',
        description: 'Implementado tratamento para compatibilidade de tipos de UUID e fallback automático de persistência, evitando falhas de comunicação com o banco.'
      },
      {
        category: 'improvement',
        title: 'Isolamento no Cadastro de Clientes da Cotação',
        description: 'O salvamento de histórico de cotação não é mais interrompido caso ocorra oscilação no cadastro prévio de clientes.'
      }
    ]
  },
  {
    id: 'rel_2026_09_17_v2_6_9',
    version: 'v2.6.9',
    date: '17/09/2026',
    title: 'Ajuste de Contraste e Visualização nos Custos Base da Rota',
    summary: 'Correção nos campos de Piso Mínimo ANTT e Valor do Pedágio na calculadora de frete, garantindo legibilidade perfeita e alto contraste tanto no modo claro quanto no modo escuro.',
    items: [
      {
        category: 'fix',
        title: 'Contraste e Legibilidade de Campos de Custo',
        description: 'Ajustadas as cores de fundo e texto dos inputs de Piso Mínimo ANTT e Valor do Pedágio para visualização nítida no tema claro e escuro.'
      }
    ]
  },
  {
    id: 'rel_2026_09_17_v2_6_8',
    version: 'v2.6.8',
    date: '17/09/2026',
    title: 'Correção no Salvamento de Cotações e Clientes da Calculadora',
    summary: 'Correção na persistência de cotações de frete e clientes da calculadora no banco de dados para usuários com identificadores personalizados (USR-xxx).',
    items: [
      {
        category: 'fix',
        title: 'Persistência de Cotações',
        description: 'Compatibilização de identificadores de usuários (UUID/alfanumérico) no salvamento e consulta do histórico de cotações.'
      },
      {
        category: 'fix',
        title: 'Cadastro de Clientes de Cotação',
        description: 'Tratamento de inserção e busca de clientes vinculados à calculadora sem dependência de constraint exclusiva de conflito.'
      }
    ]
  },
  {
    id: 'rel_2026_09_16_v2_6_7',
    version: 'v2.6.7',
    date: '16/09/2026',
    title: 'Desativação de PWA e Otimização Web Direta',
    summary: 'Remoção completa dos componentes e serviços de PWA (Service Worker, manifesto e prompts de instalação), tornando a plataforma 100% web direta, ágil e livre de interferências de cache local.',
    items: [
      {
        category: 'improvement',
        title: 'Arquitetura Web Direta',
        description: 'Remoção do vite-plugin-pwa, ReloadPrompt e service workers, garantindo carregamento limpo e atualizado em tempo real.'
      },
      {
        category: 'improvement',
        title: 'Interface de Acesso Simplificada',
        description: 'Remoção dos botões e avisos de instalação de PWA na tela de login e no painel de controle do sistema.'
      }
    ]
  },
  {
    id: 'rel_2026_09_16_v2_6_6',
    version: 'v2.6.6',
    date: '16/09/2026',
    title: 'Padronização e Nomenclaturas Corporativas',
    summary: 'Implementação do plano de padronização corporativa refinado em toda a plataforma: navegação de módulos, pipeline de status operacionais, gestão de demandas de carga e botões de ação (CTAs), com preservação rigorosa dos termos operacionais fundamentais.',
    items: [
      {
        category: 'feature',
        title: 'Navegação e Menus Otimizados',
        description: 'Atualização do menu superior e lateral para títulos corporativos concisos (Gestão Operacional, Cadastros, Relatórios, Módulos & Utilit., Configurações) com espaçamento perfeito em qualquer resolução.'
      },
      {
        category: 'improvement',
        title: 'Pipeline de Status Operacionais Refinado',
        description: 'Status visuais padronizados com clareza executiva: Triagem / Pré-Cadastro, Análise de Risco (PGR), Aguardando Check-in / Carga, Emissão Fiscal (CT-e / NF-e), Liberação de Adiantamento, Agendamento de Descarga (Slot), Em Trânsito / Aguardando Descarga, Liquidação de Saldo e Operação Concluída.'
      },
      {
        category: 'improvement',
        title: 'Gestão de Demandas e Ordens de Carga',
        description: 'Adequação dos tipos de demanda para "Demanda Contínua", "Cota Diária Programada" e "Demanda Sob Consulta", novo fluxo de "Remanejar Carga" e exibição de "Volume Total Contratado".'
      },
      {
        category: 'improvement',
        title: 'Ações e Botões (CTAs) Padronizados',
        description: 'Botões operacionais atualizados para "Cadastrar Nova Carga", "Importação em Lote de Cargas", "Processar Cotação", "Salvar Alterações / Confirmar Registro" e "Inativar Registro / Remover".'
      }
    ]
  },
  {
    id: 'rel_2026_09_16_v2_6_5',
    version: 'v2.6.5',
    date: '16/09/2026',
    title: 'Tema Escuro Verde Floresta Agro & Novo Slogan "Soluções Inteligentes para o Agro"',
    summary: 'Refinamento do tema escuro de azul/marinho para tons profundos de verde floresta agro (#04150e / #061e13) e atualização do slogan oficial na tela de login.',
    items: [
      {
        category: 'feature',
        title: 'Fundo Escuro Verde Floresta Profunda',
        description: 'Substituição das tonalidades azuis/marinho por verde agro profundo (#04150e e #061e13), trazendo atmosfera autêntica do agronegócio para todo o sistema e portal do motorista.'
      },
      {
        category: 'improvement',
        title: 'Slogan Atualizado na Tela de Login',
        description: 'Frase de impacto atualizada para "Soluções Inteligentes para o Agro.", com tipografia em gradiente esmeralda e dourado.'
      }
    ]
  },
  {
    id: 'rel_2026_09_16_v2_6_4',
    version: 'v2.6.4',
    date: '16/09/2026',
    title: 'Nova Identidade Visual Agromercantil & Design Glassmorphism da Tela de Login em Todo o Sistema',
    summary: 'Adoção da paleta de cores oficial da marca Agromercantil (Verde Esmeralda e Ouro Âmbar) e replicação da estética dark glassmorphism futurista da tela de login em todas as telas internas.',
    items: [
      {
        category: 'feature',
        title: 'Paleta Oficial da Logo Agromercantil',
        description: 'Atualização das cores primárias e de destaque para Verde Agro (#16A34A), Dourado/Âmbar (#F59E0B) e fundo dark obsidian (#060A14), harmonizados com a marca.'
      },
      {
        category: 'improvement',
        title: 'Design da Tela de Login Replicado no Sistema',
        description: 'Barras de navegação superior, menu lateral (Sidebar), cartões com efeito de vidro translúcido, iluminação radial ambiente e bordas iluminadas agora integrados em toda a plataforma.'
      },
      {
        category: 'improvement',
        title: 'Portal do Motorista & Documentos Atualizados',
        description: 'Interface de oportunidades de frete para motoristas, relatórios em PDF e ordens de carregamento com design e cores sincronizados.'
      }
    ]
  },
  {
    id: 'rel_2026_09_16_v2_6_3',
    version: 'v2.6.3',
    date: '16/09/2026',
    title: 'Adequação Completa da Identidade e Nomenclatura para Agromercantil Logística',
    summary: 'Personalização e adequação integral da identidade visual, manifestos, portais e relatórios para o ecossistema Agromercantil.',
    items: [
      {
        category: 'improvement',
        title: 'Identidade e Branding Agromercantil',
        description: 'Telas de login, monitoramento, relatórios operacionais, manifesto PWA e portais de motorista ajustados para a marca Agromercantil.'
      },
      {
        category: 'feature',
        title: 'Gerador de Documentos e PDFs Atualizado',
        description: 'Ordens de carregamento e relatórios de auditoria agora emitem cabeçalhos e termos de responsabilidade sob a titularidade da Agromercantil Logística.'
      },
      {
        category: 'security',
        title: 'Ponto de Restauração Integrado',
        description: 'Rotinas automáticas de backup de código e banco de dados criadas para assegurar a integridade total dos dados.'
      }
    ]
  },
  {
    id: 'rel_2026_09_16_v2_6_2',
    version: 'v2.6.2',
    date: '16/09/2026',
    title: 'Persistência de Documentos Fiscais (CT-e, MDF-e, Carta Frete) e Proteção contra Perda em Reversões',
    summary: 'Correção crítica na preservação de anexos e números fiscais durante trocas de status, avanços concorrentes e reversões de etapas, garantindo que nenhum documento seja perdido.',
    items: [
      {
        category: 'fix',
        title: 'Proteção de Anexos em Reversão de Status',
        description: 'Corrigida a lógica de reversão de etapas para limpar exclusivamente os anexos da etapa cancelada, preservando integralmente os documentos já anexados nas etapas anteriores (CT-e, MDF-e, Carta Frete, etc.).'
      },
      {
        category: 'fix',
        title: 'Sincronização Segura de Documentos Fiscais',
        description: 'Ao anexar comprovantes em etapas subsequentes (ex: adiantamento ou descarga), o sistema agora mescla com o registro mais recente do banco de dados, prevenindo perda de CT-e ou anexos inseridos simultaneamente por outro usuário.'
      },
      {
        category: 'improvement',
        title: 'Restauração Automática de Dados Fiscais',
        description: 'Implementado fallback inteligente para resolução automática do número e data de emissão do CT-e a partir dos anexos gravados, garantindo exibição instantânea no painel e nos relatórios.'
      }
    ]
  },
  {
    id: 'rel_2026_09_16_v2_6_1',
    version: 'v2.6.1',
    date: '16/09/2026',
    title: 'Correção no Cálculo de Saldo para Fretes PJ (ETC)',
    summary: 'Ajustada a regra de apuração do saldo de frete para transportadores e empresas (PJ / ETC), impedindo a dedução indevida de tributos exclusivos de motoristas autônomos (PF / TAC).',
    items: [
      {
        category: 'fix',
        title: 'Cálculo de Saldo de Frete PJ / ETC',
        description: 'Corrigida a identificação de frete PJ na rotina de cálculo de adiantamento e saldo, garantindo que o saldo contratual integral seja preservado sem deduções de INSS/SEST/SENAT de autônomo (ex: embarque FEL-458 atualizado de R$ 2.635,00 para R$ 2.895,60).'
      },
      {
        category: 'improvement',
        title: 'Adiantamento 100% em Fretes TAC (Pessoa Física)',
        description: 'Em embarques com 100% de adiantamento para autônomos (TAC), as retenções de INSS, SEST/SENAT e IRRF são aplicadas diretamente no adiantamento em conta, zerando o saldo e finalizando o embarque diretamente após a etapa de descarga, sem retenção em "Ag. Saldo".'
      }
    ]
  },
  {
    id: 'rel_2026_09_16_v2_6_0',
    version: 'v2.6.0',
    date: '16/09/2026',
    title: 'Histórico Automático de Motoristas, Gestão de Ordens e Validação de Cadastros',
    summary: 'Preenchimento automático inteligente do histórico do motorista em novos embarques, separação de ordens do app vs. fretes, permissões para Gerenciadora de Risco e correções no app.',
    items: [
      {
        category: 'feature',
        title: 'Preenchimento Automático do Histórico de Motoristas',
        description: 'Ao selecionar ou buscar o motorista em Novo Embarque, o sistema localiza o histórico recente e preenche automaticamente placas (cavalo e carretas), documentos, proprietário, ANTT e dados cadastrais.'
      },
      {
        category: 'feature',
        title: 'Separação de Ordens de Motoristas vs. Fretes de Clientes',
        description: 'Notificações e Dashboard agora possuem listas e modais específicos para solicitações do App do Motorista e Ofertas de Clientes, garantindo persistência da solicitação e histórico de recusas.'
      },
      {
        category: 'security',
        title: 'Avanço de Cadastro para Gerenciadora de Risco',
        description: 'O perfil Gerenciadora de Risco agora tem permissão para editar informações e acionar "Salvar e Avançar" diretamente na etapa de Ag. Cadastro.'
      },
      {
        category: 'fix',
        title: 'Correção no Cadastro de Motoristas no App',
        description: 'Eliminado erro de chave duplicada no cadastro do aplicativo, integrando CPFs pré-cadastrados com segurança e IDs exclusivos anti-colisão.'
      },
      {
        category: 'improvement',
        title: 'Motoristas Indicados em Cargas em Andamento',
        description: 'Ação de Motoristas Indicados por DDD e histórico de rotas agora é exclusiva das operações ativas em Operacional > Cargas.'
      }
    ]
  },
  {
    id: 'rel_2026_09_14_v2_5_0',
    version: 'v2.5.0',
    date: '14/09/2026',
    title: 'Visualizador de Acessos, Espelhamento de Usuários, Período e Filtros de CT-e',
    summary: 'Novo visualizador de acessos em subjanela flutuante para administradores, espelhamento de permissões, novos filtros de período e visualização de CT-e em relatórios.',
    items: [
      {
        category: 'feature',
        title: 'Subjanela Flutuante de Acessos em Tempo Real (Admin)',
        description: 'Administradores agora contam com o botão "Acessos" para abrir uma subjanela flutuante sobreposta que espelha exatamente a visão do usuário em tempo real em modo estrito de somente leitura.'
      },
      {
        category: 'feature',
        title: 'Espelhar Acesso de Outro Usuário',
        description: 'Opção de replicar com um clique todo o perfil de permissões e módulos de um usuário existente no cadastro e edição de colaboradores.'
      },
      {
        category: 'feature',
        title: 'Filtro de Período e Atalhos nos Relatórios',
        description: 'Adicionado filtro de período com Data de Início e Data Final no Relatório de Outros, com atalhos de 1 clique (Hoje, Este Mês, Mês Anterior, Últimos 30 dias, Ano Atual).'
      },
      {
        category: 'improvement',
        title: 'Visualização e Filtro por Nº CT-e em Custos Extras',
        description: 'Inclusão da coluna de Nº CT-e na tabela de Custos Extras e Prejuízos Operacionais, exportação em PDF e campo de filtro específico por CT-e.'
      },
      {
        category: 'security',
        title: 'Isolamento de Créditos de Exportação para Agenciadores',
        description: 'Ocultação de créditos fiscais e dados tributários de exportação nos relatórios e painéis para usuários com perfil de Agenciador.'
      }
    ]
  },
  {
    id: 'rel_2026_09_13_v2_4_0',
    version: 'v2.4.0',
    date: '13/09/2026',
    title: 'Atualização de Conformidade ANTT, Agenciamento e Ofertas',
    summary: 'Melhorias nos fluxos de validação de CNPJ da Receita Federal, isolamento do relatório comercial para agenciadores e filtros de ofertas de frete.',
    items: [
      {
        category: 'security',
        title: 'ANTT & Regime Tributário (ETC) 100% Automatizado',
        description: 'Bloqueada a seleção manual do regime tributário de Pessoa Jurídica (ETC). O regime é agora identificado exclusivamente via consulta direta na base oficial da Receita Federal pelo CNPJ.'
      },
      {
        category: 'feature',
        title: 'Relatório Comercial para Agenciadores',
        description: 'Liberada a visualização do Relatório Comercial para o perfil Agenciador, com painel exclusivo e restrito ao faturamento, lucro real e comissões da sua própria agência e equipe vinculada.'
      },
      {
        category: 'improvement',
        title: 'Separação de Ofertas de Frete vs. Solicitações de Ordem',
        description: 'O Histórico de Ofertas de Frete agora lista exclusivamente as ofertas de clientes, separando com precisão as solicitações de carregamento enviadas pelo aplicativo dos motoristas.'
      },
      {
        category: 'feature',
        title: 'Timeline de Etapas em Tempo Real',
        description: 'Embarcadores e Agenciadores agora possuem acesso completo à barra de progresso e timeline em tempo real com o detalhamento de cada etapa e saldo real da carga.'
      },
      {
        category: 'improvement',
        title: 'Otimização das Cargas em Operação',
        description: 'Cargas com status "Sem Programação" e "Suspensas" são ocultadas da listagem principal de operação para focar nos carregamentos ativos.'
      }
    ]
  },
  {
    id: 'rel_2026_09_12_v2_3_0',
    version: 'v2.3.0',
    date: '12/09/2026',
    title: 'Automação de Custos de CTE, Margem e Rastreamento',
    summary: 'Aprimoramento do cálculo de lucro real com abatimento de GR, ICMS, comissões de agenciamento e painel de automação de CTE.',
    items: [
      {
        category: 'feature',
        title: 'Painel de Automação de Custos de CTE',
        description: 'Cálculo dinâmico e automatizado de taxas operacionais, impostos e comissões por faixa de faturamento.'
      },
      {
        category: 'improvement',
        title: 'Controle de Estadias e Saldos Operacionais',
        description: 'Cálculo de margem real em tempo real considerando estadias aprovadas e descontos de quebra.'
      }
    ]
  }
];

export const LATEST_SYSTEM_RELEASE = SYSTEM_RELEASES[0];

const STORAGE_PREFIX = 'agromercantil_seen_update_';
const LEGACY_STORAGE_PREFIX = 'transcunha_seen_update_';

/**
 * Verifica se o modal de novidades deve ser exibido para o usuário.
 * Retorna true apenas no primeiro acesso após uma nova atualização.
 */
export const shouldShowUpdateModal = (userId?: string): boolean => {
  if (!userId) return false;
  try {
    const key = `${STORAGE_PREFIX}${userId}`;
    const legacyKey = `${LEGACY_STORAGE_PREFIX}${userId}`;
    const lastSeenId = localStorage.getItem(key) || localStorage.getItem(legacyKey);
    return lastSeenId !== LATEST_SYSTEM_RELEASE.id;
  } catch {
    return false;
  }
};

/**
 * Marca a versão atual como visualizada pelo usuário para não reabrir automaticamente.
 */
export const markUpdateAsSeen = (userId?: string, releaseId: string = LATEST_SYSTEM_RELEASE.id): void => {
  if (!userId) return;
  try {
    const key = `${STORAGE_PREFIX}${userId}`;
    localStorage.setItem(key, releaseId);
  } catch (err) {
    console.warn('Erro ao salvar status de visualização de atualização:', err);
  }
};
