import { perigos } from '../config'
import { CAMPOS_TRIAGEM, GRAVIDADES, RESULTADOS, SITUACOES_MEDIDA, TIPOS_MEDIDA, data, rotuloStatus } from './formato'

/* Leitura humana da trilha de auditoria — usada no detalhe da denúncia e na
   aba Auditoria. `nomeDe(id)` traduz o id do membro para o nome. */

export function descreverDetalhe(h, nomeDe) {
  const det = h.detalhe || {}
  if (h.acao === 'alterou') {
    const valor = (campo, v) => {
      if (v === null || v === undefined || v === '') return '—'
      if (campo === 'status') return rotuloStatus(v)
      if (campo === 'gravidade') return GRAVIDADES[v]?.rotulo || v
      if (campo === 'perigo') return perigos[v] || v
      if (campo === 'responsavel_id') return nomeDe(v) || '—'
      if (campo === 'resultado') return RESULTADOS[v] || v
      if (campo === 'encaminhar_pgr') return v ? 'sim' : 'não'
      if (campo === 'prazo_conclusao') return data(v)
      if (campo === 'resposta_final') return '(texto atualizado)'
      if (campo === 'empresa_id') return '(outra empresa)'
      return String(v)
    }
    return Object.entries(det).map(([c, { de, para }]) => `${CAMPOS_TRIAGEM[c] || c}: ${valor(c, de)} → ${valor(c, para)}`).join(' · ')
  }
  if (h.acao === 'medida_criada') return `${TIPOS_MEDIDA[det.tipo] || ''}: ${det.descricao || ''}`
  if (h.acao === 'medida_alterada') return `${det.descricao}: ${SITUACOES_MEDIDA[det.de]} → ${SITUACOES_MEDIDA[det.para]}`
  if (h.acao === 'declarou_impedimento') return det.motivo || ''
  if (h.acao === 'afastou_membro') return `${det.membro || ''}${det.motivo ? ` — ${det.motivo}` : ''}`
  if (h.acao === 'recebida') return det.impedidos ? `${det.impedidos} membro(s) afastado(s) pelo denunciante` : ''
  if (h.acao === 'anexo_denunciante') return det.nome || ''
  if (h.acao?.startsWith('membro_')) return `${det.nome || ''} (${det.papel === 'admin' ? 'administrador' : 'membro'}${det.empresa ? ` · ${det.empresa}` : ''}${det.ativo === false ? ', inativo' : ''})`
  if (h.acao === 'empresa_encerrada') {
    const m = det.membros_desativados
    return `${det.nome || ''} — motivo: ${det.motivo || '—'}${m ? ` · ${m} membro(s) desativado(s)` : ''}`
  }
  if (h.acao === 'empresa_reativada') return `${det.nome || ''} — motivo: ${det.motivo || '—'}`
  if (h.acao === 'empresa_update' && det.antes && (det.antes.nome !== det.nome || det.antes.slug !== det.slug)) {
    return `${det.antes.nome} → ${det.nome}${det.antes.slug !== det.slug ? ` · link /e/${det.antes.slug} → /e/${det.slug}` : ''}`
  }
  if (h.acao?.startsWith('empresa_')) return `${det.nome || ''} — link /e/${det.slug || ''}${det.ativa === false ? ' (desativada)' : ''}`
  if (h.acao === 'aviso_email') return `${det.destinos} destinatário(s)${det.simulado ? ' — simulado na demonstração, nada foi enviado' : ''}`
  if (h.acao === 'aviso_email_falhou') return det.motivo || ''
  if (h.acao?.startsWith('aviso_')) return `${det.email || ''}${det.ativo === false ? ' (pausado)' : ''}`
  if (h.acao === 'expurgo') return `${det.denuncias} denúncia(s) com mais de ${det.anos} ano(s)`
  return ''
}

export const autorDaLinha = (h, nomeDe) =>
  h.usuario_id ? nomeDe(h.usuario_id) : ['mensagem_denunciante', 'anexo_denunciante', 'recebida'].includes(h.acao) ? 'Denunciante' : 'Sistema'
