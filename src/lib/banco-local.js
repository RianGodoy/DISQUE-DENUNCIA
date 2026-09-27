import { categoriaPorId, prazos, senhaDemo, unidades } from '../config'
import { gerarCodigo, normalizar, resumo } from './codigos'

/* =============================================================================
   MODO DEMONSTRAÇÃO — o "banco" é o localStorage deste navegador.

   Serve para ver e testar o canal inteiro antes de existir o Supabase: o
   formulário, o acompanhamento e o painel da comissão funcionam de ponta a
   ponta. Mas nada sai deste navegador — a comissão só "recebe" uma denúncia
   se for aberta no mesmo aparelho em que ela foi feita. Por isso a tela
   inteira mostra a faixa de demonstração.

   As regras imitam as de supabase/schema.sql (prazos, impedimento, relato
   imutável, trilha de auditoria, bloqueio por tentativas) para que o que se
   vê aqui seja o que vai acontecer com o banco de verdade.
   ========================================================================== */

const CHAVE = 'canal-denuncia:demo:v1'
const CHAVE_SESSAO = 'canal-denuncia:demo:sessao'
const DIA = 864e5

/* Duas empresas fictícias, para ver os links, as mini-abas por empresa e o
   membro que só enxerga a própria empresa (o RH da Construtora Modelo). */
const EMPRESAS_INICIAIS = [
  { id: 'demo-empresa-exemplo', nome: 'Empresa Exemplo', slug: 'exemplo', unidades: unidades },
  { id: 'demo-empresa-modelo', nome: 'Construtora Modelo', slug: 'construtora-modelo', unidades: ['Canteiro Centro', 'Canteiro Norte', 'Escritório'] },
]

const MEMBROS_INICIAIS = [
  { user_id: 'demo-coord', nome: 'Coordenação do canal', email: 'coordenacao@demo', papel: 'admin', empresa_id: null },
  { user_id: 'demo-rh', nome: 'Representante do RH', email: 'rh@demo', papel: 'membro', empresa_id: null },
  { user_id: 'demo-cipa', nome: 'Representante da CIPA', email: 'cipa@demo', papel: 'membro', empresa_id: null },
  { user_id: 'demo-sesmt', nome: 'Técnico(a) de Segurança do Trabalho', email: 'sesmt@demo', papel: 'membro', empresa_id: null },
  { user_id: 'demo-rh-modelo', nome: 'RH da Construtora Modelo', email: 'rh@construtoramodelo.demo', papel: 'membro', empresa_id: 'demo-empresa-modelo' },
]

const IMUTAVEIS = [
  'protocolo', 'categoria', 'unidade', 'local', 'quando', 'data_fato', 'acontecendo', 'frequencia',
  'descricao', 'envolvidos', 'testemunhas', 'ja_relatou', 'vinculo', 'identificado', 'nome', 'contato',
  'criada_em', 'prazo_triagem',
]
const RASTREADOS = ['status', 'gravidade', 'perigo', 'encaminhar_pgr', 'responsavel_id', 'resultado', 'resposta_final', 'prazo_conclusao', 'empresa_id']

const agora = () => new Date().toISOString()
const uuid = () => crypto.randomUUID()
// um pouco de demora de propósito: o modo demonstração mostra os mesmos
// estados de "carregando" que o site vai ter com o banco de verdade
const espera = (ms = 200) => new Promise((ok) => setTimeout(ok, ms))

function vazio() {
  return {
    denuncias: [], credenciais: {}, mensagens: [], notas: [], medidas: [], anexos: [],
    impedimentos: [], historico: [], seq: 0,
    membros: MEMBROS_INICIAIS.map((m) => ({ ...m, ativo: true, criado_em: agora() })),
    empresas: empresasIniciais(),
    ...avisosIniciais(),
  }
}

const empresasIniciais = () => EMPRESAS_INICIAIS.map((e) => ({ ...e, ativa: true, criada_em: agora() }))

// o mesmo endereço que supabase/schema.sql cadastra
function avisosIniciais() {
  return { avisos: [{ email: 'tiago.godoy@yahoo.com.br', ativo: true, criado_em: agora() }], siteUrl: '' }
}

function ler() {
  try {
    const t = localStorage.getItem(CHAVE)
    if (!t) return vazio()
    // demonstrações gravadas antes do aviso por e-mail e das várias empresas
    const db = { ...avisosIniciais(), ...JSON.parse(t) }
    if (!db.empresas) {
      db.empresas = empresasIniciais()
      for (const d of db.denuncias) d.empresa_id ||= db.empresas[0].id
      for (const m of db.membros) if (m.empresa_id === undefined) m.empresa_id = null
    }
    return db
  } catch {
    return vazio()
  }
}

