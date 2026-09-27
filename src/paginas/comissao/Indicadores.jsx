import { useEffect, useMemo, useState } from 'react'
import { categoriaPorId, categorias, perigos } from '../../config'
import { Aviso, Carregando } from '../../componentes/Estrutura'
import { Barras } from '../../componentes/Graficos'
import { useComissao } from '../../lib/contextoComissao'
import { api } from '../../lib/api'
import { GRAVIDADES, RESULTADOS, STATUS, diasEntre, estaAberta, mensagemDeErro, mesCurto, paraInputData, rotuloStatus } from '../../lib/formato'
import { useTitulo } from '../../lib/ganchos'

/* Indicadores para a comissão, a CIPA e o PGR.

   NR-01 1.5.3.3 pede mecanismos de consulta aos trabalhadores sobre a
   percepção de riscos, e 1.5.3.1.4 inclui os fatores psicossociais no
   gerenciamento de riscos. É daqui que sai o que o canal "ouviu", em números,
   para entrar no inventário de riscos e no plano de ação.

   O que sai desta tela é sempre AGREGADO: nenhum relato, nenhum protocolo,
   nenhum nome. Cada gráfico é uma série só (uma cor, sem legenda — o título
   diz o que é), com o número escrito ao lado de cada barra. */

const PERIODOS = {
  '12m': 'Últimos 12 meses',
  ano: 'Este ano',
  tudo: 'Todo o período',
}

