import { comissao, publico } from './supabase'
import { normalizar } from './codigos'

/* =============================================================================
   Banco de verdade (Supabase). Mesma interface de banco-local.js — as telas
   não sabem qual dos dois está em uso (ver api.js).

   O lado do denunciante só usa o cliente `publico` e só chama as funções
   `canal_*` do schema: é o banco que confere protocolo e senha, calcula
   prazo e decide quem enxerga o quê. O navegador não decide nada que valha.
   ========================================================================== */

const BUCKET = 'denuncia-anexos'

function exigir({ data, error }) {
  if (error) throw error
  return data
}

/** As funções públicas devolvem {erro} em vez de levantar exceção (ver o
    comentário de canal_autenticar no schema). Aqui vira exceção de novo. */
function semErro(data) {
  if (data && data.erro) throw new Error(data.erro)
  return data
}

/* ============================================================== PÚBLICO */

/** A empresa do link, ou null se o link não existe ou foi desativado. */
export async function empresaPublica(slug) {
  return exigir(await publico.rpc('canal_empresa_publica', { p_slug: slug }))
}

// Com banco, a lista de empresas atendidas não é pública.
export async function empresasDemonstracao() {
  return []
}

export async function membrosPublicos(empresaId) {
  return exigir(await publico.rpc('canal_membros_publicos', { p_empresa: empresaId })) || []
}

export async function registrarDenuncia(p) {
  return exigir(await publico.rpc('canal_registrar_denuncia', { p }))
}

export async function enviarAnexo(protocolo, senha, preparado) {
  const ext = preparado.tipo === 'application/pdf' ? 'pdf' : 'jpg'
  const caminho = `${normalizar(protocolo)}/${crypto.randomUUID()}.${ext}`
  exigir(await publico.storage.from(BUCKET).upload(caminho, preparado.blob, {
    contentType: preparado.tipo,
    upsert: false,
  }))
  return semErro(exigir(await publico.rpc('canal_registrar_anexo', {
    p_protocolo: protocolo, p_senha: senha, p_caminho: caminho, p_tipo: preparado.tipo, p_tamanho: preparado.tamanho,
  })))
}

export async function consultar(protocolo, senha) {
  return semErro(exigir(await publico.rpc('canal_consultar', { p_protocolo: protocolo, p_senha: senha })))
}

export async function complementar(protocolo, senha, texto) {
  semErro(exigir(await publico.rpc('canal_complementar', { p_protocolo: protocolo, p_senha: senha, p_texto: texto })))
}

/* ============================================================== COMISSÃO */

export async function sessao() {
  const { data } = await comissao.auth.getSession()
  const s = data.session
  if (!s) return null
  const membro = exigir(await comissao.from('comissao_membros').select('*').eq('user_id', s.user.id).maybeSingle())
  return { usuario: { id: s.user.id, email: s.user.email }, membro: membro?.ativo ? membro : null }
}

export function aoMudarSessao(fn) {
  const { data } = comissao.auth.onAuthStateChange(() => {
    // Chamar o Supabase de dentro deste callback trava o cliente (limitação
    // documentada do supabase-js). O setTimeout solta a chamada depois.
    setTimeout(() => sessao().then(fn, () => fn(null)), 0)
  })
  return () => data.subscription.unsubscribe()
}

export async function entrar(email, senha) {
  exigir(await comissao.auth.signInWithPassword({ email: email.trim(), password: senha }))
}

export async function sair() {
  await comissao.auth.signOut()
}

async function uid() {
  const { data } = await comissao.auth.getSession()
  return data.session?.user?.id
}

export async function listarDenuncias() {
  const [denuncias, naoLidas] = await Promise.all([
    comissao.from('denuncias').select('*').order('criada_em', { ascending: false }).then(exigir),
    comissao.from('denuncia_mensagens').select('denuncia_id').eq('autor', 'denunciante').eq('lida', false).then(exigir),
  ])
  const conta = {}
  for (const m of naoLidas) conta[m.denuncia_id] = (conta[m.denuncia_id] || 0) + 1
  return denuncias.map((d) => ({ ...d, nao_lidas: conta[d.id] || 0 }))
}

/** `registrarAcesso`: true ao abrir a tela (fica na trilha "abriu a denúncia"
    e as mensagens passam a lidas); false nas recargas depois de cada ação,
    para a trilha não se encher de "abriu" repetido. */
export async function abrirDenuncia(id, registrarAcesso = true) {
  // as mensagens vêm ANTES de canal_abrir, que as marca como lidas — é
  // assim que a tela sabe quais destacar como novas
  const mensagens = exigir(await comissao.from('denuncia_mensagens').select('*').eq('denuncia_id', id).order('criada_em'))
  if (registrarAcesso) exigir(await comissao.rpc('canal_abrir', { p_denuncia: id }))
  const doCaso = (tabela, ordem = 'criada_em', asc = true) =>
    comissao.from(tabela).select('*').eq('denuncia_id', id).order(ordem, { ascending: asc }).then(exigir)
  const [denuncia, notas, medidas, anexos, impedimentos, historico] = await Promise.all([
    comissao.from('denuncias').select('*').eq('id', id).single().then(exigir),
    doCaso('denuncia_notas'),
    doCaso('denuncia_medidas'),
    doCaso('denuncia_anexos', 'criado_em'),
    doCaso('denuncia_impedimentos', 'criado_em'),
    doCaso('denuncia_historico', 'criado_em', false),
  ])
  return {
    denuncia,
    mensagens: mensagens.map((m) => ({ ...m, nova: m.autor === 'denunciante' && !m.lida })),
    notas, medidas, anexos, impedimentos, historico,
  }
}

