/* Rótulos e formatação — o banco guarda códigos curtos ('em_apuracao'), a
   tela mostra frases. Todo texto que depende de um código mora aqui. */

export const STATUS = {
  recebida: {
    rotulo: 'Recebida',
    tom: 'neutro',
    paraDenunciante: 'Sua denúncia chegou e está na fila para a primeira análise da comissão.',
  },
  em_analise: {
    rotulo: 'Em análise',
    tom: 'info',
    paraDenunciante: 'A comissão está lendo o relato e decidindo como apurar.',
  },
  em_apuracao: {
    rotulo: 'Em apuração',
    tom: 'info',
    paraDenunciante: 'Os fatos estão sendo apurados. Você pode mandar novas informações a qualquer momento.',
  },
  aguardando_info: {
    rotulo: 'Aguardando você',
    comissao: 'Aguardando denunciante', // o mesmo estado, visto do painel
    tom: 'alerta',
    paraDenunciante: 'A comissão precisa de mais informações. Veja a mensagem abaixo e responda por aqui.',
  },
  concluida: {
    rotulo: 'Concluída',
    tom: 'ok',
    paraDenunciante: 'A apuração terminou. A resposta da comissão está logo abaixo.',
  },
  arquivada: {
    rotulo: 'Arquivada',
    tom: 'neutro',
    paraDenunciante: 'A denúncia foi arquivada. O motivo está logo abaixo.',
  },
}

/** Rótulo da situação no painel da comissão ("você" ali seria a comissão). */
export const rotuloStatus = (s) => STATUS[s]?.comissao || STATUS[s]?.rotulo || s

export const STATUS_ABERTOS = ['recebida', 'em_analise', 'em_apuracao', 'aguardando_info']
export const estaAberta = (d) => STATUS_ABERTOS.includes(d.status)

export const RESULTADOS = {
  procedente: 'Procedente',
  parcialmente_procedente: 'Parcialmente procedente',
  improcedente: 'Improcedente',
  sem_elementos: 'Sem elementos suficientes para concluir',
}

export const GRAVIDADES = {
  baixa: { rotulo: 'Baixa', tom: 'neutro' },
  media: { rotulo: 'Média', tom: 'info' },
  alta: { rotulo: 'Alta', tom: 'alerta' },
  critica: { rotulo: 'Crítica', tom: 'erro' },
}

/* Tipos de medida na ordem de prioridade da NR-01 1.4.1 "g", seguidos das
   medidas que não são de controle de risco. */
export const TIPOS_MEDIDA = {
  eliminacao: 'Eliminação do fator de risco',
  protecao_coletiva: 'Proteção coletiva',
  administrativa: 'Administrativa / organização do trabalho',
  protecao_individual: 'Proteção individual (EPI)',
  disciplinar: 'Disciplinar',
  acolhimento: 'Acolhimento / apoio à vítima',
  outra: 'Outra',
}

export const SITUACOES_MEDIDA = {
  planejada: 'Planejada',
  em_andamento: 'Em andamento',
  concluida: 'Concluída',
  cancelada: 'Cancelada',
}

export const ACONTECENDO = { sim: 'Sim, ainda acontece', nao: 'Não, já parou', nao_sei: 'Não sei' }
export const FREQUENCIAS = {
  uma_vez: 'Uma vez',
  algumas_vezes: 'Algumas vezes',
  frequente: 'Com frequência',
  nao_sei: 'Não sei dizer',
}
export const VINCULOS = {
  nao_informado: 'Prefiro não informar',
  empregado: 'Empregado(a)',
  terceirizado: 'Terceirizado(a) / prestador(a)',
  estagiario: 'Estagiário(a) / aprendiz',
  ex_empregado: 'Ex-empregado(a)',
  visitante: 'Visitante / cliente / fornecedor',
}
export const JA_RELATOU = [
  'Não',
  'Sim, à liderança / supervisão',
  'Sim, ao RH',
  'Sim, à CIPA',
  'Sim, ao SESMT / segurança do trabalho',
  'Sim, a outra pessoa',
]