function gravar(db) {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(db))
  } catch {
    throw new Error(
      'Acabou o espaço do navegador para a demonstração (anexos ocupam muito). ' +
      'Use "Apagar dados da demonstração" no painel da comissão.',
    )
  }
}

function registrar(db, denunciaId, usuarioId, acao, detalhe = {}) {
  db.seq += 1
  db.historico.push({ id: db.seq, denuncia_id: denunciaId, usuario_id: usuarioId, acao, detalhe, criado_em: agora() })
}

function calcularPrazos(categoria, inicio) {
  const urgente = categoriaPorId(categoria)?.urgente
  const t = new Date(inicio).getTime()
  return {
    prazo_triagem: new Date(t + (urgente ? prazos.triagemUrgente : prazos.triagem) * DIA).toISOString(),
    prazo_conclusao: new Date(t + (urgente ? prazos.conclusaoUrgente : prazos.conclusao) * DIA).toISOString(),
  }
}

const membroAtivo = (db, uid) => db.membros.find((m) => m.user_id === uid && m.ativo)
// membro da empresa ou da administração do canal (sem empresa)
const veEmpresa = (m, empresaId) => Boolean(m) && (!m.empresa_id || m.empresa_id === empresaId)
const podeVer = (db, denunciaId, uid) => {
  const d = db.denuncias.find((x) => x.id === denunciaId)
  return Boolean(d) && veEmpresa(membroAtivo(db, uid), d.empresa_id) &&
    !db.impedimentos.some((i) => i.denuncia_id === denunciaId && i.user_id === uid)
}

function exigirVer(db, denunciaId) {
  const uid = usuarioId()
  if (!podeVer(db, denunciaId, uid)) throw new Error('Sem acesso a esta denúncia.')
  return uid
}

/* ============================================================== PÚBLICO */

export async function empresaPublica(slug) {
  await espera(100)
  const e = ler().empresas.find((x) => x.slug === String(slug || '').trim().toLowerCase() && x.ativa)
  return e ? { id: e.id, nome: e.nome, slug: e.slug, unidades: e.unidades } : null
}

/** Só na demonstração: o portal lista as empresas para quem está testando.
    Com banco, a lista de clientes não é pública. */
export async function empresasDemonstracao() {
  return ler().empresas.filter((e) => e.ativa).map(({ id, nome, slug }) => ({ id, nome, slug }))
}

export async function membrosPublicos(empresaId) {
  const db = ler()
  return db.membros
    .filter((m) => m.ativo && veEmpresa(m, empresaId))
    .map((m) => ({ id: m.user_id, nome: m.nome }))
    .sort((a, b) => a.nome.localeCompare(b.nome))
}

function criarDenuncia(db, p, criadaEm = agora()) {
  if (!categoriaPorId(p.categoria)) throw new Error('Escolha o assunto da denúncia.')
  const descricao = String(p.descricao || '').trim()
  if (descricao.length < 20) throw new Error('Descreva o que aconteceu com pelo menos 20 caracteres.')
  if (p.data_fato && p.data_fato > criadaEm.slice(0, 10)) throw new Error('A data do fato não pode estar no futuro.')
  const empresa = db.empresas.find((e) => e.slug === String(p.empresa || '').trim().toLowerCase() && e.ativa)
  if (!empresa) throw new Error('Link de empresa inválido ou desativado. Use o link ou QR code divulgado pela sua empresa.')

  const impedidos = [...new Set(p.impedidos || [])].filter((id) => veEmpresa(membroAtivo(db, id), empresa.id))
  const ativos = db.membros.filter((m) => m.ativo && veEmpresa(m, empresa.id))
  if (impedidos.length && ativos.every((m) => impedidos.includes(m.user_id))) {
    throw new Error('Deixe pelo menos um membro da comissão com acesso à denúncia.')
  }

  let protocolo
  do protocolo = gerarCodigo(8)
  while (db.denuncias.some((d) => d.protocolo === protocolo))

  const identificado = Boolean(p.identificado)
  const limpo = (v) => (String(v ?? '').trim() || null)
  const d = {
    id: uuid(),
    protocolo,
    empresa_id: empresa.id,
    categoria: p.categoria,
    unidade: limpo(p.unidade),
    local: limpo(p.local),
    quando: limpo(p.quando),
    data_fato: p.data_fato || null,
    acontecendo: p.acontecendo || null,
    frequencia: p.frequencia || null,
    descricao,
    envolvidos: limpo(p.envolvidos),
    testemunhas: limpo(p.testemunhas),
    ja_relatou: limpo(p.ja_relatou),
    vinculo: p.vinculo || 'nao_informado',
    identificado,
    nome: identificado ? limpo(p.nome) : null,
    contato: identificado ? limpo(p.contato) : null,
    status: 'recebida',
    gravidade: null,
    perigo: null,
    encaminhar_pgr: false,
    responsavel_id: null,
    resultado: null,
    resposta_final: null,
    criada_em: criadaEm,
    atualizada_em: criadaEm,
    triada_em: null,
    concluida_em: null,
    ...calcularPrazos(p.categoria, criadaEm),
  }
  db.denuncias.push(d)
  for (const id of impedidos) {
    db.impedimentos.push({ denuncia_id: d.id, user_id: id, origem: 'denunciante', motivo: null, criado_em: criadaEm })
  }
  db.seq += 1
  db.historico.push({
    id: db.seq, denuncia_id: d.id, usuario_id: null, acao: 'recebida',
    detalhe: { impedidos: impedidos.length }, criado_em: criadaEm,
  })
  return d
}