export default function Indicadores() {
  useTitulo('Indicadores')
  const [lista, setLista] = useState(null)
  const [erro, setErro] = useState('')
  const { empresas, nomeEmpresa } = useComissao()
  const [periodo, setPeriodo] = useState('12m')
  const [empresaId, setEmpresaId] = useState('')
  const [unidade, setUnidade] = useState('')

  useEffect(() => {
    api.listarDenuncias().then(setLista).catch((e) => setErro(mensagemDeErro(e)))
  }, [])

  const inicio = useMemo(() => {
    const h = new Date()
    if (periodo === '12m') return new Date(h.getFullYear(), h.getMonth() - 11, 1)
    if (periodo === 'ano') return new Date(h.getFullYear(), 0, 1)
    return new Date(2000, 0, 1)
  }, [periodo])

  const recorte = useMemo(
    () => (lista || []).filter((d) => new Date(d.criada_em) >= inicio
      && (!empresaId || d.empresa_id === empresaId) && (!unidade || d.unidade === unidade)),
    [lista, inicio, empresaId, unidade],
  )
  // cada empresa tem as próprias unidades: a lista sai das denúncias da empresa escolhida
  const unidades = useMemo(
    () => [...new Set((lista || []).filter((d) => !empresaId || d.empresa_id === empresaId).map((d) => d.unidade).filter(Boolean))].sort(),
    [lista, empresaId],
  )

  const n = useMemo(() => calcular(recorte, inicio, periodo), [recorte, inicio, periodo])

  if (erro) return <Aviso tipo="erro">{erro}</Aviso>
  if (!lista) return <Carregando />

  return (
    <>
      <div className="filtros nao-imprimir" style={{ gridTemplateColumns: `repeat(${empresas.length > 1 ? 3 : 2}, minmax(0, 220px)) 1fr` }}>
        <select value={periodo} onChange={(e) => setPeriodo(e.target.value)} aria-label="Período">
          {Object.entries(PERIODOS).map(([v, t]) => <option key={v} value={v}>{t}</option>)}
        </select>
        {empresas.length > 1 && (
          <select value={empresaId} onChange={(e) => { setEmpresaId(e.target.value); setUnidade('') }} aria-label="Empresa">
            <option value="">Todas as empresas</option>
            {empresas.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
          </select>
        )}
        <select value={unidade} onChange={(e) => setUnidade(e.target.value)} aria-label="Unidade">
          <option value="">Todas as unidades</option>
          {unidades.map((u) => <option key={u}>{u}</option>)}
        </select>
        <div className="botoes botoes-fim">
          <button className="btn btn-secundario btn-pequeno" onClick={() => exportar(recorte, false, nomeEmpresa)} disabled={!recorte.length}>Base anonimizada (CSV)</button>
          <button className="btn btn-secundario btn-pequeno" onClick={() => exportar(recorte.filter((d) => d.encaminhar_pgr), true, nomeEmpresa)} disabled={!n.pgr}>Relatório para o PGR (CSV)</button>
          <button className="btn btn-secundario btn-pequeno" onClick={() => window.print()}>Imprimir</button>
        </div>
      </div>

      <div className="kpis">
        <Kpi rotulo="Recebidas" valor={n.total} nota={PERIODOS[periodo].toLowerCase()} />
        <Kpi rotulo="Abertas agora" valor={n.abertas} />
        <Kpi rotulo="Triagem, em média" valor={n.mediaTriagem === null ? '—' : `${n.mediaTriagem.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} d`} nota="da chegada à 1ª análise" />
        <Kpi rotulo="Conclusão, em média" valor={n.mediaConclusao === null ? '—' : `${Math.round(n.mediaConclusao)} d`} nota="da chegada à resposta" />
        <Kpi rotulo="Respondidas no prazo" valor={n.noPrazo === null ? '—' : `${Math.round(n.noPrazo * 100)}%`} nota={`de ${n.encerradas} encerrada(s)`} tom={n.noPrazo !== null && n.noPrazo < 0.8 ? 'alerta' : ''} />
        <Kpi rotulo="Procedentes" valor={n.procedentes === null ? '—' : `${Math.round(n.procedentes * 100)}%`} nota="total ou parcialmente" />
      </div>

      {n.total === 0 ? <div className="vazio">Nenhuma denúncia neste recorte.</div> : (
        <>
          <div className="cartao">
            <div className="cartao-cabeca">
              <h2>Denúncias recebidas por mês</h2>
              <span className="fraco">passe o mouse para ver cada mês</span>
            </div>
            <Colunas dados={n.porMes} />
          </div>

          <div className="grade-2" style={{ marginTop: 16 }}>
            <div className="cartao">
              <h2>Por assunto</h2>
              <Barras dados={n.porCategoria} total={n.total} />
            </div>
            <div className="cartao">
              <h2>Por unidade</h2>
              <Barras dados={n.porUnidade} total={n.total} />
            </div>
          </div>

          <div className="cartao" style={{ marginTop: 16 }}>
            <div className="cartao-cabeca">
              <h2>Assédio, violência e riscos psicossociais por unidade</h2>
              <span className="fraco">NR-01 · 1.5.3.1.4</span>
            </div>
            <p className="fraco">
              Para o inventário de riscos do PGR: onde se concentram as denúncias de fatores psicossociais. Quanto mais
              escura a célula, mais denúncias.
            </p>
            <MapaCalor linhas={n.psicoUnidades} colunas={n.psicoCategorias} celulas={n.psico} />
          </div>

          <div className="grade-2" style={{ marginTop: 16 }}>
            <div className="cartao">
              <h2>Encaminhadas ao PGR, por tipo de perigo</h2>
              {n.pgr ? <Barras dados={n.porPerigo} total={n.pgr} /> : <p className="fraco">Nenhuma denúncia marcada para o PGR neste recorte.</p>}
            </div>
            <div className="cartao">
              <h2>Resultado das encerradas</h2>
              {n.encerradas ? <Barras dados={n.porResultado} total={n.encerradas} /> : <p className="fraco">Nenhuma encerrada neste recorte.</p>}
            </div>
          </div>

          <div className="grade-2" style={{ marginTop: 16 }}>
            <div className="cartao">
              <h2>Situação atual</h2>
              <Barras dados={n.porStatus} total={n.total} />
            </div>
            <div className="cartao">
              <h2>Gravidade atribuída na triagem</h2>
              <Barras dados={n.porGravidade} total={n.total} />
            </div>
          </div>
        </>
      )}
    </>
  )
}

function calcular(recorte, inicio, periodo) {
  const conta = (chaveDe, rotuloDe, ordem) => {
    const m = new Map()
    for (const d of recorte) {
      const k = chaveDe(d)
      if (k === undefined) continue
      m.set(k, (m.get(k) || 0) + 1)
    }
    const r = [...m.entries()].map(([k, v]) => ({ chave: k, rotulo: rotuloDe(k), valor: v }))
    return ordem ? r.sort((a, b) => ordem.indexOf(a.chave) - ordem.indexOf(b.chave)) : r.sort((a, b) => b.valor - a.valor)
  }
  const media = (xs) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null)

  const encerradas = recorte.filter((d) => !estaAberta(d))
  const concluidas = encerradas.filter((d) => d.resultado)
  const pgr = recorte.filter((d) => d.encaminhar_pgr)

  // meses do recorte, inclusive os sem denúncia (zero é informação)
  const meses = []
  const primeiro = periodo === 'tudo' && recorte.length
    ? new Date(Math.min(...recorte.map((d) => new Date(d.criada_em).getTime())))
    : inicio
  const cursor = new Date(primeiro.getFullYear(), primeiro.getMonth(), 1)
  const fim = new Date()
  while (cursor <= fim) {
    meses.push({ chave: `${cursor.getFullYear()}-${cursor.getMonth()}`, rotulo: mesCurto(cursor), valor: 0 })
    cursor.setMonth(cursor.getMonth() + 1)
  }
  for (const d of recorte) {
    const c = new Date(d.criada_em)
    const m = meses.find((x) => x.chave === `${c.getFullYear()}-${c.getMonth()}`)
    if (m) m.valor += 1
  }

  const psicoCategorias = categorias.filter((c) => c.grupo === 'psicossocial')
  const psicoRecorte = recorte.filter((d) => categoriaPorId(d.categoria)?.grupo === 'psicossocial')
  const psicoUnidades = [...new Set(psicoRecorte.map((d) => d.unidade || 'Não informada'))].sort()
  const psico = {}
  for (const d of psicoRecorte) {
    const k = `${d.unidade || 'Não informada'}|${d.categoria}`
    psico[k] = (psico[k] || 0) + 1
  }

  return {
    total: recorte.length,
    abertas: recorte.filter(estaAberta).length,
    encerradas: encerradas.length,
    pgr: pgr.length,
    mediaTriagem: media(recorte.filter((d) => d.triada_em).map((d) => diasEntre(d.criada_em, d.triada_em))),
    mediaConclusao: media(encerradas.filter((d) => d.concluida_em).map((d) => diasEntre(d.criada_em, d.concluida_em))),
    noPrazo: encerradas.length ? encerradas.filter((d) => new Date(d.concluida_em) <= new Date(d.prazo_conclusao)).length / encerradas.length : null,
    procedentes: concluidas.length ? concluidas.filter((d) => ['procedente', 'parcialmente_procedente'].includes(d.resultado)).length / concluidas.length : null,
    porMes: periodo === 'tudo' ? meses : meses.slice(-12),
    porCategoria: conta((d) => d.categoria, (k) => categoriaPorId(k)?.titulo || k),
    porUnidade: conta((d) => d.unidade || 'Não informada', (k) => k),
    porStatus: conta((d) => d.status, rotuloStatus, Object.keys(STATUS)),
    porGravidade: conta((d) => d.gravidade || 'sem', (k) => (k === 'sem' ? 'Ainda sem triagem' : GRAVIDADES[k].rotulo), ['baixa', 'media', 'alta', 'critica', 'sem']),
    porResultado: conta((d) => (estaAberta(d) ? undefined : d.resultado || 'arquivada'), (k) => (k === 'arquivada' ? 'Arquivada' : RESULTADOS[k]), [...Object.keys(RESULTADOS), 'arquivada']),
    porPerigo: conta((d) => (d.encaminhar_pgr ? d.perigo || 'nao_aplica' : undefined), (k) => perigos[k] || k),
    psicoCategorias, psicoUnidades, psico,
  }
}

