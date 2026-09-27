/* =============================================================================
   Configuração do canal — tudo o que muda de uma empresa para outra mora aqui.

   Antes de publicar, troque pelo menos `empresa` e `unidades`. O resto já vem
   com valores que atendem a NR-01 e a Lei 14.457/2022, mas são decisões da
   empresa (a lei não fixa prazo nenhum, por exemplo) e podem ser ajustadas.

   ATENÇÃO — as categorias existem em DOIS lugares:
     1. aqui, com o texto que o trabalhador lê;
     2. em supabase/schema.sql, na restrição `denuncias_categoria_valida` e na
        função `canal_prazos`, que é quem calcula o prazo no servidor.
   Criou, renomeou ou apagou categoria? Mude os dois e rode `npm run testar` —
   o script scripts/conferir-categorias.mjs acusa se ficarem diferentes.
   ========================================================================== */

export const empresa = {
  nome: 'Empresa Exemplo Ltda.',
  nomeCurto: 'Empresa Exemplo',
  /* Quem recebe e apura as denúncias. Aparece na página inicial e na política
     do canal — o trabalhador precisa saber para quem está falando. */
  comissao: 'Comissão de Ética e Apuração',
  /* Um contato fora do sistema, para quem não conseguir usar o site. Deixe
     vazio ('') para não mostrar. */
  contatoAlternativo: '',
  /* Por quanto tempo o relato completo é guardado depois de encerrado. A
     função de expurgo (painel > Membros) apaga o texto e a identificação
     passado esse prazo e mantém só a estatística. Defina com o jurídico. */
  retencaoAnos: 5,
}

/* Onde o fato aconteceu. Uma lista curta e reconhecível pelo trabalhador —
   nome de estabelecimento/unidade, não código interno. */
export const unidades = [
  'Matriz',
  'Filial',
  'Obra / frente de trabalho externa',
  'Outro local',
]

/* Prazos da política interna, em dias corridos.
   Nem a NR-01 nem a Lei 14.457/2022 fixam prazo: estes são os valores
   padrão do canal. O prazo de verdade é calculado no banco (função
   `canal_prazos` em supabase/schema.sql) — mudou aqui, mude lá também. */
export const prazos = {
  triagem: 5,           // da chegada até a primeira análise
  triagemUrgente: 1,    // risco grave e iminente e violência: 24 horas
  conclusao: 30,        // da chegada até a resposta final ao denunciante
  conclusaoUrgente: 15,
}

/* -----------------------------------------------------------------------------
   Categorias

   `grupo` separa o que vai para cada frente de trabalho:
     psicossocial — fatores de risco psicossociais (NR-01 1.5.3.1.4 e 1.5.3.2.1)
                    e assédio/violência (Lei 14.457/2022)
     seguranca    — riscos de acidente e condições de trabalho (NR-01 1.5.3.2,
                    1.5.5.5)
     conduta      — ética e integridade, fora do PGR

   `perigo` é a sugestão de classificação para o inventário de riscos do PGR.
   A comissão pode mudar na triagem.

   `urgente` encurta os prazos (ver `prazos` acima) e mostra o aviso de
   emergência já na escolha da categoria.
   -------------------------------------------------------------------------- */
