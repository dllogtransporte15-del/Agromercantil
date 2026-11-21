// Dados e Estruturas do Manual Profissional do Embarcador — DLLOG Transportes Academy
// Estruturado em 2 Fases:
// - Fase 1: Operação Logística & Embarque Prático (Módulos 00 a 06)
// - Fase 2: Domínio Tributário do Zero, Créditos Fiscais & Reforma Tributária no Transporte (Módulos 07 a 12)

export type CoursePhaseNumber = 1 | 2;

export interface CoursePhaseInfo {
  phase: CoursePhaseNumber;
  title: string;
  shortTitle: string;
  subtitle: string;
  badge: string;
  description: string;
}

export const COURSE_PHASES: Record<CoursePhaseNumber, CoursePhaseInfo> = {
  1: {
    phase: 1,
    title: 'Fase 1: Operação Logística & Embarque Prático',
    shortTitle: 'Fase 1 • Operação & Embarque',
    subtitle: 'Do zero à gestão avançada de veículos, programação de cargas, gerenciamento de risco e fretes ANTT',
    badge: 'Módulos 00 a 06 • Base Operacional',
    description: 'Domine a rotina diária do embarcador no agronegócio: captação de motoristas, dimensionamento de carretas e pesos de balança, aprovação de gerenciamento de risco (GR), emissão de ordens e regras financeiras da ANTT.'
  },
  2: {
    phase: 2,
    title: 'Fase 2: Tributação do Zero, Créditos Fiscais & Reforma Tributária',
    shortTitle: 'Fase 2 • Tributos & Reforma',
    subtitle: 'Aprenda todos os impostos atuais para iniciantes, créditos e benefícios fiscais de transportadoras e o novo IVA Dual (CBS/IBS) até 2033',
    badge: 'Módulos 07 a 12 • Especialização Fiscal (E-book Revisado)',
    description: 'Trilha completa e personalizada para iniciantes baseada no e-book "Reforma Tributária no Setor de Transportes (Planning)", 100% revisada e auditada conforme a EC 132/2023 e LC 214/2025, com módulo profundo sobre créditos e benefícios fiscais de transportadoras hoje e pós-reforma.'
  }
};

export interface CourseChapter {
  id: string;
  phase: CoursePhaseNumber;
  number: string;
  title: string;
  subtitle: string;
  category: 'fundamentos' | 'operacional' | 'veiculos' | 'risco' | 'fiscal' | 'financeiro' | 'tributario' | 'reforma' | 'creditos';
  readTime: string;
  audioDuration: string;
  summary: string;
  audioScript: string[];
  sections: {
    title: string;
    content: string[];
    tips?: string[];
    warning?: string;
    auditNote?: string;
    table?: {
      headers: string[];
      rows: string[][];
    };
  }[];
}