function Kpi({ rotulo, valor, nota, tom = '' }) {
  return (
    <div className={`kpi ${tom}`}>
      <small>{rotulo}</small>
      <strong>{valor}</strong>
      {nota && <span>{nota}</span>}
    </div>
  )
}

/** Colunas por mês. Rotula só o maior e o último mês; os demais aparecem ao
    passar o mouse/foco e na tabela logo abaixo. */
function Colunas({ dados }) {
  const [ativo, setAtivo] = useState(null)
  const max = Math.max(1, ...dados.map((d) => d.valor))
  const iMax = dados.findIndex((d) => d.valor === max)
  return (
    <>
      <div className="colunas" style={{ gridTemplateColumns: `repeat(${dados.length}, minmax(0, 1fr))` }} onMouseLeave={() => setAtivo(null)}>
        {dados.map((d, i) => {
          const rotular = i === ativo || i === iMax || i === dados.length - 1
          return (
            <div key={d.chave} className="coluna" tabIndex={0} onMouseEnter={() => setAtivo(i)} onFocus={() => setAtivo(i)}
              aria-label={`${d.rotulo}: ${d.valor}`} style={{ opacity: ativo === null || ativo === i ? 1 : 0.55 }}>
              <div className="coluna-barra" style={{ height: `${(d.valor / max) * 100}%` }}>
                {rotular && <span>{d.valor}</span>}
              </div>
              <span>{d.rotulo}</span>
            </div>
          )
        })}
      </div>
      <details className="dobra" style={{ marginTop: 14 }}>
        <summary>Ver em tabela</summary>
        <div className="tabela-rolagem">
          <table className="tabela">
            <thead><tr>{dados.map((d) => <th key={d.chave} className="num">{d.rotulo}</th>)}</tr></thead>
            <tbody><tr>{dados.map((d) => <td key={d.chave} className="num">{d.valor}</td>)}</tr></tbody>
          </table>
        </div>
      </details>
    </>
  )
}