export async function registrarDenuncia(p) {
  await espera(500)
  const db = ler()
  const d = criarDenuncia(db, p)
  const senha = gerarCodigo(10)
  db.credenciais[d.id] = { hash: await resumo(senha), tentativas: 0, bloqueada_ate: null }
  simularAviso(db, d)
  gravar(db)
  return { protocolo: d.protocolo, senha }
}

/* Com banco, quem manda o e-mail é o PostgreSQL (canal_avisar_nova). Aqui
   nada sai do navegador: a trilha só registra para quem IRIA, com a mesma
   regra de não avisar membro afastado da denúncia. */
function simularAviso(db, d) {
  const afastados = new Set([
    ...db.impedimentos.filter((i) => i.denuncia_id === d.id)
      .map((i) => db.membros.find((m) => m.user_id === i.user_id)?.email?.toLowerCase()),
    // membro de outra empresa não fica sabendo desta
    ...db.membros.filter((m) => m.empresa_id && m.empresa_id !== d.empresa_id).map((m) => m.email.toLowerCase()),
  ])
  const destinos = db.avisos.filter((a) => a.ativo && !afastados.has(a.email))
  if (destinos.length) registrar(db, d.id, null, 'aviso_email', { destinos: destinos.length, simulado: true })
}

async function autenticar(db, protocolo, senha) {
  const d = db.denuncias.find((x) => x.protocolo === normalizar(protocolo))
  if (!d) throw new Error('Protocolo ou senha incorretos.')
  const c = db.credenciais[d.id]
  if (c.bloqueada_ate && new Date(c.bloqueada_ate) > new Date()) {
    throw new Error('Muitas tentativas erradas. Aguarde 15 minutos e tente de novo.')
  }
  if ((await resumo(normalizar(senha))) !== c.hash) {
    c.tentativas += 1
    if (c.tentativas >= 5) c.bloqueada_ate = new Date(Date.now() + 15 * 60e3).toISOString()
    gravar(db)
    throw new Error('Protocolo ou senha incorretos.')
  }
  c.tentativas = 0
  c.bloqueada_ate = null
  return d
}

export async function consultar(protocolo, senha) {
  await espera()
  const db = ler()
  const d = await autenticar(db, protocolo, senha)
  gravar(db)
  const encerrada = ['concluida', 'arquivada'].includes(d.status)
  return {
    protocolo: d.protocolo,
    empresa: db.empresas.find((e) => e.id === d.empresa_id)?.nome || null,
    empresa_slug: db.empresas.find((e) => e.id === d.empresa_id)?.slug || null,
    categoria: d.categoria,
    unidade: d.unidade,
    status: d.status,
    resultado: encerrada ? d.resultado : null,
    resposta_final: encerrada ? d.resposta_final : null,
    criada_em: d.criada_em,
    triada_em: d.triada_em,
    concluida_em: d.concluida_em,
    prazo_conclusao: d.prazo_conclusao,
    descricao: d.descricao,
    mensagens: db.mensagens
      .filter((m) => m.denuncia_id === d.id)
      .map(({ autor, texto, criada_em }) => ({ autor, texto, criada_em })),
    anexos: db.anexos
      .filter((a) => a.denuncia_id === d.id && a.enviado_por === 'denunciante')
      .map(({ nome, criado_em }) => ({ nome, criado_em })),
  }
}