/* Ações da trilha de auditoria, para leitura humana. */
export const ACOES = {
  recebida: 'Denúncia recebida',
  visualizou: 'Abriu a denúncia',
  alterou: 'Alterou a triagem',
  mensagem_comissao: 'Enviou mensagem ao denunciante',
  mensagem_denunciante: 'Denunciante enviou mensagem',
  anexo_denunciante: 'Denunciante enviou anexo',
  nota_interna: 'Escreveu nota interna',
  medida_criada: 'Registrou medida',
  medida_alterada: 'Atualizou medida',
  declarou_impedimento: 'Declarou-se impedido(a)',
  afastou_membro: 'Afastou membro da apuração',
  membro_insert: 'Cadastrou membro',
  membro_update: 'Alterou membro',
  membro_delete: 'Removeu membro',
  expurgo: 'Executou expurgo (LGPD)',
  exemplos: 'Gerou dados de exemplo (demonstração)',
  empresa_insert: 'Cadastrou a empresa',
  empresa_update: 'Alterou dados da empresa',
  empresa_encerrada: 'Encerrou o vínculo com a empresa',
  empresa_reativada: 'Reativou o vínculo com a empresa',
  aviso_email: 'Aviso de denúncia nova enviado por e-mail',
  aviso_email_falhou: 'Aviso por e-mail falhou',
  aviso_insert: 'Incluiu e-mail de aviso',
  aviso_update: 'Alterou e-mail de aviso',
  aviso_delete: 'Removeu e-mail de aviso',
}

export const CAMPOS_TRIAGEM = {
  status: 'Situação',
  gravidade: 'Gravidade',
  perigo: 'Classificação do perigo',
  encaminhar_pgr: 'Encaminhar ao PGR',
  responsavel_id: 'Responsável',
  resultado: 'Resultado',
  resposta_final: 'Resposta final',
  prazo_conclusao: 'Prazo de conclusão',
  empresa_id: 'Empresa',
}

/* ------------------------------------------------------------------ datas */
const fmtData = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
const fmtDataHora = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
})
const fmtMes = new Intl.DateTimeFormat('pt-BR', { month: 'short', year: '2-digit' })

export const data = (iso) => (iso ? fmtData.format(new Date(iso)) : '—')
export const dataHora = (iso) => (iso ? fmtDataHora.format(new Date(iso)) : '—')
export const mesCurto = (d) => fmtMes.format(d).replace('.', '').replace(' de ', '/')

/** "2026-09-27" a partir de uma data (fuso local), para <input type="date">. */
export const paraInputData = (d) => {
  const x = new Date(d)
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
}

const DIA = 864e5

/** Semáforo do prazo que importa agora: triagem enquanto não triada,
    conclusão depois disso. */
export function situacaoPrazo(d, agora = Date.now()) {
  if (!estaAberta(d)) return { nivel: 'encerrada', texto: `Encerrada em ${data(d.concluida_em)}` }
  const naTriagem = d.status === 'recebida'
  const prazo = new Date(naTriagem ? d.prazo_triagem : d.prazo_conclusao).getTime()
  const qual = naTriagem ? 'triagem' : 'conclusão'
  const dias = Math.ceil((prazo - agora) / DIA)
  if (prazo < agora) {
    const atraso = Math.max(1, Math.floor((agora - prazo) / DIA))
    return { nivel: 'vencido', texto: `${qual} vencida há ${atraso} dia${atraso > 1 ? 's' : ''}` }
  }
  if (dias <= 2) {
    const horas = Math.max(1, Math.round((prazo - agora) / 36e5))
    return { nivel: 'atencao', texto: horas < 24 ? `${qual} em ${horas}h` : `${qual} em ${dias} dias` }
  }
  return { nivel: 'ok', texto: `${qual} até ${data(prazo)}` }
}

export const diasEntre = (a, b) => (new Date(b) - new Date(a)) / DIA

/** Aceita erro do Supabase, Error ou texto, e devolve uma frase. */
export function mensagemDeErro(e) {
  if (!e) return 'Erro desconhecido.'
  if (typeof e === 'string') return e
  const m = e.message || e.error_description || String(e)
  if (/Failed to fetch|NetworkError|Load failed/i.test(m)) return 'Sem conexão com o servidor. Verifique a internet e tente de novo.'
  if (/Invalid login credentials/i.test(m)) return 'E-mail ou senha incorretos.'
  if (/empresas_slug_key/i.test(m)) return 'Já existe uma empresa com esse link.'
  if (/empresas_slug_check|empresas_nome_check/i.test(m)) return 'Confira o nome e o link: o link aceita só letras minúsculas, números e hífen.'
  if (/comissao_admin_sem_empresa/i.test(m)) return 'Administrador é da administração do canal: deixe a empresa em branco.'
  if (/row-level security|permission denied/i.test(m)) return 'Sem permissão para esta ação.'
  return m
}