/** Tabela unidade × assunto com fundo em uma escala de um só tom. O número
    está sempre escrito — a cor só ajuda a achar as concentrações. */
function MapaCalor({ linhas, colunas, celulas }) {
  if (!linhas.length) return <p className="fraco">Nenhuma denúncia deste grupo no recorte.</p>
  const max = Math.max(1, ...Object.values(celulas))
  const fundo = (v) => (v ? `color-mix(in srgb, var(--grafico) ${Math.round(12 + (v / max) * 48)}%, transparent)` : undefined)
  return (
    <div className="tabela-rolagem">
      <table className="tabela mapa-calor">
        <thead>
          <tr><th>Unidade</th>{colunas.map((c) => <th key={c.id} className="num">{c.titulo}</th>)}<th className="num">Total</th></tr>
        </thead>
        <tbody>
          {linhas.map((u) => {
            const total = colunas.reduce((s, c) => s + (celulas[`${u}|${c.id}`] || 0), 0)
            return (
              <tr key={u}>
                <td>{u}</td>
                {colunas.map((c) => {
                  const v = celulas[`${u}|${c.id}`] || 0
                  return <td key={c.id} className="num" style={{ background: fundo(v) }}>{v || <span className="fraco">·</span>}</td>
                })}
                <td className="num"><strong>{total}</strong></td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/* CSV com ponto e vírgula e BOM: abre certo no Excel em português. */
function exportar(denuncias, soPgr, nomeEmpresa) {
  const cab = ['mes', 'empresa', 'unidade', 'assunto', 'grupo', 'perigo_pgr', 'gravidade', 'situacao', 'resultado', 'dias_ate_triagem', 'dias_ate_conclusao', 'no_prazo']
  const linhas = denuncias.map((d) => {
    const c = categoriaPorId(d.categoria)
    return [
      d.criada_em.slice(0, 7),
      nomeEmpresa(d.empresa_id) || '',
      d.unidade || '',
      c?.titulo || d.categoria,
      c?.grupo || '',
      d.perigo ? perigos[d.perigo] : '',
      d.gravidade ? GRAVIDADES[d.gravidade].rotulo : '',
      rotuloStatus(d.status),
      d.resultado ? RESULTADOS[d.resultado] : '',
      d.triada_em ? diasEntre(d.criada_em, d.triada_em).toFixed(1).replace('.', ',') : '',
      d.concluida_em ? diasEntre(d.criada_em, d.concluida_em).toFixed(1).replace('.', ',') : '',
      d.concluida_em ? (new Date(d.concluida_em) <= new Date(d.prazo_conclusao) ? 'sim' : 'não') : '',
    ]
  })
  const csv = [cab, ...linhas].map((l) => l.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\r\n')
  const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `${soPgr ? 'canal-denuncia-pgr' : 'canal-denuncia-base'}-${paraInputData(new Date())}.csv`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