export async function complementar(protocolo, senha, texto) {
  await espera()
  const db = ler()
  const d = await autenticar(db, protocolo, senha)
  const t = String(texto || '').trim()
  if (!t) throw new Error('Escreva a mensagem.')
  db.mensagens.push({ id: uuid(), denuncia_id: d.id, autor: 'denunciante', autor_id: null, texto: t, lida: false, criada_em: agora() })
  registrar(db, d.id, null, 'mensagem_denunciante')
  if (d.status === 'aguardando_info') {
    registrar(db, d.id, null, 'alterou', { status: { de: d.status, para: 'em_apuracao' } })
    d.status = 'em_apuracao'
    d.atualizada_em = agora()
  }
  gravar(db)
}

const paraDataUrl = (blob) =>
  new Promise((ok, falha) => {
    const r = new FileReader()
    r.onload = () => ok(r.result)
    r.onerror = () => falha(new Error('Não foi possível ler o arquivo.'))
    r.readAsDataURL(blob)
  })

export async function enviarAnexo(protocolo, senha, preparado) {
  const db = ler()
  const d = await autenticar(db, protocolo, senha)
  const qtd = db.anexos.filter((a) => a.denuncia_id === d.id).length
  if (qtd >= 20) throw new Error('Limite de anexos desta denúncia atingido.')
  const ext = preparado.tipo === 'application/pdf' ? 'pdf' : 'jpg'
  const nome = `anexo-${qtd + 1}.${ext}`
  db.anexos.push({
    id: uuid(), denuncia_id: d.id, caminho: `${d.protocolo}/${uuid()}.${ext}`, nome,
    tipo: preparado.tipo, tamanho: preparado.tamanho, enviado_por: 'denunciante', criado_em: agora(),
    dados: await paraDataUrl(preparado.blob),
  })
  registrar(db, d.id, null, 'anexo_denunciante', { nome })
  gravar(db)
  return { nome }
}

/* ============================================================== COMISSÃO */

const ouvintes = new Set()
const avisar = () => sessao().then((s) => ouvintes.forEach((f) => f(s)))

function usuarioId() {
  try {
    return sessionStorage.getItem(CHAVE_SESSAO)
  } catch {
    return null
  }
}

export async function sessao() {
  const uid = usuarioId()
  if (!uid) return null
  const m = membroAtivo(ler(), uid)
  return m ? { usuario: { id: uid, email: m.email }, membro: m } : null
}

export function aoMudarSessao(fn) {
  ouvintes.add(fn)
  return () => ouvintes.delete(fn)
}

/** No modo demonstração se entra escolhendo QUAL membro ser — é assim que dá
    para ver o impedimento funcionando (o membro citado não enxerga a denúncia). */
export async function entrar(membroId, senha) {
  await espera()
  if (senha !== senhaDemo) throw new Error('Senha incorreta.')
  const m = membroAtivo(ler(), membroId)
  if (!m) throw new Error('Membro inativo ou inexistente.')
  sessionStorage.setItem(CHAVE_SESSAO, m.user_id)
  await avisar()
}

export async function sair() {
  try {
    sessionStorage.removeItem(CHAVE_SESSAO)
  } catch { /* nada */ }
  await avisar()
}

export async function listarDenuncias() {
  await espera()
  const db = ler()
  const uid = usuarioId()
  return db.denuncias
    .filter((d) => podeVer(db, d.id, uid))
    .map((d) => ({
      ...d,
      nao_lidas: db.mensagens.filter((m) => m.denuncia_id === d.id && m.autor === 'denunciante' && !m.lida).length,
    }))
    .sort((a, b) => b.criada_em.localeCompare(a.criada_em))
}

export async function abrirDenuncia(id, registrarAcesso = true) {
  await espera()
  const db = ler()
  const uid = exigirVer(db, id)
  const naoLidas = db.mensagens.filter((m) => m.denuncia_id === id && m.autor === 'denunciante' && !m.lida)
  if (registrarAcesso) {
    registrar(db, id, uid, 'visualizou')
    naoLidas.forEach((m) => { m.lida = true })
    gravar(db)
  }
  const deste = (lista) => lista.filter((x) => x.denuncia_id === id)
  return {
    denuncia: db.denuncias.find((d) => d.id === id),
    mensagens: deste(db.mensagens).map((m) => ({ ...m, nova: naoLidas.includes(m) })),
    notas: deste(db.notas),
    medidas: deste(db.medidas),
    anexos: deste(db.anexos).map(({ dados, ...a }) => a),
    impedimentos: deste(db.impedimentos),
    historico: deste(db.historico).sort((a, b) => b.id - a.id),
  }
}