export const COURSE_CHAPTERS: CourseChapter[] = [
  // ============================================================================
  // FASE 1: OPERAÇÃO LOGÍSTICA & EMBARQUE PRÁTICO (MÓDULOS 00 A 06)
  // ============================================================================
  {
    id: 'apresentacao',
    phase: 1,
    number: '00',
    title: 'Apresentação & O Papel do Embarcador',
    subtitle: 'A importância da logística no agronegócio e a função do embarcador',
    category: 'fundamentos',
    readTime: '4 min',
    audioDuration: '3 min',
    summary: 'Compreenda a relevância da logística no agronegócio brasileiro, por que produtores e indústrias terceirizam o frete e como o embarcador atua como ponte entre clientes, transportadora e motoristas.',
    audioScript: [
      'Seja muito bem-vindo à Academia DLLOG Transportes! Esta é a aula inaugural da Fase 1 do nosso Curso para Embarcador.',
      'Nesta primeira aula, vamos entender o coração do nosso negócio: por que a logística é tão vital no agronegócio brasileiro e qual é exatamente o seu papel como embarcador.',
      'Imagine um grande produtor de soja ou uma indústria de fertilizantes. Mesmo tendo muito dinheiro, para eles não compensa comprar centenas de caminhões próprios, porque a safra tem picos e baixas, e manter caminhão parado custa uma fortuna.',
      'É aí que entra a transportadora! O cliente terceiriza o transporte conosco para que assumamos toda a operação: encontrar o caminhão certo, auditar o risco do motorista, emitir os documentos fiscais e garantir que a carga chegue em segurança.',
      'E quem faz essa engrenagem girar na prática? O Embarcador! Você é a ponte entre três pontas: a Transportadora, o Cliente e o Motorista.',
      'Grave este exemplo prático de margem comercial: se o cliente nos contrata para levar 220 toneladas de soja de Uberlândia até o Porto de Santos pagando 200 reais por tonelada, e você negocia com motoristas de Rodotrem a 180 reais por tonelada, nós precisamos de 5 viagens de Rodotrem e geramos uma margem bruta de 20 reais por tonelada, ou seja, 10% de resultado operacional. Essa é a essência comercial do embarcador!'
    ],
    sections: [
      {
        title: 'A Importância da Logística no Agronegócio',
        content: [
          'No agronegócio, a logística é indispensável para garantir que as safras, insumos e fertilizantes cheguem ao destino sem perdas e dentro dos prazos da cadeia produtiva.',
          'Muitas empresas (cerealistas, traders, produtores rurais e indústrias), mesmo tendo capacidade financeira, optam por NÃO manter frota própria, pois o custo de manutenção, ociosidade e gestão de risco é inviável.',
          'Ao terceirizar com a transportadora, o produtor foca no cultivo e comercialização, enquanto a transportadora assume o gerenciamento de risco, alocação de motoristas, emissão fiscal e seguro.'
        ],
        tips: [
          'O agronegócio não para: janelas de colheita exigem agilidade extrema na colocação de caminhões.',
          'A reputação da transportadora é construída pela pontualidade e segurança que o embarcador entrega.'
        ]
      },
      {
        title: 'O que faz o Embarcador na Prática?',
        content: [
          'O embarcador é o profissional responsável por "vender o frete" e garantir a execução da viagem.',
          'Quando o cliente solicita o transporte, a transportadora distribui essas demandas para a equipe de embarcadores.',
          'O embarcador atua captando motoristas qualificados através de redes de contatos, grupos especializados de WhatsApp e plataformas como Fretebras.',
          'Relação Tripartite: o embarcador é o elo de comunicação contínuo entre Transportadora ⇄ Motoristas ⇄ Clientes.'
        ]
      },
      {
        title: 'Exemplo Prático de Demanda & Margem Comercial',
        content: [
          'Exemplo Real: O embarcador recebe uma demanda para transportar 220 toneladas de soja de um armazém em Uberlândia (MG) até o Porto de Santos (SP).',
          'Veículo escolhido: Rodotrem com capacidade líquida de ≈ 48 a 50 toneladas por viagem.',
          'Cálculo de Viagens: 220t ÷ 48t = 4,58 → São necessários 5 carregamentos de Rodotrem.',
          'Spread Comercial (Margem): O cliente paga R$ 200,00 por tonelada. O embarcador negocia com o motorista a R$ 180,00 por tonelada.',
          'Resultado: Margem bruta da transportadora = R$ 20,00/tonelada (10% de margem operacional).'
        ],
        tips: [
          'A margem padrão de mercado no agronegócio varia geralmente entre 7% e 12%, dependendo da rota, retorno e prazo de pagamento.'
        ]
      }
    ]
  },
  {
    id: 'programacao',
    phase: 1,
    number: '01',
    title: 'Programação de Cargas & Janelas',
    subtitle: 'Cadência de carregamento, diagramas e agendas de descarga',
    category: 'operacional',
    readTime: '5 min',
    audioDuration: '3 min',
    summary: 'Aprenda a organizar a cadência de carregamento diário, respeitar prazos contratuais de embarque e monitorar a agenda de descarga para prevenir estadias custosas.',
    audioScript: [
      'Bem-vindo ao Módulo 01 da Fase 1: Programação de Cargas e Janelas Operacionais.',
      'Um erro muito comum de quem está começando na logística é achar que basta mandar todos os caminhões de uma vez para o armazém. Na prática, isso gera caos!',
      'Todo armazém tem uma cadência diária, que chamamos de cota de carregamento. Se a fazenda ou armazém só consegue carregar 4 caminhões por dia e você envia 10 no mesmo dia, 6 motoristas vão ficar parados na fila.',
      'Além da origem, você precisa olhar sempre para o destino, especialmente quando falamos de portos como Santos e Paranaguá ou grandes esmagadoras de grãos.',
      'Se o caminhão chegar lá sem janela de descarga agendada ou se o terminal estiver travado, o caminhão fica retido além do tempo limite legal, gerando o custo de Estadia. Portanto, regra de ouro: confira diariamente o saldo no painel da DLLOG Transportes e nunca embarque um veículo sem confirmar que a janela de descarga está aberta e confirmada!'
    ],
    sections: [
      {
        title: 'Diagrama da Transportadora e Alocação',
        content: [
          'A programação de cargas envolve organizar detalhadamente todas as cargas contratadas, garantindo que tudo ocorra dentro dos prazos contratuais.',
          'É essencial consultar o diagrama operacional do sistema (DLLOG Transportes) para checar o saldo restante da carga, peso já carregado e quantos veículos faltam para fechar o lote.',
          'Cadência de Carregamento: Se um armazém tem cota de carregar apenas 4 caminhões por dia, enviar 10 caminhões de uma só vez gera fila, insatisfação e congestionamento.'
        ]
      },
      {
        title: 'Monitoramento de Descarga & Prevenção de Estadias',
        content: [
          'O cliente estabelece um período máximo para a entrega da carga no destino.',
          'É dever do embarcador checar a situação do ponto de descarga (especialmente em portos como Santos, Paranaguá ou grandes esmagadoras).',
          'Se o agendamento de descarga estiver fechado ou houver filas quilométricas, o veículo fica parado além do prazo legal (estadia), gerando custos indenizatórios adicionais ao contratante.'
        ],
        warning: 'Nunca envie veículos sem confirmar se a agenda de recebimento no cliente destinatário está ativa e confirmada.'
      }
    ]
  },
  {
    id: 'veiculos',
    phase: 1,
    number: '02',
    title: 'Captação, Tipos de Veículos e Pesos',
    subtitle: 'Tabela de PBT, tara, capacidade líquida e regras de balança',
    category: 'veiculos',
    readTime: '8 min',
    audioDuration: '4 min',
    summary: 'Guia completo com todas as combinações de veículos de carga (LS, Bitrem, Rodotrem), capacidades líquidas, tolerância de 5% da ANTT e veículos indicados por tipo de produto.',
    audioScript: [
      'Olá! Estamos no Módulo 02 da Fase 1: Captação, Tipos de Veículos e Pesos de Balança.',
      'Como embarcador, você precisa dominar na ponta da língua três conceitos de peso: Tara, que é o peso do caminhão vazio; Carga Líquida, que é o peso da mercadoria que vai em cima; e PBT, que é o Peso Bruto Total somando caminhão mais mercadoria.',
      'Vamos memorizar os principais conjuntos do agronegócio: A Carreta Simples Trucada de 3 eixos tem PBT de 48,5 toneladas e leva cerca de 32 toneladas líquidas. Já a Carreta LS de 4 eixos, muito popular hoje, tem PBT de 58,5 toneladas e carrega cerca de 40 toneladas líquidas.',
      'O Bitrem de 7 eixos tem PBT de 57 toneladas e leva entre 37 e 38 toneladas líquidas no graneleiro, ou 35 a 36 toneladas se for Bicaçamba, pois a caçamba de aço é mais pesada.',
      'E o gigante das estradas, o Rodotrem de 9 eixos, tem PBT máximo de 74 toneladas, levando de 48,5 a 50 toneladas de carga líquida! Mas cuidado: se o armazém tiver balança curta, menor que 25 metros, o Rodotrem alongado precisa desengatar o dolly para pesar em duas etapas.',
      'Lembre-se também da tolerância da ANTT: as balanças rodoviárias permitem até 5% de tolerância sobre o PBT sem aplicar multa!'
    ],
    sections: [
      {
        title: 'Critérios Essenciais para Seleção do Veículo',
        content: [
          '1. Compatibilidade com o Produto: Grãos requerem graneleiro ou caçamba; fertilizante a granel exige caçamba para descarga basculante; fertilizante ensacado ou big bag exige carroceria graneleira para amarração.',
          '2. Restrições Físicas no Destino: Muitos armazéns e balanças possuem limite de comprimento de plataforma (ex: balanças de 18 a 21 metros). Um Rodotrem alongado (25 a 30 metros) não cabe na balança e precisará desengatar para pesar 2 vezes, atrasando a operação.',
          '3. Raio de Manobra: Rotas com pontes baixas ou acessos de terra estreitos podem impedir veículos articulados longos.'
        ]
      },
      {
        title: 'Tabela Oficial de Pesos Médios e Capacidades (Agronegócio)',
        content: [
          'Confira abaixo os parâmetros operacionais de peso bruto total (PBT), tara média e carga líquida útil utilizados nas operações rodoviárias:'
        ],
        table: {
          headers: ['Tipo de Conjunto', 'Soma de Eixos (Balança)', 'Tara Estimada', 'Carga Líquida Útil', 'PBT Permitido', 'Observação Técnica'],
          rows: [
            ['Caminhão Truck 6x2 (3 Eixos Rígido)', '6t + 17t', '≈ 8,5 t', '≈ 14,5 t', '23,0 t', 'Monobloco de 14,0m sem articulação'],
            ['Cavalo Toco (4x2) + Carreta 2 Eixos', '6t + 10t + 17t', '≈ 13,0 t', '≈ 20,0 t', '33,0 t', '4 eixos totais (18,60m)'],
            ['Cavalo Toco (4x2) + Carreta LS 3 Eixos', '6t + 10t + 25,5t', '≈ 15,5 t', '≈ 26,0 t', '41,5 t', '5 eixos totais; carreta com 3 eixos juntos'],
            ['Cavalo Toco (4x2) + Carreta Vanderleia', '6t + 10t + 10t + 10t + 10t', '≈ 16,5 t', '≈ 29,5 t', '46,0 t', '3 eixos da carreta espaçados (10t cada)'],
            ['Cavalo Trucado (6x2) + Carreta LS 3 Eixos', '6t + 17t + 25,5t', '≈ 16,5 t', '≈ 32,0 t', '48,5 t', 'Se Caçamba, carga líquida fica em 28–30 t'],
            ['Cavalo Trucado + Carreta LS 4 Eixos', '6t + 17t + 35,5t', '≈ 18,5 t', '≈ 40,0 t', '58,5 t', '1 carreta de 4 eixos; alta eficiência no agro'],
            ['Bitrem 7 Eixos (Quinta-Roda)', '6t + 17t + 17t + 17t', '≈ 20,0 t', '≈ 37,5 t', '57,0 t', '2ª carreta acoplada na quinta-roda da 1ª'],
            ['Bitrem 9 Eixos (Quinta-Roda • 2x 3 Eixos)', '6t + 17t + 25,5t + 25,5t', '≈ 24,5 t', '≈ 49,5 t', '74,0 t', 'Duas carretas de 3 eixos via quinta-roda'],
            ['Rodotrem 9 Eixos Graneleiro (com Dolly)', '6t + 17t + 17t + 17t + 17t', '≈ 24,0 t', '≈ 49,5 t', '74,0 t', 'Unido por Dolly de 2 eixos (19,8m a 30m)'],
            ['Rodocaçamba 9 Eixos Basculante (com Dolly)', '6t + 17t + 17t + 17t + 17t', '≈ 26,5 t', '≈ 47,5 t', '74,0 t', 'Indispensável para calcário e fertilizante granel']
          ]
        },
        tips: [
          'Regra de Tolerância de Balança: A legislação da ANTT/CONTRAN prevê tolerância de até 5% sobre o Peso Bruto Total (PBT). Exemplo: 58,5 t + 5% (2,925 t) = até 61,425 t sem multa.'
        ]
      },
      {
        title: 'Matriz de Veículo Recomendado por Produto',
        content: [
          'Grãos (Soja, Milho, Trigo, Sorgo): Graneleiro ou Caçamba (ambos aceitos; graneleiro é mais seguro contra tombamento).',
          'Fertilizante a Granel: Caçamba (Basculante) obrigatória pela facilidade de descarga em moegas industriais.',
          'Fertilizante Ensacado: Graneleiro obrigatório para garantir acomodação do palete e amarração correta.',
          'Fertilizante em Big Bag: Graneleiro, pela necessidade de assoalho plano e pontos de amarração das cintas.',
          'Minérios (Calcário, Gesso, Brita, Ferro): Caçamba (Basculante) obrigatória por ser carga densa que requer basculamento.',
          'Algodão em Fardos: Graneleiro (alguns clientes aceitam caçamba alta, verificar sempre com o cliente).'
        ]
      }
    ]
  },
  {
    id: 'risco',
    phase: 1,
    number: '03',
    title: 'Cadastro & Gerenciamento de Risco',
    subtitle: 'Checklist documental, checagens de GR e aprovação de apólice',
    category: 'risco',
    readTime: '7 min',
    audioDuration: '3.5 min',
    summary: 'Aprenda o passo a passo da checagem cadastral do motorista e veículo, consultas em gerenciadoras de risco (Buonny, Opentech, Pamcary) e a regra de ouro do seguro de transporte.',
    audioScript: [
      'Atenção total agora no Módulo 03 da Fase 1: Cadastro e Gerenciamento de Risco, o famoso GR.',
      'Se existe uma regra que nunca, sob nenhuma hipótese, pode ser quebrada em uma transportadora, é esta: nenhum caminhão entra para carregar sem a aprovação formal da Gerenciadora de Risco!',
      'Por que isso é tão sério? Uma carga de soja, defensivo ou fertilizante vale centenas de milhares de reais. Se acontecer um acidente, tombamento ou roubo de carga e o motorista não estiver com a consulta de risco aprovada e dentro da validade antes do carregamento, a companhia seguradora nega a indenização e o prejuízo recai sobre a transportadora.',
      'Para aprovar o cadastro rápido, recolha sempre a documentação completa: CNH válida categoria C, D ou E, documentos CRLV do cavalo mecânico e de todas as carretas, além do registro ANTT, o RNTRC ativo.',
      'A gerenciadora faz validação facial, checa antecedentes e emite o protocolo de liberação. Só com esse protocolo aprovado em mãos é que você autoriza o embarque!'
    ],
    sections: [
      {
        title: 'Checklist do Cadastro do Motorista e Veículo',
        content: [
          'Dados do Motorista: Nome completo, CPF, RG/Órgão expedidor, endereço com CEP, telefone para contato, número da CNH, categoria da CNH (C, D ou E) e validade.',
          'Dados do Cavalo Mecânico: Placa, Renavam, Chassi, Ano, Marca/Modelo, Cor, Tipo de tração (4x2, 6x2, 6x4), Proprietário e RNTRC do proprietário.',
          'Dados das Carretas: Placa de todas as carretas (no bitrem são 2, no rodotrem 2 + dolly), Renavam, ano, tipo de implemento e capacidade em toneladas.',
          'RNTRC (Registro Nacional de Transportadores Rodoviários de Carga): Obrigatório estar ativo e válido (TAC - Autônomo, ETC - Empresa ou CTC - Cooperativa).'
        ]
      },
      {
        title: 'Como Funciona a Análise de Risco (GR)',
        content: [
          '1. Validação de Identidade: Reconhecimento facial (selfie cruzada com CNH), videochamada com o motorista ou biometria para evitar clonagem de identidade.',
          '2. Validação Documental: Conferência de CNH válida e compatível, CRLV do veículo regular e sem bloqueio, RNTRC em dia.',
          '3. Checagem de Antecedentes e Histórico: Pesquisa de ocorrências criminais, roubo de carga, apropriação indébita e referências comerciais em transportadoras anteriores.',
          '4. Retorno da Gerenciadora: A gerenciadora emite laudo oficial: APROVADO, PENDENTE ou REPROVADO.'
        ],
        warning: 'REGRA INVIOLÁVEL: Nenhum motorista pode carregar sem análise de risco APROVADA. Caso o veículo carregue sem aprovação do GR, a seguradora NÃO indenizará nenhum sinistro (roubo, tombamento ou avaria)!'
      },
      {
        title: 'Gerenciadora Própria vs Terceirizada',
        content: [
          'Gerenciadora Própria: A transportadora mantém equipe interna de analistas com ferramentas e bancos de dados próprios.',
          'Gerenciadora Terceirizada: Contratação de empresas especializadas (Buonny, Skymark, Opentech, Pamcary). Mais ágil e com respaldo técnico homologado pelas grandes seguradoras do país.'
        ]
      }
    ]
  },
  {
    id: 'ordem',
    phase: 1,
    number: '04',
    title: 'Ordem de Carregamento: Interna x Externa',
    subtitle: 'Hierarquia operacional obrigatória e envio ao ponto de carga',
    category: 'operacional',
    readTime: '5 min',
    audioDuration: '3 min',
    summary: 'Entenda a diferença crucial entre a ordem interna no sistema da transportadora e a ordem externa nos portais dos clientes, evitando falhas contratuais graves.',
    audioScript: [
      'Vamos ao Módulo 04 da Fase 1: Ordem de Carregamento Interna versus Ordem Externa.',
      'Você sabe qual é a sequência exata para liberar um motorista sem passar vergonha com o cliente? Sempre siga estes quatro passos na ordem: Primeiro, Cadastro completo; Segundo, Aprovação do Gerenciamento de Risco; Terceiro, emissão da Ordem Interna no sistema da DLLOG Transportes; e Quarto, emissão da Ordem Externa no portal do cliente.',
      'Jamais inverta essa ordem! Se você cadastrar um motorista primeiro lá no portal externo da Bunge, Cargill ou Amaggi, e minutos depois o nosso gerenciamento de risco reprovar o motorista, pedir cancelamento de placa no portal do cliente gera desgaste comercial e trava a vaga da transportadora.',
      'Portanto, aprove o risco, gere a Ordem Interna no nosso sistema e só então registre a Ordem Externa para o motorista apresentar na portaria do armazém.'
    ],
    sections: [
      {
        title: 'Ordem Interna: O Ponto de Partida',
        content: [
          'A Ordem Interna é o documento formal gerado dentro do sistema da DLLOG Transportes após a aprovação de risco do motorista.',
          'Contém os dados do embarque: ID da ordem, motorista, placas, produto, armazém de origem, fazenda/usina, destino e quantidade contratada.',
          'Serve como comprovação interna auditável e autorização oficial para que a operação prossiga.'
        ]
      },
      {
        title: 'Ordem Externa: Portais de Clientes e WhatsApp',
        content: [
          'A Ordem Externa é gerada fora da transportadora, diretamente no portal do cliente (ex: portais de trades, Bunge, Cargill, Amaggi, LDC, ADM) ou sistemas integrados.',
          'Regra de Ouro da DLLOG Transportes: NUNCA emita a ordem externa antes da ordem interna e da aprovação do risco.',
          'Motivo: Se você cadastrar o motorista no portal do cliente e ele for reprovado no risco da seguradora, o cancelamento no portal do cliente é burocrático e abala a credibilidade da transportadora.'
        ],
        tips: [
          'Sequência Correta: 1. Cadastro → 2. Aprovação de Risco → 3. Ordem Interna no Sistema → 4. Ordem Externa no Portal do Cliente.'
        ]
      }
    ]
  },
  {
    id: 'fiscal',
    phase: 1,
    number: '05',
    title: 'Documentação Fiscal & Viagem',
    subtitle: 'CT-e, MDF-e, CIOT, Vale-Pedágio e Nota Fiscal Trocada',
    category: 'fiscal',
    readTime: '7 min',
    audioDuration: '4 min',
    summary: 'Domine todos os documentos obrigatórios para circulação nas rodovias: CT-e, MDF-e, regras de CIOT, Vale-Pedágio eletrônico e a diferença entre NF primária e trocada.',
    audioScript: [
      'Chegamos ao Módulo 05 da Fase 1: Documentação Fiscal e de Viagem.',
      'Depois que o caminhão entra na balança, carrega a soja ou o fertilizante e tira o Ticket de Pesagem e o Laudo de Classificação de Grãos, começa a etapa de documentação fiscal.',
      'Preste muita atenção na diferença entre Nota Fiscal Primária e Nota Fiscal Trocada: no agronegócio, muitas vezes o produtor rural emite uma nota para uma trading, e a trading emite uma segunda nota vendendo para a indústria ou porto. Essa segunda nota é a Nota Trocada, e o nosso CT-e deve sempre referenciar a Nota Fiscal Trocada que vai acompanhar a viagem!',
      'Para o caminhão sair para a rodovia, cinco itens são obrigatórios: Primeiro, o CT-e, que é o Conhecimento de Transporte Eletrônico autorizado pela SEFAZ; Segundo, o MDF-e, que é o Manifesto Eletrônico que vincula as placas do caminhão às notas e ao CT-e para fiscalização de barreira; Terceiro, o CIOT, código obrigatório da ANTT quando contratamos motorista autônomo; Quarto, o Vale-Pedágio Obrigatório antecipado fora do valor do frete; e Quinto, a averbação eletrônica do seguro de carga!'
    ],
    sections: [
      {
        title: 'Ticket de Carregamento & Classificação de Grãos',
        content: [
          'Ticket de Carregamento: Primeiro comprovante emitido pela balança de origem contendo Peso Bruto, Tara e Peso Líquido transportado. É a base para emitir a NF e o CT-e.',
          'Classificação de Grãos: Laudo técnico emitido na origem avaliando umidade (padrão até 14%), impurezas (padrão até 1%), grãos ardidos e quebrados. Evita contestações de avaria no destino.'
        ]
      },
      {
        title: 'Nota Fiscal Primária x Nota Fiscal Trocada',
        content: [
          'Nota Fiscal Primária: Emitida pelo vendedor original (produtor rural ou cooperativa). O cliente contratante é o próprio destinatário da carga.',
          'Nota Fiscal Trocada: Prática comum em revenda de grãos. Uma trade compra do produtor e revende para uma indústria. A trade emite uma nova NF de venda para o comprador final.',
          'Regra para CT-e: Quando houver revenda, o CT-e DEVE ser emitido tendo como base a Nota Fiscal trocada!'
        ]
      },
      {
        title: 'Documentos Obrigatórios de Viagem',
        content: [
          '1. CT-e (Conhecimento de Transporte Eletrônico): Formaliza a prestação do frete entre transportadora e tomador. É autorizado pela SEFAZ antes da saída do caminhão.',
          '2. MDF-e (Manifesto Eletrônico): Agrupa os CT-es e notas fiscais da viagem. O motorista deve portar o DAMDFE impresso ou digital para apresentar nas barreiras fiscais.',
          '3. CIOT (Código Identificador da Operação de Transporte): Registro obrigatório na ANTT para pagamento de motoristas terceiros/autônomos (TAC).',
          '4. Vale-Pedágio Obrigatório (Lei 10.209/2001): É proibido descontar pedágio do motorista. O valor deve ser antecipado via cartão de pedágio eletrônico homologado pela ANTT.',
          '5. Seguro de Carga (RCTR-C / RC-DC): Apólice averbada eletronicamente antes do início da viagem.'
        ]
      }
    ]
  },
  {
    id: 'financeiro',
    phase: 1,
    number: '06',
    title: 'Pagamento de Frete, Regras ANTT & Quebras',
    subtitle: 'Normas ANTT, cartão frete, adiantamento x saldo e descontos por quebra',
    category: 'financeiro',
    readTime: '6 min',
    audioDuration: '3.5 min',
    summary: 'Conheça a legislação da ANTT sobre pagamento eletrônico de frete, modelos de adiantamento (70/30, 80/20) e as regras para apuração de quebra e descontos na descarga.',
    audioScript: [
      'Encerramos a Fase 1 com o Módulo 06: Pagamento de Frete, Regras da ANTT e Quebras de Carga.',
      'Como funciona o pagamento ao motorista? Pela regulamentação da ANTT, é proibido pagar frete em dinheiro vivo. O pagamento deve ser eletrônico e rastreável, vinculado ao titular do RNTRC no documento.',
      'No mercado do agronegócio, trabalhamos com o sistema de Adiantamento mais Saldo. O modelo mais comum é o 70 barra 30: liberamos 70% de adiantamento assim que o motorista carrega e sai com o CT-e e MDF-e emitidos, para que ele custeie o diesel da viagem. Os 30% restantes são o Saldo, que só é pago após a descarga no destino e a conferência do ticket de pesagem final e canhoto assinado.',
      'E por que seguramos esses 20% ou 30% de saldo? Por segurança contra a Quebra de Carga! Toda viagem de grãos tem uma pequena tolerância técnica contratual, geralmente de 0,25% da carga, por perda natural de umidade. Mas se faltar mercadoria acima dessa tolerância, o valor do produto faltante é descontado diretamente do saldo do motorista. Com isso concluímos a Fase 1 operacional e estamos prontos para mergulhar na Fase 2 sobre Tributos e Reforma Tributária!'
    ],
    sections: [
      {
        title: 'Regras da ANTT para Pagamento de Frete',
        content: [
          'É terminantemente proibido o pagamento de frete em dinheiro vivo (espécie) a motoristas autônomos.',
          'O pagamento deve ser feito por meio de meios eletrônicos homologados pela ANTT (Cartão de Frete Eletrônico, conta corrente vinculada com comprovante em nome do titular do RNTRC).',
          'O descumprimento gera multas pesadas tanto para a transportadora quanto para o contratante.'
        ]
      },
      {
        title: 'Políticas Comuns de Pagamento (Adiantamento x Saldo)',
        content: [
          'Modelo 70% / 30% (Mais Comum): 70% pago no momento da saída (comprovante de abastecimento/viagem) e 30% quitado após a descarga mediante envio do canhoto e ticket assinado.',
          'Modelo 80% / 20%: Frequente em rotas de fertilizantes e grãos de média distância.',
          'Modelo 90% / 10%: Aplicado a motoristas fidelizados e cadastrados na frota cativa.'
        ]
      },
      {
        title: 'Responsabilidade por Diferença na Entrega (Quebra de Carga)',
        content: [
          'O motorista é responsável pela integridade e volume da carga transportada.',
          'Tolerância de Quebra: Algumas operações preveem quebra técnica natural de rota (ex: 0,25% a 0,5% por desidratação).',
          'Diferença Acima da Tolerância: Se faltar mercadoria no destino além da tolerância, o valor da tonelada faltante é descontado diretamente do saldo de frete do motorista.',
          'Exemplo: Se faltou 1.000 kg de soja avaliada a R$ 1.200,00/tonelada, R$ 1.200,00 serão abatidos do saldo final do motorista.'
        ]
      }
    ]
  },

  // ============================================================================
  // FASE 2: TRIBUTAÇÃO DO ZERO, CRÉDITOS FISCAIS & REFORMA TRIBUTÁRIA (MÓDULOS 07 A 12)
  // ============================================================================
  {
    id: 'tributos-iniciante',
    phase: 2,
    number: '07',
    title: 'Guia de Tributos para Iniciantes: Todos os Impostos do Zero',
    subtitle: 'Aprenda de forma simples o que é ICMS, ISS, PIS, COFINS, IPI, IRPJ, CSLL e retenções do motorista autônomo',
    category: 'tributario',
    readTime: '9 min',
    audioDuration: '5 min',
    summary: 'Nunca estudou contabilidade ou impostos? Este módulo traduz todas as siglas fiscais do Brasil para a linguagem prática do embarcador, explicando quando cada tributo incide no frete e por que o sistema atual virou um quebra-cabeça.',
    audioScript: [
      'Seja muito bem-vindo à Fase 2 do nosso curso! A partir de agora, vamos transformar você em um especialista nos tributos do setor de transportes, começando do zero absoluto, sem palavras difíceis.',
      'Sabe quando você olha para um CT-e ou uma cotação de frete e vê siglas como ICMS, PIS, COFINS, ISS, SEST SENAT? Muita gente trabalha anos em transportadora sem entender o que cada uma significa. Vamos descomplicar tudo agora!',
      'No Brasil atual, temos cinco tributos principais sobre o consumo e os serviços, divididos entre três governos diferentes: o Governo Federal cobra o PIS, a COFINS e o IPI; os Governos Estaduais cobram o ICMS; e as Prefeituras Municipais cobram o ISS.',
      'Para o embarcador, a primeira regra de ouro é saber quando um frete paga ICMS e quando paga ISS. É super simples: se o caminhão coleta a carga em uma cidade e entrega na mesma cidade, chamamos de transporte intramunicipal, e o imposto é o ISS da prefeitura, que varia de 2% a 5%. Agora, se o caminhão sai de uma cidade e vai para outra cidade, seja no mesmo estado ou em outro estado, o imposto é o ICMS estadual!',
      'Além do ICMS ou ISS, toda transportadora paga PIS e COFINS para o Governo Federal sobre o seu faturamento. Se a transportadora for do Lucro Presumido, ela paga 3,65% de PIS e COFINS somados, sem direito a descontar créditos. Se ela for do Lucro Real, como as grandes transportadoras do agronegócio, a alíquota é de 9,25%, mas ela pode abater créditos sobre o diesel, pneus e peças comprados!',
      'E quando você contrata um caminhoneiro autônomo, pessoa física? A lei obriga a transportadora a reter na fonte o INSS do motorista, que equivale a 2,2% do valor total do frete, mais o SEST SENAT, que equivale a 0,5% do frete. Viu como ficou claro? Agora você já domina todas as siglas do sistema atual!'
    ],
    sections: [
      {
        title: 'Por que precisamos entender os Tributos no Transporte?',
        content: [
          'Se você está começando agora, pense nos tributos como uma fatia do valor do frete que o governo recolhe em cada viagem. Quando um embarcador fecha um frete de R$ 200,00 por tonelada com o cliente e paga R$ 180,00 ao motorista, aqueles R$ 20,00 de diferença NÃO são lucro limpo: dali saem os impostos do frete!',
          'Como destaca o e-book da Reforma Tributária (página 02), o sistema tributário brasileiro atual se tornou um verdadeiro "quebra-cabeças": temos impostos cobrados sobre outros impostos (efeito cascata), tributação na origem que gera a chamada "guerra fiscal" entre estados, e dezenas de alíquotas diferentes que confundem empresas e consumidores.',
          'Para entender para onde o Brasil está indo com a Reforma Tributária, primeiro precisamos conhecer de forma simples quem são os tributos atuais.'
        ],
        tips: [
          'Para o Iniciante: Você não precisa decorar leis inteiras! Basta saber quem cobra cada imposto (União, Estado ou Município) e quando ele aparece na operação de transporte.'
        ]
      },
      {
        title: 'Os 5 Tributos Atuais sobre Consumo e Frete (Explicados Sem "Economês")',
        content: [
          '1. ICMS (Imposto sobre Circulação de Mercadorias e Serviços — ESTADUAL): É o imposto mais famoso das estradas! Incide sempre que o caminhão faz um frete INTERMUNICIPAL (de uma cidade para outra dentro do mesmo estado) ou INTERESTADUAL (de um estado para outro, ex: de Mato Grosso para São Paulo). As alíquotas interestaduais são de 7% ou 12%, e as internas variam de 12% a 20% dependendo do estado.',
          '2. ISS (Imposto Sobre Serviços — MUNICIPAL): Cobrado pela Prefeitura apenas quando a coleta e a entrega da carga acontecem DENTRO DA MESMA CIDADE (frete intramunicipal). Nesse caso, não se emite CT-e para a SEFAZ, e sim uma Nota Fiscal de Serviço (NFS-e) para a Prefeitura, com alíquota de 2% a 5%.',
          '3. PIS e 4. COFINS (Programa de Integração Social e Contribuição para o Financiamento da Seguridade Social — FEDERAIS): São duas contribuições gêmeas cobradas pela Receita Federal sobre o faturamento da transportadora. Funcionam em dois modelos: Cumulativo (3,65% somados, sem direito a créditos) ou Não-Cumulativo (9,25% somados, permitindo descontar créditos de insumos como diesel e pneus).',
          '5. IPI (Imposto sobre Produtos Industrializados — FEDERAL): Não incide diretamente sobre o serviço de frete (CT-e), mas encarece a compra de caminhões novos, carretas, pneus e peças de reposição fabricadas pela indústria.'
        ],
        table: {
          headers: ['Sigla', 'Nome Simples', 'Quem Cobra?', 'Quando Incide na Transportadora?', 'Alíquota Atual Típica'],
          rows: [
            ['ICMS', 'Imposto Estadual sobre Mercadorias e Fretes', 'Estado (SEFAZ)', 'Frete entre cidades diferentes ou entre estados (CT-e)', '7%, 12% ou 17% a 20% (ou Isento/Diferido no Agro)'],
            ['ISS', 'Imposto Municipal sobre Serviços', 'Prefeitura', 'Frete apenas dentro da mesma cidade (NFS-e)', '2% a 5%'],
            ['PIS', 'Contribuição Federal (Parte 1)', 'União (Receita Federal)', 'Sobre a receita mensal de todos os fretes', '0,65% (Presumido) ou 1,65% (Lucro Real)'],
            ['COFINS', 'Contribuição Federal (Parte 2)', 'União (Receita Federal)', 'Sobre a receita mensal de todos os fretes', '3,00% (Presumido) ou 7,60% (Lucro Real)'],
            ['IPI', 'Imposto de Produtos Industrializados', 'União (Receita Federal)', 'Embutido na compra de caminhões, carretas e peças', '0% a 15% conforme o bem industrializado']
          ]
        }
      },
      {
        title: 'Outros Tributos da Rotina: Lucro (IRPJ/CSLL) e Contratação de Autônomo (INSS/SEST/SENAT)',
        content: [
          'Além dos 5 tributos sobre o consumo/frete (que serão substituídos na Reforma Tributária), existem dois grupos de tributos que CONTINUAM existindo e que todo embarcador precisa conhecer:',
          '• IRPJ e CSLL (Imposto de Renda e Contribuição Social sobre o Lucro): Incidem sobre o lucro da empresa. É aqui que a transportadora escolhe seu regime: Simples Nacional (pequenas empresas), Lucro Presumido (presume-se que 8% da receita de carga é lucro) ou Lucro Real (calculado sobre o lucro contábil exato — preferido pelas transportadoras de grãos pois têm margens apertadas e alto volume de créditos de diesel).',
          '• Retenções do Motorista Autônomo (TAC — Pessoa Física): Quando você contrata um caminhoneiro autônomo, a legislação determina que a base de cálculo previdenciária dele é de 20% do valor bruto do frete (os outros 80% a lei considera que ele gasta com diesel e manutenção do caminhão). Sobre esses 20%, retém-se 11% de INSS (o que dá 2,2% do frete total) e 2,5% de SEST/SENAT (o que dá 0,5% do frete total), além de IRRF se atingir a faixa tributável.'
        ],
        tips: [
          'Macete de Bolso para o Embarcador: No frete com motorista autônomo (TAC), a retenção padrão de INSS + SEST/SENAT descontada no recibo/CIOT soma 2,7% do valor bruto do frete (2,2% de INSS + 0,5% de SEST/SENAT).'
        ]
      }
    ]
  },
  {
    id: 'reforma-essencia-iva',
    phase: 2,
    number: '08',
    title: 'Reforma Tributária em Essência: O Novo IVA Dual (CBS, IBS e IS)',
    subtitle: 'Entenda a substituição de 5 tributos pelo IVA Dual, o cálculo em 4 fases sem cascata, o Imposto Seletivo e o Cashback',
    category: 'reforma',
    readTime: '10 min',
    audioDuration: '5.5 min',
    summary: 'Baseado no Capítulo 1 do e-book: compreenda como PIS, COFINS, IPI, ICMS e ISS dão lugar à CBS, ao IBS e ao Imposto Seletivo, como funciona o abatimento de créditos em cada fase da cadeia e por que caminhões ficaram isentos do Imposto Seletivo.',
    audioScript: [
      'Bem-vindo ao Módulo 08 da Fase 2: A Reforma Tributária em Essência e o funcionamento do IVA Dual!',
      'Se pudéssemos resumir toda a Reforma Tributária aprovada no Brasil em uma única frase, seria: substituir cinco impostos complexos e cumulativos por um modelo de Imposto sobre Valor Agregado, o IVA, usado em mais de 150 países do mundo.',
      'No Brasil, teremos o chamado IVA Dual, porque ele é dividido em dois irmãos gêmeos que funcionam com a mesmíssima regra: Primeiro, a CBS, Contribuição sobre Bens e Serviços, que é federal e entra no lugar do PIS, da COFINS e de parte do IPI. Segundo, o IBS, Imposto sobre Bens e Serviços, que é estadual e municipal e entra no lugar do ICMS e do ISS.',
      'E como funciona o IVA na prática para acabar com o imposto em cascata? Acompanhe o exemplo clássico das 4 fases com uma alíquota didática de 25%: Na Fase 1, o produtor vende algodão por 30 reais mais 7,50 de IVA. Na Fase 2, a fábrica têxtil transforma o algodão em tecido de 60 reais; o IVA seria 15 reais, mas ela desconta os 7,50 já pagos na fase anterior e recolhe só 7,50! Na Fase 3, a confecção faz a roupa por 110 reais; o IVA seria 27,50, mas ela abate os 15 reais acumulados antes e paga só 12,50. Na Fase 4, a loja vende ao consumidor por 150 reais mais 37,50 de IVA, abatendo os 27,50 anteriores e recolhendo apenas 10 reais. Somando o que cada empresa recolheu, dá exatamente os 37,50 pagos no final!',
      'Além da CBS e do IBS, nasce o Imposto Seletivo, apelidado de imposto do pecado, para desestimular cigarros, bebidas alcoólicas, apostas e emissões de carbono. E aqui vai uma excelente notícia para o nosso setor: após intensos debates no Congresso, os caminhões e ônibus foram expressamente isentos do Imposto Seletivo!'
    ],
    sections: [
      {
        title: 'A Principal Transformação: O Nascimento do IVA Dual (CBS + IBS)',
        content: [
          'A Emenda Constitucional nº 132/2023 e a Lei Complementar nº 214/2025 extinguem gradualmente os tributos atuais sobre o consumo (PIS, COFINS, ICMS, ISS e esvaziam o IPI) para implantar o IVA Dual (Imposto sobre Valor Agregado Dual), padrão adotado em mais de 150 países.',
          '• CBS (Contribuição sobre Bens e Serviços — Federal): Administrada pela Receita Federal (União), substitui o PIS, a COFINS e o IPI.',
          '• IBS (Imposto sobre Bens e Serviços — Subnacional): Administrado de forma integrada pelos Estados e Municípios através do Comitê Gestor do IBS, substitui o ICMS estadual e o ISS municipal.',
          'Unificação Estratégica: Embora um seja federal (CBS) e o outro estadual/municipal (IBS), ambos compartilham exatamente a mesma lei complementar, a mesma base de cálculo, o mesmo fato gerador e as mesmas regras de crédito. Acabam-se as 27 legislações estaduais diferentes de ICMS e as mais de 5.500 leis municipais de ISS!'
        ],
        table: {
          headers: ['Tributos Atuais (Sendo Extintos)', 'Esfera de Governo', 'Novos Tributos (Reforma Tributária)', 'Papel no Novo Sistema'],
          rows: [
            ['PIS + COFINS + IPI (parcial)', 'Federal (União)', 'CBS (Contribuição sobre Bens e Serviços)', 'Pilar Federal do IVA Dual (~8,8% estimado)'],
            ['ICMS (Estadual) + ISS (Municipal)', 'Estados e Municípios', 'IBS (Imposto sobre Bens e Serviços)', 'Pilar Estadual/Municipal do IVA Dual (~17,7% a 19,7%)'],
            ['IPI (Caráter regulatório)', 'Federal (União)', 'IS (Imposto Seletivo - "Imposto do Pecado")', 'Sobretaxa produtos nocivos à saúde e ao meio ambiente']
          ]
        }
      },
      {
        title: 'Exemplo Prático: Funcionamento do IVA Sem Acumulação (As 4 Fases)',
        content: [
          'No sistema antigo, muitas vezes o imposto pago numa etapa não podia ser abatido na seguinte, gerando "imposto sobre imposto". No IVA Completo, cada elo da cadeia abate 100% do tributo destacado na etapa anterior. Veja o exemplo prático do e-book (páginas 03 e 04) considerando uma alíquota fictícia de 25%:',
          '• 1ª Fase (Agricultor): Vende algodão por R$ 30,00 + R$ 7,50 de IVA (25%) = Valor total da nota: R$ 37,50. O agricultor recolhe R$ 7,50 ao governo.',
          '• 2ª Fase (Indústria Têxtil): Compra o algodão e fabrica o tecido por R$ 60,00 + R$ 15,00 de IVA (25%) = R$ 75,00. Como o agricultor já pagou R$ 7,50 na 1ª Fase, a indústria abate esse crédito (R$ 15,00 - R$ 7,50) e paga somente R$ 7,50.',
          '• 3ª Fase (Fábrica de Roupas): Compra o tecido e produz a roupa por R$ 110,00 + R$ 27,50 de IVA (25%) = R$ 137,50. Abate os R$ 15,00 acumulados nas fases anteriores (R$ 27,50 - R$ 15,00) e recolhe somente R$ 12,50.',
          '• 4ª Fase (Loja Varejista): Compra a roupa e vende ao consumidor final por R$ 150,00 + R$ 37,50 de IVA (25%) = R$ 187,50. Abate os R$ 27,50 da fase anterior (R$ 37,50 - R$ 27,50) e recolhe somente R$ 10,00.',
          'Resultado do IVA Completo: R$ 7,50 + R$ 7,50 + R$ 12,50 + R$ 10,00 = R$ 37,50! O imposto só onera o valor agregado em cada etapa, e todo frete contratado entre essas fases também gera crédito integral para o contratante!'
        ],
        tips: [
          'Transparência Total ("Imposto por Fora"): Hoje o ICMS e o PIS/COFINS são calculados "por dentro" (embutidos no próprio preço). O IBS e a CBS serão cobrados "por fora", mostrando exatamente quantos reais são serviço de frete e quantos reais são imposto.'
        ]
      },
      {
        title: 'O Imposto Seletivo (IS), Cashback e Alíquota de Referência',
        content: [
          '• Imposto Seletivo (IS — "Imposto do Pecado"): Entra em vigor em 2027 para desestimular produtos prejudiciais à saúde ou ao meio ambiente, como cigarros, bebidas alcoólicas, bebidas açucaradas, apostas (bets), carros poluentes, embarcações, aeronaves e extração de minério de ferro, petróleo e gás natural (limitado a 0,25% na extração mineral/petróleo).',
          '• Isenção Crucial para Caminhões: Conforme destacado na atualização do Senado (página 14 e 21 do e-book), CAMINHÕES e ÔNIBUS ficaram expressamente ISENTOS do Imposto Seletivo para não encarecer a renovação da frota de cargas e o transporte coletivo!',
          '• Sistema de Cashback Fiscal: Mecanismo inédito que devolve parte (ou até 100% na CBS e 20% a 50% no IBS) do imposto pago em contas de luz, água, gás de cozinha, telecomunicações e alimentos para famílias de baixa renda inscritas no CadÚnico.',
          '• Alíquota Padrão Estimada: Inicialmente estimada entre 25,45% e 27,5% (página 02 e 10 do e-book), chegou a ser projetada em 27,97% na Câmara e 28,55% no Senado (página 12 do e-book, superando os 27% da Hungria), mas a Lei Complementar nº 214/2025 estabeleceu uma trava/meta de 26,5% (sendo revisada em 2031 caso ultrapasse esse teto).'
        ],
        auditNote: 'Revisão Técnica do E-book (Págs. 05 vs 14): Na página 05 do e-book consta que o Imposto Seletivo afetaria armas e munições, enquanto na página 14 (atualização do Senado de 12/2024) informa que armas e munições foram excluídas do IS. Confirmamos que na Lei Complementar nº 214/2025 sancionada, armas e munições não integraram o rol do Imposto Seletivo, e os caminhões de carga tiveram sua não-incidência garantida.'
      }
    ]
  },
  {
    id: 'creditos-beneficios-transportadoras',
    phase: 2,
    number: '09',
    title: 'Créditos e Benefícios Fiscais de Transportadoras: Hoje vs. Pós-Reforma',
    subtitle: 'Análise profunda do Crédito Presumido de 20% do ICMS, créditos de PIS/COFINS sobre diesel e TAC, e a revolução do crédito amplo no IBS e CBS',
    category: 'creditos',
    readTime: '14 min',
    audioDuration: '7 min',
    summary: 'Módulo especial de aprofundamento: entenda em detalhes todos os créditos e incentivos fiscais que as transportadoras utilizam atualmente (Convênio ICMS 106/96, créditos de insumos no Lucro Real, subcontratação de TAC, diferimento e exportação) e exatamente como cada um ficará após a Reforma Tributária.',
    audioScript: [
      'Atenção máxima! Este é o Módulo 09 da Fase 2, o módulo mais estratégico e profundo do nosso curso: Créditos e Benefícios Fiscais de Transportadoras Atualmente e Como Vai Ficar Após a Reforma Tributária.',
      'Vamos dividir nossa explicação em dois momentos claros: como as transportadoras economizam impostos hoje e como vai funcionar no novo sistema do IBS e da CBS.',
      'Primeiro: como funciona HOJE no ICMS estadual? Atualmente, existe um benefício fiscal famoso chamado Crédito Presumido de 20% do ICMS, criado pelo Convênio ICMS 106 de 1996. Funciona assim: se a transportadora emite um CT-e com alíquota de 12% de ICMS, em vez de pagar os 12%, o estado permite que ela ganhe um desconto automático de 20% sobre esse imposto, caindo para uma alíquota efetiva de 9,6%! Se a alíquota for 7%, cai para 5,6%. Porém, existe uma trava: ao escolher o Crédito Presumido de 20%, a transportadora é obrigada a renunciar a todos os outros créditos de ICMS sobre diesel, pneus ou caminhões comprados. Por isso, quem usa muito motorista autônomo escolhe o Crédito Presumido de 20%, enquanto quem tem frota 100% própria avalia a apuração normal.',
      'Segundo: como funcionam HOJE os créditos federais de PIS e COFINS no Lucro Real, onde a alíquota é de 9,25%? Hoje a lei só permite tomar crédito do que a Receita Federal considera insumo direto do transporte: óleo diesel, lubrificantes, Arla 32, pneus, peças de manutenção, pedágio, seguro de carga e depreciação de caminhões. Tudo o que for despesa administrativa, como energia elétrica da matriz, softwares de gestão, contabilidade ou publicidade, NÃO gera crédito hoje! E quando a transportadora do Lucro Real contrata um motorista autônomo, o TAC, ela tem direito a um crédito presumido equivalente a 75% da alíquota de PIS e COFINS, o que representa 6,9375% sobre o valor pago ao caminhoneiro.',
      'Terceiro: e como vai ficar tudo isso APÓS a Reforma Tributária com a chegada da CBS e do IBS? Prepare-se para cinco mudanças profundas!',
      'Mudança número 1: Fim do Crédito Presumido de 20% do ICMS em 2033, mas entrada da Não-Cumulatividade Plena, o chamado Crédito Financeiro Amplo! No novo sistema, acaba aquela briga com a Receita Federal sobre o que é insumo. A transportadora poderá tomar crédito de 100% de tudo o que comprar ou contratar na sua atividade: óleo diesel, pneus, peças, oficinas, mas também softwares de gestão, rastreamento, gerenciadora de risco, energia elétrica dos escritórios, aluguel de pátio e serviços contábeis!',
      'Mudança número 2: Crédito Imediato na compra de caminhões e carretas! Hoje, quando uma transportadora compra um caminhão novo, ela precisa esperar 48 meses, 4 anos inteiros, para recuperar o crédito de ICMS aos poucos. Com a Reforma Tributária, o crédito de IBS e CBS na compra de veículos para a frota será integral e imediato, e se sobrar saldo credor, o governo devolve em dinheiro em até 30 a 60 dias!',
      'Mudança número 3: Combustíveis terão cobrança monofásica uniforme no país inteiro, e a lei garante expressamente que a transportadora continuará tomando 100% do crédito de IBS e CBS sobre o óleo diesel e biodiesel abastecidos!',
      'Mudança número 4: E na contratação de motorista autônomo? Mesmo o caminhoneiro autônomo sendo isento de pagar IBS e CBS como nanoempreendedor, a Lei Complementar garante que a transportadora que contrata o autônomo terá direito a um crédito presumido de IBS e CBS sobre o valor do frete pago a ele!',
      'E Mudança número 5: Nos fretes de exportação do agronegócio, a Reforma garantiu desoneração total inclusive no trecho rodoviário interno até os portos, mantendo 100% dos créditos de diesel e insumos da transportadora! Dominar essas cinco regras coloca você no topo do mercado logístico!',
      'Para fechar este módulo com chave de ouro, também incluímos o Guia Prático de Créditos na Contratação e Subcontratação de Frete: em 2026, em um frete de R$ 10.000,00 no Lucro Real, contratar outra transportadora (Lucro Real ou Presumido) gera R$ 925,00 de crédito (9,25%), contra R$ 693,75 (6,9375%) no Simples Nacional ou TAC — uma diferença de R$ 231,25 por viagem. A partir de 2027 com a CBS, empresas do Lucro Presumido também passam a tomar crédito, e o Simples Nacional padrão perde competitividade se não optar pelo regime híbrido!'
    ],
    sections: [
      {
        title: '1. CENÁRIO ATUAL (HOJE): O Crédito Presumido de 20% do ICMS (Convênio ICMS 106/96)',
        content: [
          'Atualmente, o maior e mais conhecido benefício fiscal estadual das transportadoras de carga (no Lucro Presumido ou Lucro Real) é o Crédito Presumido de 20% do ICMS, estabelecido nacionalmente pelo Convênio ICMS nº 106/1996.',
          '• Como funciona na prática: Em vez de somar nota por nota de combustível para abater do ICMS devido nos CT-es, a transportadora recebe um desconto direto de 20% sobre o valor do ICMS destacado no CT-e:',
          '  — Em um frete interestadual com ICMS de 12%: A transportadora abate 20% (2,4%) e recolhe apenas 9,6% sobre o valor do frete.',
          '  — Em um frete interestadual com ICMS de 7%: A transportadora abate 20% (1,4%) e recolhe apenas 5,6% sobre o valor do frete.',
          '• A Regra da "Vedação aos Demais Créditos": Ao optar pelo Crédito Presumido de 20% do Convênio 106/96, a transportadora fica PROIBIDA de aproveitar quaisquer outros créditos de ICMS (não pode se creditar do ICMS do óleo diesel, pneus, peças ou da compra de caminhões novos).',
          '• Por que as transportadoras que operam com motoristas autônomos (TAC) usam tanto esse benefício hoje? Porque quando a transportadora subcontrata um caminhoneiro autônomo, é o próprio motorista quem compra o diesel e os pneus no CPF dele (logo, a transportadora não tem nota fiscal de diesel no CNPJ dela para tomar crédito de ICMS). Assim, o Crédito Presumido de 20% garante uma redução imediata sem depender de notas de compra de insumos!'
        ],
        tips: [
          'Cálculo Rápido Atual: Em um CT-e de R$ 10.000,00 com alíquota de 12% de ICMS (R$ 1.200,00 de imposto destacado), o cliente tomador se credita dos R$ 1.200,00 integrais, mas a transportadora optante pelo Crédito Presumido abate R$ 240,00 (20%) e desembolsa apenas R$ 960,00 para a SEFAZ!'
        ]
      },
      {
        title: '2. CENÁRIO ATUAL (HOJE): Créditos de PIS e COFINS (9,25%) no Lucro Real e Subcontratação de TAC',
        content: [
          'No âmbito federal (PIS de 1,65% e COFINS de 7,60% = 9,25%), as transportadoras tributadas pelo Lucro Real utilizam o regime Não-Cumulativo (Leis nº 10.637/2002 e 10.833/2003). Mas hoje o direito a crédito é rígido e limitado ao conceito físico de "Insumo Essencial ou Relevante" definido pelo STJ e pela Receita Federal:',
          '• O que GERA crédito de 9,25% hoje (Frota Própria): Óleo diesel, biodiesel, Arla 32, lubrificantes, pneus novos, câmaras de ar, recapagem/recauchutagem de pneus, peças de reposição, serviços de manutenção mecânica da frota, vale-pedágio suportado pela transportadora, seguros obrigatórios de carga (RCTR-C e RC-DC), rastreamento/monitoramento exigido pela apólice, EPIs dos motoristas e depreciação/arrendamento mercantil de caminhões e carretas.',
          '• O que NÃO GERA crédito hoje (Perda Fiscal Atual): Energia elétrica dos escritórios administrativos, aluguel de prédios administrativos, softwares de gestão (TMS/ERP) não acoplados ao caminhão, honorários contábeis e advocatícios, marketing, despesas bancárias, telefonia/internet do escritório e veículos usados pela equipe comercial/administrativa.',
          '• O Crédito Presumido na Contratação de Motorista Autônomo (TAC) Hoje: Quando a transportadora (Lucro Real) contrata um caminhoneiro autônomo (pessoa física), o autônomo não paga PIS/COFINS. Para que a transportadora não perca totalmente o crédito, o art. 3º, § 19 da Lei nº 10.833/2003 concede um CRÉDITO PRESUMIDO correspondente a 75% das alíquotas de PIS (1,65% × 75% = 1,2375%) e COFINS (7,60% × 75% = 5,70%), totalizando 6,9375% de crédito sobre o valor bruto do frete pago ao motorista autônomo!'
        ],
        warning: 'Atenção no Cenário Atual: Se a transportadora estiver no Lucro Presumido (PIS/COFINS de 3,65%), ela NÃO tem direito a nenhum crédito de diesel, pneus ou autônomos no PIS/COFINS, pois o regime do Lucro Presumido é 100% cumulativo.'
      },
      {
        title: '3. CENÁRIO ATUAL (HOJE): Isenções, Diferimento no Agronegócio e Fretes de Exportação',
        content: [
          'No transporte de cargas do agronegócio (soja, milho, algodão, fertilizantes, calcário), existem hoje três situações especiais de benefícios fiscais que impactam o dia a dia do embarcador:',
          '• Diferimento e Isenção de ICMS em Fretes Internos Estaduais: Grandes estados agrícolas (como MT, MS, GO, PR, MG, SP, BA e RS) concedem isenção ou diferimento (postergação) do ICMS no transporte interno (dentro do mesmo estado) de insumos agropecuários e grãos in natura. Exemplo: um frete de soja de Sorriso (MT) para Rondonópolis (MT) frequentemente roda com ICMS isento ou diferido.',
          '• Imunidade / Desoneração nas Exportações (Lei Kandir - LC 87/96): O transporte de mercadorias destinadas ao exterior é desonerado de ICMS e PIS/COFINS. Contudo, no sistema atual, o STJ (Súmula 649) havia decidido que o frete rodoviário interno até o porto (ex: de Uberlândia até o Porto de Santos) não teria isenção automática de ICMS se houvesse transbordo, gerando enormes disputas judiciais!',
          '• O Grande Problema Atual ("Crédito Acumulado Preso"): Quando uma transportadora faz muitos fretes isentos ou de exportação, mas compra diesel e caminhões pagando ICMS embutido, ela acumula saldo credor de ICMS nas SEFAZ estaduais que leva anos de auditoria para ser liberado ou vendido com deságio!'
        ]
      },
      {
        title: '4. PÓS-REFORMA TRIBUTÁRIA: Como Ficarão os Créditos e Benefícios Fiscais na CBS e no IBS',
        content: [
          'Com a chegada da CBS (2027) e do IBS (transição 2029–2033) pela EC 132/2023 e Lei Complementar nº 214/2025, a lógica de créditos fiscais das transportadoras passa por uma revolução estrutural baseada na Não-Cumulatividade Plena (Crédito Financeiro):',
          '1. Fim do Conceito Restrito de Insumo → Crédito Amplo sobre TUDO: Diferente do PIS/COFINS e do ICMS atuais, no IBS e na CBS TODA aquisição de bens e serviços pela transportadora dará direito a crédito integral de 100% do imposto destacado (exceto apenas itens de uso e consumo pessoal, como joias, bebidas alcoólicas e lazer). Isso significa que a transportadora passará a tomar crédito não só sobre diesel, Arla 32, pneus, peças e manutenção, mas também sobre softwares TMS/ERP, taxas de Gerenciadoras de Risco (GR), computadores, energia elétrica das filiais, aluguel de pátios, contabilidade, assessoria jurídica, uniformes e publicidade!',
          '2. Compra de Caminhões e Carretas (Ativo Imobilizado) com Crédito IMEDIATO (Fim dos 48 meses!): Hoje, ao comprar um caminhão novo, a transportadora leva 48 meses (1/48 ao mês no CIAP) para recuperar o ICMS. Na Reforma Tributária, a aquisição de caminhões, cavalos mecânicos, bitrens e rodotrens gera CRÉDITO INTEGRAL E IMEDIATO de IBS e CBS no próprio mês da compra!',
          '3. Combustíveis no Regime Monofásico COM Direito Integral a Crédito: Conforme a página 11 do e-book e a LC 214/2025, o óleo diesel, biodiesel e lubrificantes terão tributação monofásica (alíquota única por litro em todo o Brasil cobrada na refinaria), e as transportadoras terão DIREITO GARANTIDO DE CRÉDITO de IBS e CBS sobre todo o combustível adquirido para a operação!',
          '4. Crédito Presumido na Contratação de Motorista Autônomo (TAC): Conforme destaca a página 20 do e-book e o art. 169 da LC 214/2025, mesmo o caminhoneiro autônomo (TAC) sendo dispensado de recolher IBS e CBS (enquadrado como não-contribuinte / nanoempreendedor especial), a transportadora que contratar o TAC terá direito a APROVEITAR CRÉDITO PRESUMIDO de IBS e CBS sobre o valor do frete pago ao motorista autônomo!',
          '5. Solução Definitiva para o Frete de Exportação até os Portos: Conforme destaca a página 21 do e-book, a versão aprovada corrigiu a distorção do STJ e garantiu que o transporte de cargas destinadas diretamente à exportação — INCLUSIVE o trajeto rodoviário interno até os portos e recintos alfandegados (ex: soja e milho do interior até Santos ou Paranaguá) — será desonerado (suspensão/alíquota zero) de IBS e CBS, garantindo à transportadora a manutenção integral de 100% dos créditos de diesel e insumos daquela viagem!',
          '6. Ressarcimento de Créditos em até 30 Dias (Fim do Crédito Preso): Conforme a página 15 do e-book, a Câmara e o Senado encurtaram para 30 dias (para empresas em conformidade/Split Payment, ou 60 dias na regra geral) o prazo obrigatório para o governo devolver em dinheiro vivo os créditos acumulados que a transportadora não conseguir compensar!'
        ],
        tips: [
          'O que acontece com o Crédito Presumido de 20% do ICMS (Convênio 106/96)? Ele continuará existindo enquanto o ICMS existir (integral até 2028, e reduzindo à razão de 10% ao ano entre 2029 e 2032). Em 2033, com a extinção do ICMS, o crédito presumido de 20% deixa de existir, sendo substituído pelo crédito financeiro amplo de IBS/CBS e pelo crédito presumido na contratação de TAC.'
        ]
      },
      {
        title: '5. Tabela Comparativa Completa: Créditos e Benefícios de Transportadoras (Hoje vs. Pós-Reforma)',
        content: [
          'Consulte abaixo o quadro comparativo direto entre o regime atual e o novo regime da Reforma Tributária para transportadoras de cargas:'
        ],
        table: {
          headers: ['Item / Operação na Transportadora', 'Como Funciona HOJE (Sistema Atual)', 'Como Ficará PÓS-REFORMA (CBS + IBS)'],
          rows: [
            ['Benefício Padrão sobre o Frete', 'Crédito Presumido de 20% do ICMS (Conv. 106/96), exigindo renúncia aos créditos de insumos estaduais', 'Extinção dos benefícios unilaterais em 2033; substituição pela Não-Cumulatividade Plena (crédito sobre tudo)'],
            ['Crédito sobre Óleo Diesel e Arla 32', 'Gera crédito de PIS/COFINS (9,25% no Lucro Real); no ICMS só gera crédito se abrir mão do Presumido de 20%', 'Regime Monofásico com alíquota nacional uniforme e direito garantido a 100% do crédito de IBS e CBS'],
            ['Crédito na Compra de Caminhões (Frota)', 'Trava de 48 meses (1/48 por mês no CIAP) para recuperar o ICMS do caminhão novo', 'Crédito INTEGRAL e IMEDIATO de IBS e CBS na compra de caminhões e carretas, com ressarcimento em 30–60 dias'],
            ['Contratação de Caminhoneiro Autônomo (TAC)', 'Zero crédito de ICMS; no PIS/COFINS (Lucro Real) gera crédito presumido de 6,9375% (75% da alíquota)', 'TAC é isento como Nanoempreendedor especial (até R$ 202,5 mil/ano), e a transportadora ganha Crédito Presumido de IBS/CBS'],
            ['Despesas de Escritório, TI (TMS), GR e Energia', 'NÃO geram crédito de ICMS nem de PIS/COFINS (consideradas despesas administrativas)', 'GERAM CRÉDITO INTEGRAL de 100% de IBS e CBS (Crédito Financeiro Amplo sobre todas as despesas do negócio)'],
            ['Frete Interno de Cargas para Exportação', 'Insegurança jurídica (Súmula 649 STJ tributava ICMS no trecho interno até o porto) e créditos presos', 'Desoneração garantida em lei para o trecho interno até os portos, mantendo 100% dos créditos de insumos'],
            ['Devolução de Saldo Credor Acumulado', 'Burocracia estadual que pode levar de 1 a 5 anos para liberar créditos de ICMS', 'Ressarcimento em dinheiro em até 30 dias (no Split Payment/conformidade) ou 60 dias na regra geral']
          ]
        }
      },
      {
        title: '6. GUIA PRÁTICO — Contratação e Subcontratação de Frete em 2026 (PIS e COFINS)',
        content: [
          'No sistema atual (válido até dezembro de 2026), o direito ao crédito na contratação ou subcontratação de frete depende exclusivamente do regime tributário da empresa contratante (quem paga o frete):',
          '• Contratante no Lucro Presumido ou Simples Nacional: Direito a 0% de crédito de PIS/COFINS, independentemente de quem seja o contratado.',
          '• Contratante no Lucro Real (Regime Não Cumulativo): Tem direito a tomar crédito sobre o valor bruto do frete contratado, variando conforme o perfil do prestador do serviço (conforme tabela abaixo).'
        ],
        table: {
          headers: ['Perfil do Contratado (Quem executa o frete)', 'PIS', 'COFINS', 'Crédito Total (2026)', 'Regra Aplicada'],
          rows: [
            ['Transportadora Lucro Real', '1,65%', '7,60%', '9,25%', 'Crédito integral (100% das alíquotas básicas).'],
            ['Transportadora Lucro Presumido', '1,65%', '7,60%', '9,25%', 'Crédito integral permitido por lei, mesmo o prestador pagando 3,65%.'],
            ['Transportadora Simples Nacional', '1,2375%', '5,7000%', '6,9375%', 'Crédito presumido equivalente a 75% das alíquotas básicas.'],
            ['Autônomo (TAC — Pessoa Física)', '1,2375%', '5,7000%', '6,9375%', 'Crédito presumido de 75% sobre o valor bruto do frete (via RPA/CIOT).']
          ]
        }
      },
      {
        title: '7. GUIA PRÁTICO — Subcontratação Pós-Reforma (A partir de 2027 — CBS e IBS)',
        content: [
          'A Reforma Tributária substitui PIS e COFINS pela CBS (federal) a partir de 2027, e substitui ICMS e ISS pelo IBS (estadual/municipal) gradualmente entre 2029 e 2033. O transporte rodoviário de cargas não recebeu alíquota reduzida e seguirá a alíquota padrão (estimada entre 26,5% e 28% na soma de IBS + CBS quando totalmente implementada).',
          'A lógica deixa de ser baseada em "presunções" e passa a ser a não cumulatividade plena (crédito financeiro): você só credita exatamente o imposto que foi efetivamente pago na etapa anterior.',
          '• 1. Contratação de Transportadora no Regime Regular (Lucro Real ou Lucro Presumido): Ambos passam a recolher CBS e IBS pelo mesmo sistema não cumulativo. O crédito passa a ser de 100% do valor destacado no CT-e do parceiro, condicionado à liquidação/pagamento do tributo (split payment ou recolhimento efetivo). Vantagem nova: contratantes no Lucro Presumido também passam a ter direito a tomar créditos de CBS/IBS sobre fretes contratados e insumos (diesel, pneus, peças, manutenção, pedágio), o que é proibido no PIS/COFINS até 2026.',
          '• 2. Contratação de Transportadora do Simples Nacional: Perda de competitividade no modelo padrão — se a empresa do Simples permanecer recolhendo tudo dentro da guia única (DAS), o crédito transferido para a contratante será limitado apenas à pequena parcela de CBS/IBS embutida no DAS (muito inferior aos 6,9375% atuais). Alternativa (Regime Híbrido): a LC 214/2025 permite que a transportadora do Simples opte por recolher CBS e IBS "por fora" do DAS no regime regular; se fizer essa opção, destaca a alíquota cheia no CT-e e transfere 100% do crédito ao contratante.',
          '• 3. Contratação de Motorista Autônomo (TAC — Pessoa Física): O TAC pessoa física é considerado não contribuinte de IBS e CBS, portanto não emite documento com destaque desses tributos. A partir de 2027, a contratante que pagar diretamente ao TAC terá direito a um crédito presumido específico da CBS, cujo percentual será fixado anualmente pelo Ministério da Fazenda/Receita Federal (e tende a ser menor que a alíquota cheia do regime regular). O crédito é apropriado conforme os pagamentos ao autônomo são confirmados.'
        ]
      },
      {
        title: '8. Quadro Resumo Comparativo na Contratação de Frete (2026 vs. Pós-Reforma)',
        content: [
          'Compare diretamente os impactos na contratação e subcontratação de fretes antes e depois da Reforma Tributária:'
        ],
        table: {
          headers: ['Critério', 'Até Dezembro de 2026 (PIS/COFINS)', 'A partir de 2027 (CBS / IBS)'],
          rows: [
            ['Quem pode tomar crédito?', 'Apenas transportadoras no Lucro Real.', 'Lucro Real e Lucro Presumido (todo o regime regular).'],
            ['Contratado: Lucro Real', '9,25% (crédito integral).', '100% do imposto destacado no CT-e (alíquota padrão).'],
            ['Contratado: Lucro Presumido', '9,25% (crédito integral).', '100% do imposto destacado no CT-e (alíquota padrão).'],
            ['Contratado: Simples Nacional', '6,9375% (crédito presumido fixo).', 'Apenas o valor pago no DAS (ou 100% se optar pelo regime híbrido).'],
            ['Contratado: Autônomo (TAC)', '6,9375% (crédito presumido fixo).', 'Crédito presumido específico (percentual a ser definido pelo governo).'],
            ['Cálculo do imposto', '"Por dentro" (imposto integra a própria base).', '"Por fora" (alíquota aplicada sobre o valor líquido do frete).']
          ]
        }
      },
      {
        title: '9. Exemplo Prático na Ponta do Lápis (Frete de R$ 10.000,00) & Cronograma 2026–2033',
        content: [
          'Imagine uma transportadora contratante no Lucro Real pagando R$ 10.000,00 por um frete subcontratado em 2026 versus o impacto estrutural a partir de 2027:',
          '• Em 2026 (Regra Atual — PIS/COFINS):',
          '  — Se contratar empresa do Lucro Real ou Lucro Presumido: recupera R$ 925,00 (9,25%) em créditos federais.',
          '  — Se contratar Simples Nacional ou Autônomo (TAC): recupera R$ 693,75 (6,9375%) em créditos federais — uma diferença de R$ 231,25 a menos de crédito por viagem.',
          '• A partir de 2027 (Com a CBS):',
          '  — Ao contratar empresas do Regime Regular (ou Simples no regime híbrido), a contratante recuperará o valor integral (100%) da CBS destacada na nota.',
          '  — Ao contratar Simples Nacional (padrão no DAS) ou TAC, o crédito será significativamente menor que o do regime regular, exigindo que a transportadora avalie o custo líquido do frete (valor pago menos o crédito recuperado) antes de fechar a negociação.',
          '• Cronograma de Transição para se Preparar:',
          '  — 2026 (Ano de Teste): Campos de IBS (0,1%) e CBS (0,9%) já constam no leiaute do CT-e e MDF-e para empresas do regime regular (sem recolhimento efetivo, valendo as regras antigas de PIS/COFINS).',
          '  — 2027 (Virada Federal): Extinção definitiva de PIS e COFINS; entrada da CBS com alíquota cheia. Optantes do Simples passam a informar IBS/CBS nos documentos fiscais. Início do novo crédito presumido do TAC.',
          '  — 2029 a 2032 (Transição Estadual): Redução gradual do ICMS (e do crédito presumido de ICMS do Convênio 106/96) em 10% ao ano, com aumento proporcional do IBS.',
          '  — 2033 (Sistema Definitivo): Extinção total do ICMS e ISS; vigência plena apenas de IBS e CBS.'
        ],
        tips: [
          'Regra de Ouro na Negociação de Frete: Nunca olhe apenas o valor bruto cobrado pelo parceiro ou autônomo. Calcule sempre o Custo Líquido do Frete = Valor Pago − Crédito Tributário Recuperado. Em 2026, um frete de R$ 10.000,00 no Lucro Real/Presumido custa R$ 9.075,00 líquidos, enquanto no Simples/TAC custa R$ 9.306,25 líquidos (R$ 231,25 mais caro na comparação tributária).'
        ]
      }
    ]
  },
  {
    id: 'efeitos-agronegocio-mercados',
    phase: 2,
    number: '10',
    title: 'Efeitos nos Mercados, Agronegócio, Cesta Básica e Nanoempreendedor',
    subtitle: 'Alíquota zero, redução de 60% em insumos e grãos, e a regra especial do caminhoneiro autônomo (TAC)',
    category: 'reforma',
    readTime: '9 min',
    audioDuration: '5 min',
    summary: 'Baseado no Capítulo 2 do e-book (páginas 07 a 18): descubra como ficam as 4 faixas de alíquotas para produtos agrícolas, alimentos da cesta básica, combustíveis, IPVA e a nova categoria de Nanoempreendedor aplicada aos motoristas autônomos.',
    audioScript: [
      'Estamos no Módulo 10 da Fase 2: Efeitos da Reforma Tributária nos Mercados, no Agronegócio e na figura do Nanoempreendedor!',
      'Para entender como os clientes da DLLOG Transportes serão impactados, a palavra-chave é Alíquota. A Reforma criou quatro faixas: a Alíquota Padrão cheia, a Alíquota Intermediária com redução de 30%, a Alíquota Reduzida com desconto de 60%, e a Alíquota Zero, que é a isenção total. Todos esses benefícios passarão por uma avaliação a cada 5 anos.',
      'Preste muita atenção numa correção técnica fundamental para você não se confundir ao ler notícias ou o e-book: quando a lei diz redução de 60% na alíquota, significa que o produto tem 60% de desconto e paga apenas 40% da alíquota padrão! Por exemplo, se a alíquota padrão do IVA for 26,5%, um produto com redução de 60% vai pagar apenas 10,6% de imposto!',
      'E onde entram os produtos que nós transportamos todos os dias no agronegócio? As sementes, fertilizantes, defensivos agrícolas, calcário e os grãos in natura como soja, milho e sorgo conquistaram a redução de 60% na alíquota de IBS e CBS! Já a Cesta Básica Nacional de Alimentos, incluindo arroz, feijão, carnes, aves, peixes, leite, queijo, sal, mandioca e açúcar, conquistou Alíquota Zero, isenção total de 100%!',
      'Agora, uma novidade importantíssima do e-book é a criação do Nanoempreendedor: a pessoa física que fatura até 40 mil e 500 reais por ano, metade do limite do MEI, fica totalmente isenta de IBS e CBS. E sabe qual é o grande pulo do gato para o nosso setor? Para o Caminhoneiro Autônomo, o TAC, a lei determinou que apenas 20% do valor bruto do frete conta para esse limite! Isso significa que o motorista autônomo pode receber até 202 mil e 500 reais por ano em fretes, cerca de 16 mil e 875 reais por mês, continuando 100% isento de pagar IBS e CBS!'
    ],
    sections: [
      {
        title: 'As 4 Faixas de Alíquotas e a Revisão de 5 em 5 Anos',
        content: [
          'Conforme apresentado nas páginas 08 a 10 do e-book, a Reforma Tributária trabalha com quatro patamares de tributação para empresas e produtos, todos sujeitos a uma reavaliação de eficiência a cada 5 anos (avaliação quinquenal):',
          '1. Alíquota Padrão (100% do IVA): Aplicada como regra geral para a indústria, comércio e serviços em geral (incluindo o serviço de transporte rodoviário de cargas no mercado interno). Estimada entre 26,5% e 28,55%.',
          '2. Alíquota Intermediária (Redução de 30% → Paga 70% do IVA): Aplicada a profissionais liberais regulamentados por conselho profissional (advogados, contadores, engenheiros, arquitetos — página 09 do e-book).',
          '3. Alíquota Reduzida em 60% (Paga apenas 40% do IVA): Aplicada a setores essenciais como alimentos da cesta estendida, insumos agropecuários, produtos agrícolas in natura, saúde, educação e transporte coletivo.',
          '4. Alíquota Zero (Isenção de 100% do IVA): Aplicada à Cesta Básica Nacional de Alimentos, medicamentos essenciais (como câncer e doenças raras), absorventes, dispositivos para PcD, taxistas e ProUni (alíquota zero na CBS).'
        ],
        auditNote: 'Esclarecimento Didático sobre as Páginas 13 e 18 do E-book: Na página 18, o texto menciona que determinados medicamentos "permanecem com uma tributação de 40%". Isso NÃO significa pagar 40% do preço do remédio em imposto, e sim pagar 40% da alíquota padrão (ou seja, usufruir da redução de 60% do IVA)! Da mesma forma, na página 13, bares, restaurantes e hotéis têm redução de 40% na alíquota padrão (pagando 60% da alíquota padrão no regime específico), e não 60% de imposto sobre a conta!'
      },
      {
        title: 'Impacto nas Cargas do Agronegócio e na Cesta Básica Nacional',
        content: [
          'Veja como ficaram tributadas as principais mercadorias que circulam nos caminhões da DLLOG Transportes (páginas 08, 09, 13 e 15 do e-book):',
          '• ALÍQUOTA ZERO (Isenção Total de IBS e CBS): Arroz, feijão, carnes (bovina, suína, ovina, caprina, aves e peixes), leite, manteiga, margarina, queijos, sal, farinha de mandioca, farinha de trigo, milho em grão/fubá para consumo humano, açúcar, macarrão, pão comum, mandioca, inhame, batata-doce, coco, óleo de babaçu, além de produtos hortícolas, frutas e ovos.',
          '• REDUÇÃO DE 60% DA ALÍQUOTA (Paga apenas 40% do IVA):',
          '  — Insumos Agropecuários e Aquícolas: Fertilizantes, adubos, calcário agrícola, defensivos agrícolas (incluídos pelo Senado — pág. 13), sementes certificadas, mudas, rações e vacinas veterinárias.',
          '  — Produtos Agropecuários, Aquícolas, Pesqueiros, Florestais e Extrativistas in natura: Soja em grão, milho, sorgo, trigo, algodão em pluma/caroço, café, cana-de-açúcar e madeira.',
          '  — Cesta Básica Estendida: Óleo de soja, óleo de milho, biscoitos e bolachas simples (sem cacau ou recheio), sucos naturais e crustáceos.',
          '• Produtor Rural Pessoa Física: Produtores rurais pessoas físicas ou integrados com receita anual de até R$ 3,6 milhões têm a opção de NÃO serem contribuintes regulares de IBS/CBS (e quem compra deles recebe crédito presumido!).'
        ]
      },
      {
        title: 'O Nanoempreendedor e a Regra Especial do Caminhoneiro Autônomo (TAC)',
        content: [
          'Conforme destacado nas páginas 16 e 17 do e-book, a Reforma Tributária criou a figura do NANOEMPREENDEDOR: a pessoa física que possui receita bruta anual de até R$ 40.500,00 (R$ 3.375,00 por mês — metade do limite atual de R$ 81 mil do MEI) fica totalmente ISENTA de recolher IBS e CBS.',
          '• E como fica o Caminhoneiro Autônomo (TAC)? Um caminhoneiro recebe valores brutos altos de frete porque cerca de 70% a 80% do frete vai para pagar óleo diesel, pneus e manutenção. Se o limite fosse R$ 3.375/mês brutos, nenhum caminhoneiro caberia no limite!',
          '• A Solução Oficial na Lei Complementar (LC 214/2025, art. 26, § 5º): Para o Transportador Autônomo de Cargas (TAC) pessoa física devidamente registrado no RNTRC, considera-se como receita apenas 20% do valor bruto anual recebido dos fretes!',
          '• Cálculo Prático para o Embarcador: R$ 40.500,00 ÷ 20% = R$ 202.500,00 por ano (média de R$ 16.875,00 por mês em fretes brutos)! Ou seja, o caminhoneiro autônomo que faturar até R$ 202.500,00 por ano é enquadrado como Nanoempreendedor isento de IBS e CBS, e a transportadora que o contrata ainda aproveita crédito presumido!'
        ],
        tips: [
          'E se o caminhoneiro tiver CNPJ no Simples Nacional ou MEI? Conforme a página 17 do e-book, optantes pelo Simples Nacional poderão escolher entre recolher o IBS/CBS dentro da guia única do Simples (transferindo apenas o crédito reduzido do Simples) OU apurar o IBS e a CBS pelo regime normal de IVA para transferir 100% de crédito às transportadoras e indústrias contratantes!'
        ]
      },
      {
        title: 'Na Prática: IPVA de Veículos, Combustíveis, Imóveis e Cooperativas (Págs. 10 a 14)',
        content: [
          '• Veículos e IPVA (Página 11): O IPVA passa a incidir sobre jatos, helicópteros, iates e lanchas de lazer, e poderá ter alíquotas progressivas conforme o impacto ambiental ("quem poluir menos, pagará menos"). Tratores, colheitadeiras e máquinas agrícolas permanecem 100% ISENTOS de IPVA!',
          '• Combustíveis e Lubrificantes (Páginas 10 e 11): Terão Regime Específico Monofásico — o imposto é cobrado uma única vez na refinaria/importador com valor fixo por litro igual no Brasil inteiro, eliminando a guerra de preços de ICMS entre estados e garantindo crédito às transportadoras.',
          '• Sociedades Cooperativas (Páginas 10 e 14): Muito fortes no agronegócio e no transporte (CTC), contam com regime específico onde as operações entre o cooperado e a cooperativa têm alíquota reduzida a zero.',
          '• Setor Imobiliário (Página 14): Contará com redução de 50% na alíquota de venda de imóveis, redução de 70% em aluguéis/arrendamentos (como locação de galpões logísticos) e Redutor Social (abatimento de R$ 100 mil na base de imóveis novos, R$ 30 mil em lotes e R$ 600 em aluguéis residenciais).'
        ]
      }
    ]
  },
  {
    id: 'insights-setor-transportes',
    phase: 2,
    number: '11',
    title: 'Insights para o Setor de Transportes & Auditoria Técnica',
    subtitle: 'Transporte de Cargas vs. Passageiros, análise da CNT, fretes de exportação e verificação técnica dos números',
    category: 'reforma',
    readTime: '10 min',
    audioDuration: '5.5 min',
    summary: 'Baseado no Capítulo 3 do e-book (páginas 19 a 23): entenda o impacto do IVA no preço bruto vs. preço líquido do frete, as projeções da CNT e a auditoria técnica que corrige os percentuais comparativos de PIS/COFINS e ICMS.',
    audioScript: [
      'Bem-vindo ao Módulo 11 da Fase 2: Insights para o Setor de Transportes e Auditoria Técnica dos Números!',
      'Quando olhamos especificamente para o setor de transportes nas páginas 20 a 23 do e-book, vemos que a Reforma Tributária dividiu o setor em dois mundos bem diferentes: o transporte de passageiros e o transporte de cargas.',
      'O Transporte Coletivo Urbano e Metropolitano de Passageiros, por ser um direito social previsto na Constituição, recebeu isenção total de IBS e CBS, e o transporte ferroviário e hidroviário urbano teve redução de 99%, enquanto a aviação regional recebeu redução de 40%.',
      'Já o Transporte Rodoviário de Cargas entrou na regra da Alíquota Padrão do IVA Dual, estimada entre 26,5% e 28,5%. Aqui precisamos fazer uma correção técnica importantíssima sobre um número que aparece na página 20 do e-book: o texto do e-book dizia que a alíquota sobe para 25% em comparação aos atuais 19,5% do PIS e COFINS. Cuidado! Na legislação brasileira atual, o PIS e COFINS somam 9,25% no Lucro Real, e nunca 19,5%! Esse percentual de 19,5% a 21,25% é, na verdade, a soma atual do PIS e COFINS de 9,25% com o ICMS estadual médio de 10% a 12%!',
      'A Confederação Nacional do Transporte, a CNT, estima que a mudança pode pressionar o valor nominal do frete caso a transportadora não faça uma gestão rigorosa dos seus créditos. Mas veja o lado estratégico para nós na DLLOG Transportes: como todos os nossos clientes são empresas do agronegócio, indústrias e tradings, todo o IBS e a CBS destacados no nosso CT-e viram crédito integral para o nosso cliente descontar! Portanto, a transportadora que souber capturar 100% dos seus créditos de diesel, caminhões, pneus e autônomos terá o frete líquido mais competitivo do mercado!'
    ],
    sections: [
      {
        title: 'Transporte de Passageiros vs. Transporte de Cargas na Reforma',
        content: [
          'Conforme detalhado nas páginas 20 a 22 do e-book, a Reforma Tributária deu tratamentos distintos aos diferentes modais de transporte:',
          '• Transporte Coletivo Urbano, Semiurbano e Metropolitano de Passageiros (Rodoviário, Metroviário, Ferroviário e Hidroviário): Desoneração / Isenção total (ou redução de até 100%) de IBS e CBS, amparado como direito fundamental pelo artigo 6º da Constituição Federal.',
          '• Transporte Aéreo Regional de Passageiros e Cargas: Regime específico com benefício de redução de 40% na alíquota.',
          '• Transporte Rodoviário de Cargas (Nosso Setor): Não recebeu alíquota reduzida própria (embora a Confederação Nacional do Transporte - CNT tenha defendido uma alíquota reduzida próxima a 15% equivalente ao ICMS médio). Assim, o frete rodoviário de cargas no mercado interno será tributado pela alíquota padrão do IVA Dual (CBS + IBS).'
        ],
        table: {
          headers: ['Modalidade de Transporte', 'Tratamento no Novo Sistema (CBS + IBS)', 'Direito a Créditos de Insumos'],
          rows: [
            ['Transporte Coletivo Urbano / Metropolitano (Passageiros)', 'Isenção Total / Redução de 100% na alíquota', 'Regime específico sem repasse de imposto ao passageiro'],
            ['Transporte Aéreo Regional', 'Redução de 40% na alíquota padrão (paga 60% do IVA)', 'Direito a créditos conforme regras do regime específico'],
            ['Transporte Rodoviário de Cargas (Mercado Interno)', 'Alíquota Padrão do IVA Dual (~26,5% a 28,55%)', 'Crédito 100% amplo para a transportadora E 100% de crédito para o cliente contratante'],
            ['Transporte Rodoviário de Cargas para Exportação (inclusive até o Porto)', 'Desonerado / Alíquota Zero / Suspensão (Imunidade)', 'Mantém 100% dos créditos de diesel, pneus e frota (ressarcimento em 30 dias)']
          ]
        }
      },
      {
        title: 'Auditoria Técnica do Conteúdo: Revisão e Correção dos Números do E-book',
        content: [
          'Para garantir que você aprenda com 100% de exatidão técnica e contábil, revisamos todos os números citados no Capítulo 3 do e-book (páginas 20 a 22) e destacamos três pontos essenciais:',
          '1. CORREÇÃO SOBRE O PIS/COFINS ATUAL (Página 20 do E-book): O e-book afirma que "a alíquota do IBS foi fixada em 25%, um aumento considerável em comparação aos atuais 19,5% do PIS/Cofins".',
          '   → Qual é o dado correto na Lei? Atualmente, o PIS e a COFINS somam 9,25% no Lucro Real (1,65% de PIS + 7,60% de COFINS) ou 3,65% no Lucro Presumido — jamais 19,5%! O número de ~19,5% a 21,25% representa a SOMA ATUAL do PIS/COFINS (9,25%) + o ICMS médio estadual sobre o frete (que fica entre 9,6% com crédito presumido e 12% na alíquota interestadual). Além disso, a nova alíquota de 26,5% a 28,5% não é apenas do IBS, e sim da soma de CBS (Federal) + IBS (Estadual/Municipal).',
          '2. ENTENDENDO A ESTIMATIVA DE 10% DA CNT (Página 20 do E-book): A Confederação Nacional do Transporte (CNT) projetou que a transição da carga bruta atual (~19% a 21% somando PIS/COFINS + ICMS) para a alíquota padrão do IVA (~26,5% a 28,5%) pode elevar o valor nominal bruto do frete em cerca de 10% se analisado isoladamente.',
          '   → Por que no frete B2B (para empresas do Agro e Indústrias) o impacto real é diferente? Porque no sistema atual o imposto é cobrado "por dentro" e parte dos créditos se perde no caminho. No novo IVA "por fora", se uma transportadora cobra R$ 1.000,00 de frete líquido + R$ 265,00 de IVA (26,5%), o cliente contratante (trading, cooperativa ou indústria) recupera integralmente os R$ 265,00 como crédito imediato! O custo líquido real para o cliente continua sendo R$ 1.000,00!',
          '3. COMBUSTÍVEIS FÓSSEIS E O EFEITO CASCATA DE 0,25% (Página 21 do E-book): Enquanto caminhões ficaram fora do Imposto Seletivo (IS), a extração de petróleo e gás natural terá incidência de IS limitada ao teto de 0,25% (que não gera crédito por ser imposto seletivo na extração), exigindo eficiência operacional das transportadoras.'
        ],
        auditNote: 'Resumo da Auditoria Fiscal DLLOG Academy: Carga Tributária Bruta Nominal no Frete de Cargas HOJE (Lucro Real) = 9,25% (PIS/COFINS) + 7% a 12% (ICMS) = 16,25% a 21,25% (reduzível por créditos de insumos e crédito presumido). Carga Nominal PÓS-REFORMA = ~26,5% a 28,55% (CBS + IBS por fora), porém com crédito financeiro 100% amplo sobre todas as despesas e compra imediata de frota.'
      }
    ]
  },
  {
    id: 'cronograma-2026-2033-estrategia',
    phase: 2,
    number: '12',
    title: '2033: Cronograma de Transição (2026–2033) & Preparo Estratégico',
    subtitle: 'Linha do tempo ano a ano, convivência dos dois sistemas, Split Payment e plano de ação do embarcador',
    category: 'reforma',
    readTime: '8 min',
    audioDuration: '4.5 min',
    summary: 'Baseado nos Capítulos 4 e 5 do e-book (páginas 24 a 33): domine o calendário oficial de transição que começa em 2026 e se completa em 2033, entenda o que muda na emissão do CT-e e veja como transformar a Reforma em vantagem competitiva.',
    audioScript: [
      'Chegamos ao Módulo 12, o capítulo final da Fase 2 do nosso curso: O Cronograma Oficial de 2026 a 2033 e o Preparo Estratégico do Embarcador!',
      'A maior dúvida de quem estuda a Reforma Tributária é: quando tudo isso entra em vigor? A transição foi desenhada para acontecer de forma gradual ao longo de 8 anos para as empresas, de 2026 até 2033, além de uma transição de 50 anos, até 2078, apenas para a divisão do dinheiro entre os estados e municípios.',
      'Vamos gravar os quatro marcos da linha do tempo das empresas, conforme a página 26 do e-book:',
      'Primeiro marco, ano de 2026: É o Ano-Teste! Começam a aparecer no CT-e e nas notas fiscais a CBS com alíquota teste de 0,9% e o IBS com alíquota teste de 0,1%, somando 1%. Mas calma: esse 1% será totalmente descontado do PIS e da COFINS que a empresa já paga, ou seja, não aumenta o imposto em 2026, servindo para testar os sistemas!',
      'Segundo marco, ano de 2027: É a grande virada federal! O PIS e a COFINS são definitivamente extintos! A CBS passa a ser cobrada com sua alíquota cheia, entra em vigor o Imposto Seletivo, e o IPI é zerado em todo o país, exceto para produtos concorrentes da Zona Franca de Manaus. O IBS continua em 0,1%.',
      'Terceiro marco, de 2029 a 2032: Começa a escadinha de redução do ICMS e do ISS! Em 2029, o ICMS e o ISS caem 10% e o IBS sobe 10%; em 2030, caem 20%; em 2031, caem 30%; e em 2032, caem 40%.',
      'Quarto marco, 1º de janeiro de 2033: O ICMS e o ISS são totalmente extintos e o novo sistema tributário brasileiro passa a vigorar 100% completo!',
      'E o que você, embarcador da DLLOG Transportes, deve fazer desde já? Exigir documentação fiscal impecável em todas as operações, garantir o cadastro correto do RNTRC dos motoristas autônomos para aproveitarmos o crédito presumido e orientar nossos clientes. Parabéns por concluir todas as aulas da Fase 1 e da Fase 2 da DLLOG Transportes Academy!'
    ],
    sections: [
      {
        title: 'Timeline Oficial da Reforma Tributária (2026 a 2033 e 2078)',
        content: [
          'Conforme apresentado nas páginas 25 e 26 do e-book, a transição tributária não acontece da noite para o dia. Ela possui dois relógios: um relógio de 8 anos para os contribuintes/empresas (2026 a 2033) e um relógio de 50 anos (2029 a 2078) apenas para a redistribuição interna de receitas entre os governos estaduais e municipais (transição da origem para o destino).'
        ],
        table: {
          headers: ['Período / Ano', 'O que Acontece com os Tributos Antigos?', 'O que Acontece com os Novos Tributos (CBS / IBS / IS)?', 'Impacto Prático no CT-e da Transportadora'],
          rows: [
            ['2026 (Ano-Teste)', 'PIS, COFINS, ICMS, ISS e IPI continuam normais', 'CBS entra em teste a 0,9% e IBS entra em teste a 0,1% (Total = 1,0%, abatido do PIS/COFINS)', 'CT-e passa a destacar os campos de CBS (0,9%) e IBS (0,1%) sem aumento de carga tributária'],
            ['2027 a 2028', 'PIS e COFINS são EXTINTOS! IPI é zerado (exceto proteção à Zona Franca de Manaus)', 'CBS entra em vigor com alíquota plena (~8,8%). Entra o Imposto Seletivo (IS). IBS segue em 0,1%', 'Fim do PIS/COFINS! Transportadora já toma crédito amplo de CBS sobre todas as despesas e caminhões'],
            ['2029', 'ICMS e ISS (e benefícios de ICMS) são reduzidos em 10% (ficam em 90%)', 'IBS sobe para 10% da sua alíquota definitiva', 'Convivência: CT-e terá 90% da alíquota de ICMS + 10% do IBS + 100% da CBS'],
            ['2030', 'ICMS e ISS caem para 80% da alíquota original', 'IBS sobe para 20% da sua alíquota definitiva', 'Redução progressiva do ICMS e do Crédito Presumido de 20% na mesma proporção'],
            ['2031', 'ICMS e ISS caem para 70% da alíquota original', 'IBS sobe para 30% da sua alíquota definitiva', 'Avaliação quinquenal da trava de 26,5% do IVA pelo Governo e Congresso'],
            ['2032', 'ICMS e ISS caem para 60% da alíquota original', 'IBS sobe para 40% da sua alíquota definitiva', 'Último ano de existência do ICMS estadual e do ISS municipal'],
            ['2033 em diante', 'EXTINÇÃO DEFINITIVA do ICMS e do ISS!', 'Vigência 100% integral do IVA Dual (CBS + IBS) e do Imposto Seletivo', 'Sistema único em todo o país: apenas CBS + IBS no CT-e, cobrados no destino!']
          ]
        }
      },
      {
        title: 'O Novo Mecanismo de "Split Payment" e o Fim da Tributação na Origem',
        content: [
          'Duas transformações operacionais vão mudar a rotina financeira e comercial das transportadoras durante essa transição:',
          '1. Princípio do Destino (Fim da Guerra Fiscal): Hoje, o ICMS do frete pertence ao estado onde o transporte COMEÇA (origem). Com o IBS, o imposto pertencerá ao estado e município de DESTINO da carga! Isso acaba com a necessidade de abrir filiais artificiais em determinados estados apenas para pagar menos ICMS de saída.',
          '2. Split Payment (Pagamento Dividido Automático): Quando o cliente pagar a fatura de frete da transportadora via PIX, boleto ou transferência bancária, o próprio sistema bancário separará automaticamente a parcela do IBS e da CBS e enviará direto para o Comitê Gestor e para a Receita Federal, vinculando instantaneamente o crédito fiscal ao cliente pagador!'
        ],
        tips: [
          'Regra de Ouro no Novo Sistema: No modelo de IVA com Split Payment, o crédito fiscal depende de documento fiscal idôneo e liquidação financeira. Comprar diesel ou peças sem Nota Fiscal Eletrônica significará perder quase 27% de crédito imediato!'
        ]
      },
      {
        title: 'Preparo é Sinônimo de Vanguarda: Checklist do Embarcador DLLOG',
        content: [
          'Como destaca o Capítulo 5 do e-book (páginas 28 e 29), "o sucesso futuro pertence àqueles que se adaptam". Veja como aplicar esse conhecimento na prática comercial e operacional da DLLOG Transportes:',
          '• 1. Cadastro Perfeito de Autônomos (TAC): Mantenha CPF, RNTRC ativo e CIOT impecáveis no sistema. Na Reforma Tributária, esse registro é o que garante o Crédito Presumido de IBS e CBS para a transportadora nas viagens feitas com motoristas terceiros.',
          '• 2. Identificação Clara de Cargas de Exportação: Ao cadastrar uma carga cujo destino final é exportação (mesmo que o nosso caminhão entregue em um porto ou terminal alfandegado intermediário), confira sempre a natureza da operação na NF-e, pois essa viagem terá desoneração de IBS/CBS mantendo 100% dos nossos créditos!',
          '• 3. Separação entre Preço Líquido e Imposto por Fora nas Cotações: Aprenda a negociar fretes olhando para o valor líquido da operação (excluindo os tributos recuperáveis), mostrando ao embarcador/cliente que todo o IBS e CBS do nosso CT-e retornará 100% como crédito para ele.'
        ]
      }
    ]
  }
];