export async function atualizarDenuncia(id, campos) {
  return exigir(await comissao.from('denuncias').update(campos).eq('id', id).select().single())
}

export async function enviarMensagem(id, texto) {
  exigir(await comissao.from('denuncia_mensagens').insert({
    denuncia_id: id, autor: 'comissao', autor_id: await uid(), texto: texto.trim(),
  }))
}

export async function adicionarNota(id, texto) {
  exigir(await comissao.from('denuncia_notas').insert({ denuncia_id: id, texto: texto.trim(), autor_id: await uid() }))
}

export async function criarMedida(id, m) {
  exigir(await comissao.from('denuncia_medidas').insert({
    denuncia_id: id, tipo: m.tipo, descricao: m.descricao.trim(),
    responsavel: m.responsavel?.trim() || null, prazo: m.prazo || null,
  }))
}

export async function atualizarMedida(medidaId, campos) {
  exigir(await comissao.from('denuncia_medidas').update(campos).eq('id', medidaId))
}

/** Link temporário (5 minutos) — o bucket é privado. */
export async function urlAnexo(anexo) {
  return exigir(await comissao.storage.from(BUCKET).createSignedUrl(anexo.caminho, 300)).signedUrl
}

export async function declararImpedimento(id, motivo) {
  exigir(await comissao.rpc('canal_declarar_impedimento', { p_denuncia: id, p_motivo: motivo || '' }))
}

export async function afastarMembro(id, membroId, motivo) {
  exigir(await comissao.rpc('canal_afastar_membro', { p_denuncia: id, p_membro: membroId, p_motivo: motivo || '' }))
}

export async function revogarImpedimento(id, membroId) {
  exigir(await comissao.from('denuncia_impedimentos').delete().eq('denuncia_id', id).eq('user_id', membroId))
}

export async function listarMembros() {
  return exigir(await comissao.from('comissao_membros').select('*').order('nome'))
}

export async function adicionarMembro({ email, nome, papel, empresaId = null }) {
  exigir(await comissao.rpc('canal_adicionar_membro', {
    p_email: email, p_nome: nome, p_papel: papel, p_empresa: empresaId || null,
  }))
}

/** As empresas que quem está logado enxerga (o administrador vê todas). */
export async function listarEmpresas() {
  return exigir(await comissao.from('empresas').select('*').order('nome'))
}

export async function salvarEmpresa({ id, nome, slug, unidades }) {
  // `ativa` não vai aqui: encerrar e reativar têm função própria, com motivo
  const dados = { nome: nome.trim(), slug, unidades: (unidades || []).map((u) => u.trim()).filter(Boolean) }
  return id
    ? exigir(await comissao.from('empresas').update(dados).eq('id', id).select().single())
    : exigir(await comissao.from('empresas').insert(dados).select().single())
}

export async function atualizarMembro(userId, campos) {
  exigir(await comissao.from('comissao_membros').update(campos).eq('user_id', userId))
}

export async function historicoGeral() {
  const linhas = exigir(await comissao
    .from('denuncia_historico')
    .select('*, denuncias(protocolo)')
    .order('criado_em', { ascending: false })
    .limit(500))
  return linhas.map(({ denuncias, ...h }) => ({ ...h, protocolo: denuncias?.protocolo || null }))
}

export async function expurgar(anos) {
  return exigir(await comissao.rpc('canal_expurgar', { p_anos: anos }))
}

/* Aviso por e-mail de denúncia nova (tabela canal_avisos + site_url em
   canal_config). Só o administrador lê e muda — ver as políticas no schema. */
export async function listarAvisos() {
  const [emails, site] = await Promise.all([
    comissao.from('canal_avisos').select('*').order('email').then(exigir),
    comissao.from('canal_config').select('valor').eq('chave', 'site_url').maybeSingle().then(exigir),
  ])
  return { emails, siteUrl: site?.valor || '' }
}

export async function salvarAviso(email, ativo = true) {
  exigir(await comissao.from('canal_avisos').upsert({ email: email.trim().toLowerCase(), ativo }))
}

export async function removerAviso(email) {
  exigir(await comissao.from('canal_avisos').delete().eq('email', email))
}

export async function salvarSiteUrl(url) {
  exigir(await comissao.from('canal_config').upsert({ chave: 'site_url', valor: url.trim().replace(/\/+$/, '') }))
}

export async function encerrarEmpresa(id, motivo, desativarMembros = true) {
  return exigir(await comissao.rpc('canal_encerrar_empresa', {
    p_empresa: id, p_motivo: motivo, p_desativar_membros: desativarMembros,
  }))
}

export async function reativarEmpresa(id, motivo) {
  exigir(await comissao.rpc('canal_reativar_empresa', { p_empresa: id, p_motivo: motivo }))
}

/** Cadastro, encerramento, reativação e mudanças das empresas (só o admin lê). */
export async function historicoEmpresas() {
  return exigir(await comissao.from('denuncia_historico').select('*').is('denuncia_id', null)
    .in('acao', ['empresa_insert', 'empresa_update', 'empresa_encerrada', 'empresa_reativada']).order('criado_em', { ascending: false }).limit(500))
}

// Só existem no modo demonstração; aqui não fazem nada.
export async function gerarExemplos() {}
export function limparDemo() {}