export async function atualizarDenuncia(id, campos) {
  await espera()
  const db = ler()
  const uid = exigirVer(db, id)
  const d = db.denuncias.find((x) => x.id === id)
  if (Object.keys(campos).some((c) => IMUTAVEIS.includes(c))) {
    throw new Error('O relato original da denúncia não pode ser alterado.')
  }
  const novo = { ...d, ...campos }
  if (novo.status === 'concluida' && (!novo.resultado || String(novo.resposta_final || '').trim().length < 10)) {
    throw new Error('Para concluir, informe o resultado e a resposta ao denunciante.')
  }
  if (novo.status === 'arquivada' && String(novo.resposta_final || '').trim().length < 10) {
    throw new Error('Para arquivar, explique o motivo na resposta ao denunciante.')
  }
  const mudou = {}
  for (const c of RASTREADOS) {
    if ((d[c] ?? null) !== (novo[c] ?? null)) mudou[c] = { de: d[c] ?? null, para: novo[c] ?? null }
  }
  if (novo.status !== 'recebida' && !d.triada_em) novo.triada_em = agora()
  const encerra = ['concluida', 'arquivada']
  if (encerra.includes(novo.status) && !encerra.includes(d.status)) novo.concluida_em = agora()
  else if (!encerra.includes(novo.status)) novo.concluida_em = null
  novo.atualizada_em = agora()
  Object.assign(d, novo)
  if (Object.keys(mudou).length) registrar(db, id, uid, 'alterou', mudou)
  gravar(db)
  return d
}

export async function enviarMensagem(id, texto) {
  const db = ler()
  const uid = exigirVer(db, id)
  const t = String(texto || '').trim()
  if (!t) throw new Error('Escreva a mensagem.')
  db.mensagens.push({ id: uuid(), denuncia_id: id, autor: 'comissao', autor_id: uid, texto: t, lida: false, criada_em: agora() })
  registrar(db, id, uid, 'mensagem_comissao')
  db.denuncias.find((x) => x.id === id).atualizada_em = agora()
  gravar(db)
}

export async function adicionarNota(id, texto) {
  const db = ler()
  const uid = exigirVer(db, id)
  const t = String(texto || '').trim()
  if (!t) throw new Error('Escreva a nota.')
  db.notas.push({ id: uuid(), denuncia_id: id, autor_id: uid, texto: t, criada_em: agora() })
  registrar(db, id, uid, 'nota_interna')
  gravar(db)
}

export async function criarMedida(id, m) {
  const db = ler()
  const uid = exigirVer(db, id)
  if (String(m.descricao || '').trim().length < 3) throw new Error('Descreva a medida.')
  db.medidas.push({
    id: uuid(), denuncia_id: id, tipo: m.tipo, descricao: m.descricao.trim(),
    responsavel: m.responsavel?.trim() || null, prazo: m.prazo || null,
    situacao: 'planejada', criada_em: agora(), concluida_em: null,
  })
  registrar(db, id, uid, 'medida_criada', { tipo: m.tipo, descricao: m.descricao.trim() })
  gravar(db)
}

export async function atualizarMedida(medidaId, campos) {
  const db = ler()
  const m = db.medidas.find((x) => x.id === medidaId)
  const uid = exigirVer(db, m.denuncia_id)
  if (campos.situacao && campos.situacao !== m.situacao) {
    registrar(db, m.denuncia_id, uid, 'medida_alterada', { descricao: m.descricao, de: m.situacao, para: campos.situacao })
    m.concluida_em = campos.situacao === 'concluida' ? agora() : null
  }
  Object.assign(m, campos)
  gravar(db)
}

export async function urlAnexo(anexo) {
  const db = ler()
  exigirVer(db, anexo.denuncia_id)
  return db.anexos.find((a) => a.id === anexo.id)?.dados || null
}

export async function declararImpedimento(id, motivo) {
  const db = ler()
  const uid = exigirVer(db, id)
  registrar(db, id, uid, 'declarou_impedimento', { motivo })
  db.impedimentos.push({ denuncia_id: id, user_id: uid, origem: 'declarado', motivo: motivo?.trim() || null, criado_em: agora() })
  gravar(db)
}

export async function afastarMembro(id, membroId, motivo) {
  const db = ler()
  const uid = exigirVer(db, id)
  if (membroAtivo(db, uid)?.papel !== 'admin') throw new Error('Só o administrador afasta membros.')
  if (membroId === uid) throw new Error('Para se afastar, use "Declarar impedimento".')
  if (!db.impedimentos.some((i) => i.denuncia_id === id && i.user_id === membroId)) {
    db.impedimentos.push({ denuncia_id: id, user_id: membroId, origem: 'admin', motivo: motivo?.trim() || null, criado_em: agora() })
  }
  registrar(db, id, uid, 'afastou_membro', { membro: db.membros.find((m) => m.user_id === membroId)?.nome, motivo })
  gravar(db)
}