export interface QuizQuestion {
  id: number;
  phase: CoursePhaseNumber;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export const QUIZ_QUESTIONS: QuizQuestion[] = [
  // QUESTÕES DA FASE 1 (OPERACIONAL & EMBARQUE)
  {
    id: 1,
    phase: 1,
    question: 'Qual é a regra mandatória de segurança antes de permitir que um motorista carregue a mercadoria?',
    options: [
      'Basta o motorista apresentar a CNH na portaria da fazenda',
      'O motorista deve ter aprovação formal na análise de gerenciamento de risco (GR)',
      'O pagamento de 100% do saldo deve ser feito antes da saída',
      'A ordem externa no portal do cliente deve ser emitida primeiro'
    ],
    correctIndex: 1,
    explanation: 'Correto! A seguradora exige liberação expressa da gerenciadora de risco antes do carregamento. Carregar sem aprovação de GR anula a cobertura do seguro.'
  },
  {
    id: 2,
    phase: 1,
    question: 'Qual a capacidade de peso bruto total (PBT) de um Rodotrem de 9 eixos e sua carga líquida média?',
    options: [
      'PBT 48,5 t e carga líquida de 32 t',
      'PBT 58,5 t e carga líquida de 40 t',
      'PBT 74,0 t e carga líquida de ≈ 48,5 a 50,0 t',
      'PBT 57,0 t e carga líquida de 35 t'
    ],
    correctIndex: 2,
    explanation: 'Exato! O Rodotrem de 9 eixos possui PBT de 74 toneladas e carrega em torno de 48,5 a 50 toneladas úteis.'
  },
  {
    id: 3,
    phase: 1,
    question: 'Para o transporte de fertilizante a granel em usinas e armazéns, qual o veículo recomendado?',
    options: [
      'Carreta Graneleira com assoalho de madeira',
      'Caçamba (Basculante), pela facilidade de descarga rápida e peso elevado',
      'Sider com cortina lateral de lona',
      'Prancha rebaixada'
    ],
    correctIndex: 1,
    explanation: 'Correto! O fertilizante a granel requer caçamba basculante devido à alta densidade e necessidade de descarregamento rápido em moegas.'
  },
  {
    id: 4,
    phase: 1,
    question: 'Segundo as normas da ANTT, é permitido pagar o frete ao motorista em dinheiro vivo?',
    options: [
      'Sim, desde que com recibo de próprio punho',
      'Não, é expressamente proibido pagamento em espécie; deve ser via meio eletrônico regulamentado',
      'Sim, até o limite de R$ 5.000,00',
      'Apenas se for para abastecimento no posto'
    ],
    correctIndex: 1,
    explanation: 'Perfeito! A ANTT proíbe pagamento em dinheiro vivo para garantir rastreabilidade, comprovação e recolhimento previdenciário do motorista autônomo.'
  },
  {
    id: 5,
    phase: 1,
    question: 'Em que momento a Ordem Externa (portal do cliente) deve ser emitida?',
    options: [
      'Antes de cadastrar o motorista no sistema',
      'Assim que o cliente solicitar o frete',
      'Somente após o cadastro do motorista, aprovação de risco e criação da ordem interna',
      'Apenas após a descarga do produto no destino'
    ],
    correctIndex: 2,
    explanation: 'Exato! A sequência correta é: 1. Cadastro → 2. Risco → 3. Ordem Interna → 4. Ordem Externa. Isso evita cadastros rejeitados no portal do cliente.'
  },

  // QUESTÕES DA FASE 2 (TRIBUTAÇÃO, CRÉDITOS FISCAIS & REFORMA TRIBUTÁRIA)
  {
    id: 6,
    phase: 2,
    question: 'Para um iniciante: qual é a diferença prática entre quando incide o ICMS (Estadual) e quando incide o ISS (Municipal) no serviço de transporte?',
    options: [
      'O ISS incide apenas em viagens entre estados diferentes, e o ICMS dentro da mesma cidade',
      'O ISS incide apenas quando coleta e entrega ocorrem dentro do MESMO município (intramunicipal); já o ICMS incide em fretes entre cidades diferentes (intermunicipal) ou entre estados (interestadual)',
      'O ICMS só existe para caminhões próprios e o ISS para caminhoneiros autônomos',
      'Ambos são cobrados juntos no mesmo CT-e em qualquer viagem rodoviária'
    ],
    correctIndex: 1,
    explanation: 'Perfeito! Se o transporte começa e termina dentro do mesmo município, incide o ISS municipal (via NFS-e). Se cruza a divisa de um município para outro ou entre estados, incide o ICMS estadual (via CT-e).'
  },
  {
    id: 7,
    phase: 2,
    question: 'Com a Reforma Tributária (IVA Dual), quais tributos atuais serão extintos e substituídos pela CBS (Federal) e pelo IBS (Estadual/Municipal)?',
    options: [
      'IRPJ, CSLL, INSS e IPVA serão extintos',
      'PIS, COFINS e IPI (substituídos pela CBS e IS) e ICMS e ISS (substituídos pelo IBS)',
      'Apenas o ICMS será extinto, mantendo PIS, COFINS e ISS',
      'O Vale-Pedágio e a taxa da ANTT serão substituídos pelo IBS'
    ],
    correctIndex: 1,
    explanation: 'Exato! A CBS federal unifica PIS, COFINS e esvazia o IPI, enquanto o IBS subnacional unifica o ICMS estadual e o ISS municipal sob as mesmas regras.'
  },
  {
    id: 8,
    phase: 2,
    question: 'Como funciona HOJE o benefício do Crédito Presumido de 20% do ICMS (Convênio ICMS 106/96) para as transportadoras e o que mudará pós-Reforma?',
    options: [
      'Hoje a transportadora abate 20% do ICMS devido (ex: 12% cai para 9,6%) renunciando aos demais créditos estaduais; pós-Reforma, em 2033, o ICMS acaba e entra a não-cumulatividade plena (crédito amplo sobre todas as despesas e compra imediata de frota)',
      'Hoje a transportadora recebe 20% do valor do caminhão de volta em dinheiro da prefeitura',
      'O Crédito Presumido de 20% do ICMS vai dobrar para 40% em 2033',
      'Hoje a transportadora não pode abater nenhum imposto nem no ICMS nem no PIS/COFINS'
    ],
    correctIndex: 0,
    explanation: 'Correto! Hoje o Convênio 106/96 concede 20% de crédito presumido sobre o ICMS do frete em troca da renúncia a outros créditos estaduais. Com a Reforma (CBS/IBS), esse mecanismo dá lugar ao crédito financeiro amplo sobre todos os insumos, despesas operacionais e ativo imobilizado imediato.'
  },
  {
    id: 9,
    phase: 2,
    question: 'Na contratação de um Caminhoneiro Autônomo (TAC - pessoa física), como funcionam os créditos fiscais para a transportadora hoje (Lucro Real) e após a Reforma Tributária?',
    options: [
      'A transportadora é proibida de contratar caminhoneiro autônomo após a Reforma Tributária',
      'Hoje gera crédito presumido de PIS/COFINS (6,9375% no Lucro Real); após a Reforma, o TAC até R$ 202,5 mil/ano é isento como Nanoempreendedor especial (regra dos 20%) e a transportadora contratante mantém direito a crédito presumido de IBS e CBS',
      'O motorista autônomo terá que pagar 28,5% de imposto em dinheiro na barreira policial',
      'A transportadora perde 100% dos créditos sempre que contrata um autônomo'
    ],
    correctIndex: 1,
    explanation: 'Perfeito! Na LC 214/2025, apenas 20% da receita bruta do TAC conta para o teto de R$ 40.500 do Nanoempreendedor (permitindo faturar até R$ 202.500/ano isento de IBS/CBS), e a transportadora contratante tem direito a crédito presumido sobre o frete pago a ele!'
  },
  {
    id: 10,
    phase: 2,
    question: 'O que muda na recuperação de créditos de impostos quando uma transportadora compra caminhões e carretas novas (Ativo Imobilizado) após a Reforma Tributária?',
    options: [
      'O crédito que hoje é parcelado em 48 meses (4 anos no CIAP do ICMS) passará a ser INTEGRAL e IMEDIATO no IBS e na CBS, com ressarcimento de saldos credores em 30 a 60 dias',
      'Caminhões novos não darão direito a crédito e pagarão Imposto Seletivo de 35%',
      'O prazo de recuperação aumentará de 48 meses para 120 meses',
      'Não há nenhuma mudança na compra de caminhões novos'
    ],
    correctIndex: 0,
    explanation: 'Exato! Além de caminhões e ônibus serem ISENTOS do Imposto Seletivo, o crédito de IBS e CBS na compra de frota deixa de ser parcelado em 48 meses e passa a ser integral e imediato!'
  },
  {
    id: 11,
    phase: 2,
    question: 'Como ficaram os produtos do agronegócio (soja, milho, fertilizantes, defensivos) e o frete rodoviário destinado à exportação na Reforma Tributária?',
    options: [
      'Soja e fertilizantes pagarão Imposto Seletivo e o frete até o porto será sobretaxado',
      'Insumos e produtos agropecuários têm redução de 60% na alíquota (cesta básica tem alíquota zero), e o frete de cargas destinadas à exportação (inclusive o trecho interno até os portos) é desonerado, mantendo 100% dos créditos da transportadora',
      'Todos os alimentos e fretes de exportação pagarão 28,55% sem direito a crédito',
      'Apenas o óleo de soja ficou com alíquota zero, enquanto as carnes e o arroz foram tributados em 100%'
    ],
    correctIndex: 1,
    explanation: 'Corretíssimo! Carnes, arroz e feijão têm alíquota zero na Cesta Básica Nacional; insumos e grãos têm redução de 60%; e o frete de exportação (inclusive o trecho interno até os portos) foi desonerado mantendo 100% dos créditos de diesel e insumos da transportadora!'
  },
  {
    id: 12,
    phase: 2,
    question: 'Qual é o cronograma correto de transição dos novos tributos entre 2026 e 2033?',
    options: [
      'Tudo muda de uma só vez em 1º de janeiro de 2026 com a extinção imediata do ICMS',
      '2026: Alíquota-teste de 0,9% (CBS) e 0,1% (IBS); 2027: Extinção do PIS/COFINS e entrada plena da CBS e do IS; 2029 a 2032: Redução gradual do ICMS/ISS; 2033: Extinção do ICMS/ISS e vigência 100% do novo sistema',
      'A transição começa apenas em 2033 e termina em 2078 para as empresas emitirem notas',
      'O PIS e a COFINS só acabam em 2050'
    ],
    correctIndex: 1,
    explanation: 'Perfeito! 2026 é o ano-teste (0,9% CBS + 0,1% IBS compensáveis); em 2027 extinguem-se PIS e COFINS; de 2029 a 2032 reduz-se gradualmente o ICMS/ISS; e em 2033 o novo sistema entra 100% em vigor (sendo 2029–2078 apenas a transição federativa de partilha entre estados).'
  }
];

export interface VehicleCapacity {
  name: string;
  capacity: number;
  pbt: number;
  tara: number;
}

export const VEHICLE_CAPACITIES: Record<string, VehicleCapacity> = {
  truck_3_eixos: { name: 'Caminhão Truck 6x2 (3 eixos rígido)', capacity: 14.5, pbt: 23.0, tara: 8.5 },
  toco_carreta_2_eixos: { name: 'Cavalo Toco + Carreta 2 eixos (4 eixos)', capacity: 20.0, pbt: 33.0, tara: 13.0 },
  toco_carreta_ls: { name: 'Cavalo Toco + Carreta LS 3 eixos (5 eixos)', capacity: 26.0, pbt: 41.5, tara: 15.5 },
  toco_vanderleia: { name: 'Cavalo Toco + Carreta Vanderleia (5 eixos)', capacity: 29.5, pbt: 46.0, tara: 16.5 },
  carreta_simples: { name: 'Cavalo Trucado + Carreta LS 3 eixos (6 eixos)', capacity: 32.0, pbt: 48.5, tara: 16.5 },
  ls_4_eixos: { name: 'Cavalo Trucado + Carreta LS 4 eixos (7 eixos)', capacity: 40.0, pbt: 58.5, tara: 18.5 },
  bitrem: { name: 'Bitrem 7 eixos (Quinta-Roda)', capacity: 37.5, pbt: 57.0, tara: 19.5 },
  bitrem_9_eixos: { name: 'Bitrem 9 eixos (Quinta-Roda • 2x 3 eixos)', capacity: 49.5, pbt: 74.0, tara: 24.5 },
  rodotrem: { name: 'Rodotrem 9 eixos Graneleiro (c/ Dolly)', capacity: 49.5, pbt: 74.0, tara: 24.5 },
  rodocacamba: { name: 'Rodocaçamba 9 eixos Basculante (c/ Dolly)', capacity: 47.5, pbt: 74.0, tara: 26.5 },
};