export const categorias = [
  {
    id: 'assedio_moral',
    titulo: 'Assédio moral',
    resumo: 'Humilhação, perseguição, isolamento ou ameaça repetidos.',
    exemplos: [
      'xingamentos, gritos ou piadas humilhantes na frente dos colegas',
      'ser isolado, ignorado ou tirado das atividades de propósito',
      'cobranças com ameaça de demissão ou punição fora do normal',
      'tarefas impossíveis ou humilhantes dadas para constranger',
    ],
    grupo: 'psicossocial',
    perigo: 'psicossocial',
    urgente: false,
  },
  {
    id: 'assedio_sexual',
    titulo: 'Assédio sexual',
    resumo: 'Investida, insinuação, contato ou chantagem de cunho sexual.',
    exemplos: [
      'comentários, piadas ou mensagens de cunho sexual que incomodam',
      'toques, abraços ou aproximação física não desejados',
      'convites insistentes depois de uma recusa',
      'promessa de vantagem ou ameaça em troca de favor sexual',
    ],
    grupo: 'psicossocial',
    perigo: 'psicossocial',
    urgente: false,
  },
  {
    id: 'violencia',
    titulo: 'Violência ou ameaça',
    resumo: 'Agressão física ou verbal, intimidação, ameaça à integridade.',
    exemplos: [
      'empurrão, tapa ou qualquer agressão física',
      'ameaça de agressão, dentro ou fora do horário',
      'intimidação com objeto, veículo ou ferramenta',
    ],
    grupo: 'psicossocial',
    perigo: 'psicossocial',
    urgente: true,
  },
  {
    id: 'discriminacao',
    titulo: 'Discriminação',
    resumo: 'Tratamento diferente por raça, gênero, religião, idade, deficiência…',
    exemplos: [
      'ofensas ou piadas por cor, origem, religião ou orientação sexual',
      'ser preterido em promoção, escala ou tarefa por ser mulher, idoso, PcD…',
      'falta de adaptação para pessoa com deficiência',
    ],
    grupo: 'psicossocial',
    perigo: 'psicossocial',
    urgente: false,
  },
  {
    id: 'sobrecarga',
    titulo: 'Sobrecarga e pressão no trabalho',
    resumo: 'Metas abusivas, jornada excessiva, falta de pausa ou de apoio.',
    exemplos: [
      'jornada estendida com frequência, sem folga ou descanso',
      'metas que não dá para cumprir, com pressão constante',
      'falta de pessoal, de treinamento ou de apoio para fazer o serviço',
      'ordens contraditórias, falta de clareza sobre o que fazer',
    ],
    grupo: 'psicossocial',
    perigo: 'psicossocial',
    urgente: false,
  },
  {
    id: 'risco_grave',
    titulo: 'Risco grave e iminente',
    resumo: 'Situação que pode causar acidente grave ou morte a qualquer momento.',
    exemplos: [
      'máquina ou equipamento sem proteção operando',
      'trabalho em altura, espaço confinado ou eletricidade sem a liberação',
      'estrutura, talude ou carga com risco de queda',
      'vazamento de produto perigoso',
    ],
    grupo: 'seguranca',
    perigo: 'acidente',
    urgente: true,
  },
  {
    id: 'condicao_insegura',
    titulo: 'Condição ou prática insegura',
    resumo: 'Falta de EPI/EPC, procedimento descumprido, ambiente inadequado.',
    exemplos: [
      'EPI não fornecido, vencido ou inadequado',
      'ruído, poeira, calor ou produto químico sem controle',
      'procedimento de segurança ignorado para “ganhar tempo”',
      'posto de trabalho que causa dor ou lesão (postura, peso, repetição)',
    ],
    grupo: 'seguranca',
    perigo: 'acidente',
    urgente: false,
  },
  {
    id: 'acidente_oculto',
    titulo: 'Acidente ou quase acidente não registrado',
    resumo: 'Acidente, incidente ou doença do trabalho que foi escondido.',
    exemplos: [
      'acidente que não foi comunicado (sem CAT) ou foi “abafado”',
      'quase acidente que ninguém analisou',
      'pressão para não se afastar ou não relatar lesão',
    ],
    grupo: 'seguranca',
    perigo: 'acidente',
    urgente: false,
  },
  {
    id: 'conduta',
    titulo: 'Conduta antiética ou irregularidade',
    resumo: 'Fraude, desvio, favorecimento, descumprimento de regra interna.',
    exemplos: [
      'desvio de material, combustível ou dinheiro',
      'favorecimento em contratação ou compra',
      'registro falso de ponto, inspeção ou treinamento',
    ],
    grupo: 'conduta',
    perigo: 'nao_aplica',
    urgente: false,
  },
  {
    id: 'outro',
    titulo: 'Outro assunto',
    resumo: 'Algo que não se encaixa acima, mas que precisa ser apurado.',
    exemplos: [],
    grupo: 'conduta',
    perigo: 'nao_aplica',
    urgente: false,
  },
]

export const categoriaPorId = (id) => categorias.find((c) => c.id === id)

export const grupos = {
  psicossocial: 'Assédio, violência e riscos psicossociais',
  seguranca: 'Segurança e riscos de acidente',
  conduta: 'Ética e integridade',
}

/* Classificação do perigo para o inventário de riscos do PGR
   (NR-01 1.5.3.1.4 — os tipos de risco que o gerenciamento deve abranger). */
export const perigos = {
  psicossocial: 'Fator de risco psicossocial',
  ergonomico: 'Ergonômico',
  acidente: 'Acidente',
  fisico: 'Físico',
  quimico: 'Químico',
  biologico: 'Biológico',
  nao_aplica: 'Não se aplica ao PGR',
}

/* Contatos de emergência mostrados no canal. São serviços públicos
   nacionais; acrescente os internos (SESMT, brigada, portaria) se quiser. */
export const emergencias = [
  { numero: '192', nome: 'SAMU' },
  { numero: '193', nome: 'Bombeiros' },
  { numero: '190', nome: 'Polícia Militar' },
  { numero: '180', nome: 'Central de Atendimento à Mulher' },
  { numero: '100', nome: 'Disque Direitos Humanos' },
]

/* Senha do painel da comissão no MODO DEMONSTRAÇÃO (sem banco).
   Com o Supabase configurado ela não vale nada: aí cada membro entra com o
   próprio e-mail e senha. */
export const senhaDemo = 'comissao'

/* Anexos: limites aplicados no navegador. O banco repete os mesmos limites
   no bucket (supabase/schema.sql), porque o navegador não é confiável. */
export const anexos = {
  maximo: 5,
  tamanhoMaxMB: 10,
  tipos: ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf'],
}

/* Tempo sem mexer na tela até sair sozinho (minutos). Protege quem acompanha
   a denúncia num celular emprestado e a comissão num computador compartilhado. */
export const inatividadeMin = {
  acompanhamento: 10,
  comissao: 30,
}