export async function revogarImpedimento(id, membroId) {
  const db = ler()
  const uid = exigirVer(db, id)
  if (membroAtivo(db, uid)?.papel !== 'admin') throw new Error('Só o administrador revoga afastamentos.')
  const i = db.impedimentos.find((x) => x.denuncia_id === id && x.user_id === membroId)
  if (i?.origem === 'denunciante') throw new Error('O afastamento pedido pelo denunciante não pode ser revogado.')
  db.impedimentos = db.impedimentos.filter((x) => x !== i)
  gravar(db)
}

export async function listarMembros() {
  await espera(100)
  return ler().membros.slice().sort((a, b) => a.nome.localeCompare(b.nome))
}

function exigirAdmin(db) {
  const uid = usuarioId()
  if (membroAtivo(db, uid)?.papel !== 'admin') throw new Error('Só o administrador pode fazer isso.')
  return uid
}

const ADMIN_SEM_EMPRESA = 'Administrador é da administração do canal: deixe a empresa em branco.'
const nomeEmpresa = (db, id) => db.empresas.find((e) => e.id === id)?.nome || null

export async function adicionarMembro({ email, nome, papel, empresaId = null }) {
  const db = ler()
  const uid = exigirAdmin(db)
  if (String(nome || '').trim().length < 2) throw new Error('Informe o nome.')
  if (papel === 'admin' && empresaId) throw new Error(ADMIN_SEM_EMPRESA)
  const m = {
    user_id: `demo-${uuid().slice(0, 8)}`, nome: nome.trim(), email: email.trim().toLowerCase(), papel,
    empresa_id: empresaId || null, ativo: true, criado_em: agora(),
  }
  db.membros.push(m)
  registrar(db, null, uid, 'membro_insert', { nome: m.nome, papel, ativo: true, empresa: nomeEmpresa(db, m.empresa_id) })
  gravar(db)
}

export async function atualizarMembro(userId, campos) {
  const db = ler()
  const uid = exigirAdmin(db)
  const m = db.membros.find((x) => x.user_id === userId)
  const novo = { ...m, ...campos }
  if (novo.papel === 'admin' && novo.empresa_id) throw new Error(ADMIN_SEM_EMPRESA)
  Object.assign(m, campos)
  registrar(db, null, uid, 'membro_update', { nome: m.nome, papel: m.papel, ativo: m.ativo, empresa: nomeEmpresa(db, m.empresa_id) })
  gravar(db)
}

export async function listarEmpresas() {
  await espera(100)
  const db = ler()
  const eu = membroAtivo(db, usuarioId())
  return db.empresas.filter((e) => veEmpresa(eu, e.id)).sort((a, b) => a.nome.localeCompare(b.nome))
}

export async function salvarEmpresa({ id, nome, slug, unidades: listaUnidades, ativa = true }) {
  const db = ler()
  const uid = exigirAdmin(db)
  const n = String(nome || '').trim()
  if (n.length < 2) throw new Error('Informe o nome da empresa.')
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug || '') || slug.length < 2) {
    throw new Error('Link inválido: use só letras minúsculas, números e hífen.')
  }
  if (db.empresas.some((e) => e.slug === slug && e.id !== id)) throw new Error('Já existe uma empresa com esse link.')
  const dados = { nome: n, slug, unidades: (listaUnidades || []).map((u) => u.trim()).filter(Boolean), ativa }
  let e = db.empresas.find((x) => x.id === id)
  if (e) Object.assign(e, dados)
  else db.empresas.push((e = { id: `demo-${uuid().slice(0, 8)}`, ...dados, criada_em: agora() }))
  registrar(db, null, uid, id ? 'empresa_update' : 'empresa_insert', { nome: e.nome, slug: e.slug, ativa: e.ativa })
  gravar(db)
  return e
}

export async function historicoGeral() {
  await espera()
  const db = ler()
  const uid = usuarioId()
  if (membroAtivo(db, uid)?.papel !== 'admin') return []
  return db.historico
    .filter((h) => (h.denuncia_id ? podeVer(db, h.denuncia_id, uid) : true))
    .sort((a, b) => b.id - a.id)
    .slice(0, 500)
    .map((h) => ({ ...h, protocolo: db.denuncias.find((d) => d.id === h.denuncia_id)?.protocolo || null }))
}

