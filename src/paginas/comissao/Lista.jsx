import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { categoriaPorId, categorias } from '../../config'
import { Aviso, Carregando, Selo } from '../../componentes/Estrutura'
import { api } from '../../lib/api'
import { formatarProtocolo, normalizar } from '../../lib/codigos'
import { GRAVIDADES, STATUS, data, estaAberta, mensagemDeErro, rotuloStatus, situacaoPrazo } from '../../lib/formato'
import { useTitulo } from '../../lib/ganchos'
import { useComissao } from '../../lib/contextoComissao'

export default function Lista() {
  useTitulo('Denúncias')
  const { nomeDe, empresas, nomeEmpresa } = useComissao()
  const variasEmpresas = empresas.length > 1
  const navegar = useNavigate()
  const [lista, setLista] = useState(null)
  const [erro, setErro] = useState('')
  const [f, setF] = useState({ busca: '', status: 'abertas', empresa: '', categoria: '', unidade: '', gravidade: '' })
  const mudar = (campo) => (e) => setF({ ...f, [campo]: e.target.value })

  useEffect(() => {
    api.listarDenuncias().then(setLista).catch((e) => setErro(mensagemDeErro(e)))
  }, [])

  const numeros = useMemo(() => {
    if (!lista) return null
    const abertas = lista.filter(estaAberta)
    return {
      abertas: abertas.length,
      triagem: abertas.filter((d) => d.status === 'recebida').length,
      vencidas: abertas.filter((d) => situacaoPrazo(d).nivel === 'vencido').length,
      mensagens: lista.reduce((s, d) => s + (d.nao_lidas || 0), 0),
      aguardando: abertas.filter((d) => d.status === 'aguardando_info').length,
    }
  }, [lista])

  const filtrada = useMemo(() => {
    if (!lista) return []
    const busca = f.busca.trim().toLowerCase()
    const r = lista.filter((d) => {
      if (f.status === 'abertas' && !estaAberta(d)) return false
      if (f.status !== 'abertas' && f.status !== 'todas' && d.status !== f.status) return false
      if (f.empresa && d.empresa_id !== f.empresa) return false
      if (f.categoria && d.categoria !== f.categoria) return false
      if (f.unidade && d.unidade !== f.unidade) return false
      if (f.gravidade === 'sem' ? d.gravidade : f.gravidade && d.gravidade !== f.gravidade) return false
      if (busca) {
        const noProtocolo = normalizar(busca).length >= 3 && d.protocolo.includes(normalizar(busca))
        const noTexto = [d.descricao, d.local, d.envolvidos].some((t) => t?.toLowerCase().includes(busca))
        if (!noProtocolo && !noTexto) return false
      }
      return true
    })
    // abertas: quem vence primeiro no topo; o resto: mais recentes primeiro
    const prazoDe = (d) => new Date(d.status === 'recebida' ? d.prazo_triagem : d.prazo_conclusao).getTime()
    return r.sort((a, b) => {
      const aa = estaAberta(a), ba = estaAberta(b)
      if (aa !== ba) return aa ? -1 : 1
      if (aa) return (b.nao_lidas > 0) - (a.nao_lidas > 0) || prazoDe(a) - prazoDe(b)
      return b.criada_em.localeCompare(a.criada_em)
    })
  }, [lista, f])

  if (erro) return <Aviso tipo="erro">{erro}</Aviso>
  if (!lista) return <Carregando />

  return (
    <>
      <div className="kpis">
        <div className="kpi"><small>Abertas</small><strong>{numeros.abertas}</strong></div>
        <div className={`kpi ${numeros.triagem ? 'alerta' : ''}`}><small>Aguardando triagem</small><strong>{numeros.triagem}</strong></div>
        <div className={`kpi ${numeros.vencidas ? 'erro' : ''}`}><small>Com prazo vencido</small><strong>{numeros.vencidas}</strong></div>
        <div className={`kpi ${numeros.mensagens ? 'alerta' : ''}`}><small>Mensagens não lidas</small><strong>{numeros.mensagens}</strong></div>
        <div className="kpi"><small>Esperando o denunciante</small><strong>{numeros.aguardando}</strong></div>
      </div>

      <div className="filtros" style={variasEmpresas ? { gridTemplateColumns: '2fr repeat(5, minmax(0, 1fr))' } : undefined}>
        <input type="search" placeholder="Buscar por protocolo, texto, local…" value={f.busca} onChange={mudar('busca')} aria-label="Buscar" />
        <select value={f.status} onChange={mudar('status')} aria-label="Situação">
          <option value="abertas">Abertas</option>
          <option value="todas">Todas</option>
          {Object.keys(STATUS).map((v) => <option key={v} value={v}>{rotuloStatus(v)}</option>)}
        </select>
        {variasEmpresas && (
          <select value={f.empresa} onChange={mudar('empresa')} aria-label="Empresa">
            <option value="">Todas as empresas</option>
            {empresas.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
          </select>
        )}
        <select value={f.categoria} onChange={mudar('categoria')} aria-label="Assunto">
          <option value="">Todos os assuntos</option>
          {categorias.map((c) => <option key={c.id} value={c.id}>{c.titulo}</option>)}
        </select>
        <select value={f.unidade} onChange={mudar('unidade')} aria-label="Unidade">
          <option value="">Todas as unidades</option>
          {[...new Set(lista.filter((d) => !f.empresa || d.empresa_id === f.empresa).map((d) => d.unidade).filter(Boolean))].sort()
            .map((u) => <option key={u}>{u}</option>)}
        </select>
        <select value={f.gravidade} onChange={mudar('gravidade')} aria-label="Gravidade">
          <option value="">Toda gravidade</option>
          <option value="sem">Sem classificação</option>
          {Object.entries(GRAVIDADES).map(([v, g]) => <option key={v} value={v}>{g.rotulo}</option>)}
        </select>
      </div>

      {filtrada.length === 0 ? (
        <div className="vazio">{lista.length ? 'Nenhuma denúncia com esses filtros.' : 'Nenhuma denúncia recebida ainda.'}</div>
      ) : (
        <div className="tabela-rolagem">
          <table className="tabela">
            <thead>
              <tr>
                <th>Protocolo</th><th>Recebida</th>{variasEmpresas && <th>Empresa</th>}<th>Assunto</th><th>Unidade</th><th>Gravidade</th>
                <th>Situação</th><th>Prazo</th><th>Responsável</th><th aria-label="Mensagens novas" />
              </tr>
            </thead>
            <tbody>
              {filtrada.map((d) => {
                const prazo = situacaoPrazo(d)
                const cat = categoriaPorId(d.categoria)
                return (
                  <tr key={d.id} className="clicavel" onClick={() => navegar(`/comissao/denuncia/${d.id}`)}>
                    <td className="mono nowrap"><Link to={`/comissao/denuncia/${d.id}`} onClick={(e) => e.stopPropagation()}>{formatarProtocolo(d.protocolo)}</Link></td>
                    <td className="nowrap">{data(d.criada_em)}</td>
                    {variasEmpresas && <td>{nomeEmpresa(d.empresa_id) || '—'}</td>}
                    <td>{cat?.titulo}{cat?.urgente && <> <Selo tom="erro">urgente</Selo></>}</td>
                    <td>{d.unidade || <span className="fraco">—</span>}</td>
                    <td>{d.gravidade ? <Selo tom={GRAVIDADES[d.gravidade].tom}>{GRAVIDADES[d.gravidade].rotulo}</Selo> : <span className="fraco">—</span>}</td>
                    <td><Selo tom={STATUS[d.status].tom} ponto>{rotuloStatus(d.status)}</Selo></td>
                    <td className={`nowrap prazo-${prazo.nivel}`}>{prazo.texto}</td>
                    <td>{nomeDe(d.responsavel_id) || <span className="fraco">—</span>}</td>
                    <td>{d.nao_lidas > 0 && <span className="bolha" title="Mensagens novas do denunciante">{d.nao_lidas}</span>}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="fraco" style={{ marginTop: 10 }}>{filtrada.length} de {lista.length} denúncia(s) visíveis para você.</p>
    </>
  )
}