export async function expurgar(anos) {
  const db = ler()
  const uid = exigirAdmin(db)
  const limite = Date.now() - anos * 365.25 * DIA
  const alvo = db.denuncias.filter((d) =>
    ['concluida', 'arquivada'].includes(d.status) && d.concluida_em &&
    new Date(d.concluida_em).getTime() < limite && !d.descricao.startsWith('[relato removido'))
  const ids = new Set(alvo.map((d) => d.id))
  for (const d of alvo) {
    Object.assign(d, {
      nome: null, contato: null, identificado: false, envolvidos: null, testemunhas: null,
      descricao: `[relato removido no expurgo de ${new Date().toLocaleDateString('pt-BR')}]`,
    })
  }
  db.mensagens = db.mensagens.filter((m) => !ids.has(m.denuncia_id))
  db.notas = db.notas.filter((n) => !ids.has(n.denuncia_id))
  registrar(db, null, uid, 'expurgo', { anos, denuncias: alvo.length })
  gravar(db)
  return alvo.length
}

export async function listarAvisos() {
  const db = ler()
  exigirAdmin(db)
  return { emails: db.avisos.slice().sort((a, b) => a.email.localeCompare(b.email)), siteUrl: db.siteUrl }
}

export async function salvarAviso(email, ativo = true) {
  const db = ler()
  const uid = exigirAdmin(db)
  const e = String(email || '').trim().toLowerCase()
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) throw new Error('E-mail inválido.')
  const existente = db.avisos.find((a) => a.email === e)
  if (existente) existente.ativo = ativo
  else db.avisos.push({ email: e, ativo, criado_em: agora() })
  registrar(db, null, uid, existente ? 'aviso_update' : 'aviso_insert', { email: e, ativo })
  gravar(db)
}

export async function removerAviso(email) {
  const db = ler()
  const uid = exigirAdmin(db)
  db.avisos = db.avisos.filter((a) => a.email !== email)
  registrar(db, null, uid, 'aviso_delete', { email })
  gravar(db)
}

export async function salvarSiteUrl(url) {
  const db = ler()
  exigirAdmin(db)
  db.siteUrl = String(url || '').trim().replace(/\/+$/, '')
  gravar(db)
}

/* ======================================================== SÓ NA DEMONSTRAÇÃO */

export function limparDemo() {
  try {
    localStorage.removeItem(CHAVE)
  } catch { /* nada */ }
}

const EXEMPLOS = {
  assedio_moral: [
    'O encarregado do turno da noite grita com a equipe e chama as pessoas de incompetentes na frente de todos. Quem reclama vai para as piores tarefas.',
    'Um colega vem sendo deixado de fora das reuniões e das escalas de hora extra desde que voltou do afastamento médico.',
  ],
  assedio_sexual: [
    'Um supervisor manda mensagens de cunho sexual para uma colega fora do horário e comenta o corpo dela no refeitório.',
    'Na portaria, um funcionário insiste em convidar uma terceirizada para sair mesmo depois de ela recusar várias vezes.',
  ],
  violencia: ['Houve uma discussão no pátio e um motorista empurrou outro e ameaçou esperar na saída do turno.'],
  discriminacao: ['As mulheres da equipe não são escaladas para operar o equipamento novo, mesmo com treinamento, e ouvem que "não é serviço de mulher".'],
  sobrecarga: [
    'A equipe de manutenção está fazendo 12 horas por dia há mais de um mês por falta de gente, sem folga no fim de semana.',
    'As metas mudaram e ninguém consegue fazer as pausas; a cobrança é pelo rádio o tempo inteiro, com ameaça de advertência.',
  ],
  risco_grave: ['A correia transportadora da linha 2 está operando sem a proteção lateral, bem na passagem de pedestres.'],
  condicao_insegura: [
    'Os protetores auriculares acabaram no almoxarifado há duas semanas e o pessoal trabalha perto do britador sem proteção.',
    'O extintor do galpão está vencido e bloqueado por paletes. Já foi avisado e ninguém tirou.',
  ],
  acidente_oculto: ['Um ajudante cortou a mão na semana passada e pediram para ele dizer que foi em casa, para não abrir CAT.'],
  conduta: ['Está sumindo combustível do tanque da oficina à noite e o registro de abastecimento não bate com o consumo.'],
  outro: ['O banheiro feminino da área operacional está sem porta há meses e não existe outro por perto.'],
}

const RESPOSTAS = {
  procedente: 'Os fatos foram confirmados na apuração. Foram adotadas as medidas registradas e o caso seguirá acompanhado pela comissão.',
  parcialmente_procedente: 'Parte dos fatos foi confirmada. As medidas cabíveis foram adotadas e a situação será reavaliada em 60 dias.',
  improcedente: 'A apuração ouviu as pessoas indicadas e não confirmou os fatos relatados. Se algo novo acontecer, faça nova denúncia.',
  sem_elementos: 'Não foi possível confirmar nem descartar os fatos com as informações disponíveis. O setor ficará em observação.',
}

/** Preenche a demonstração com ~40 denúncias fictícias nos últimos 12 meses,
    para que a lista, os prazos e os indicadores tenham o que mostrar. */
export async function gerarExemplos() {
  const db = ler()
  const uid = exigirAdmin(db)
  const sorteia = (lista) => lista[Math.floor(Math.random() * lista.length)]
  const pesos = ['assedio_moral', 'assedio_moral', 'assedio_moral', 'sobrecarga', 'sobrecarga', 'sobrecarga',
    'condicao_insegura', 'condicao_insegura', 'assedio_sexual', 'discriminacao', 'violencia', 'risco_grave',
    'acidente_oculto', 'conduta', 'outro']
  const empresas = db.empresas.filter((e) => e.ativa)
  for (let i = 0; i < 40; i++) {
    const idade = Math.floor(Math.random() ** 1.4 * 360) // mais casos recentes
    const criada = new Date(Date.now() - idade * DIA - Math.random() * DIA)
    const categoria = sorteia(pesos)
    const cat = categoriaPorId(categoria)
    // a primeira empresa recebe mais denúncias: os percentuais ficam diferentes
    const empresa = Math.random() < 0.62 ? empresas[0] : sorteia(empresas)
    const membros = db.membros.filter((m) => m.ativo && veEmpresa(m, empresa.id))
    const d = criarDenuncia(db, {
      empresa: empresa.slug,
      categoria,
      unidade: empresa.unidades.length ? sorteia(empresa.unidades) : null,
      descricao: sorteia(EXEMPLOS[categoria]),
      acontecendo: sorteia(['sim', 'sim', 'nao', 'nao_sei']),
      frequencia: sorteia(['uma_vez', 'algumas_vezes', 'frequente']),
    }, criada.toISOString())
    db.credenciais[d.id] = { hash: await resumo(gerarCodigo(10)), tentativas: 0, bloqueada_ate: null }
    d.exemplo = true
    if (idade < 2 && Math.random() < 0.6) continue // recém-chegada, ainda sem triagem
    const passo = (dias) => new Date(criada.getTime() + dias * DIA).toISOString()
    d.triada_em = passo(Math.random() * (cat.urgente ? 1.5 : 7))
    d.gravidade = sorteia(cat.urgente ? ['alta', 'critica'] : ['baixa', 'media', 'media', 'alta'])
    d.perigo = cat.perigo
    d.encaminhar_pgr = cat.perigo !== 'nao_aplica' && Math.random() < 0.7
    d.responsavel_id = sorteia(membros).user_id
    const encerra = idade > 25 ? Math.random() < 0.92 : idade > 10 ? Math.random() < 0.4 : false
    if (encerra) {
      const resultado = sorteia(['procedente', 'procedente', 'parcialmente_procedente', 'improcedente', 'sem_elementos'])
      const arquivada = Math.random() < 0.08
      d.status = arquivada ? 'arquivada' : 'concluida'
      d.resultado = arquivada ? null : resultado
      d.resposta_final = arquivada ? 'Arquivada por duplicidade com denúncia anterior sobre o mesmo fato.' : RESPOSTAS[resultado]
      d.concluida_em = passo(Math.min(idade, 5 + Math.random() * 38))
      if (!arquivada && resultado !== 'improcedente') {
        db.medidas.push({
          id: uuid(), denuncia_id: d.id,
          tipo: cat.grupo === 'seguranca' ? sorteia(['eliminacao', 'protecao_coletiva', 'protecao_individual']) : sorteia(['administrativa', 'disciplinar', 'acolhimento']),
          descricao: cat.grupo === 'seguranca' ? 'Correção da condição e inspeção do setor' : 'Conversa com a liderança, advertência e treinamento da equipe',
          responsavel: 'Gestor da área', prazo: passo(20).slice(0, 10), situacao: 'concluida',
          criada_em: passo(4), concluida_em: passo(18),
        })
      }
    } else {
      d.status = sorteia(['em_analise', 'em_apuracao', 'em_apuracao', 'aguardando_info'])
      if (d.status === 'aguardando_info') {
        db.mensagens.push({
          id: uuid(), denuncia_id: d.id, autor: 'comissao', autor_id: d.responsavel_id,
          texto: 'Recebemos seu relato. Você consegue dizer em que turno isso costuma acontecer?', lida: false, criada_em: passo(2),
        })
      }
    }
    d.atualizada_em = d.concluida_em || d.triada_em
  }
  registrar(db, null, uid, 'exemplos', { quantidade: 40 })
  gravar(db)
}
