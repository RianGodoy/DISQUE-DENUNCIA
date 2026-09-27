import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Aviso, Carregando } from '../../componentes/Estrutura'
import { api } from '../../lib/api'
import { formatarProtocolo } from '../../lib/codigos'
import { ACOES, dataHora, mensagemDeErro } from '../../lib/formato'
import { useTitulo } from '../../lib/ganchos'
import { autorDaLinha, descreverDetalhe } from '../../lib/trilha'
import { useComissao } from '../../lib/contextoComissao'

/* Quem abriu, quem mudou, quem entrou na comissão. É o que permite
   responder "quem teve acesso a esta denúncia?" numa auditoria ou num
   processo — e o que desestimula a curiosidade. */
export default function Auditoria() {
  useTitulo('Auditoria')
  const { nomeDe } = useComissao()
  const [linhas, setLinhas] = useState(null)
  const [erro, setErro] = useState('')
  const [quem, setQuem] = useState('')
  const [acao, setAcao] = useState('')

  useEffect(() => {
    api.historicoGeral().then(setLinhas).catch((e) => setErro(mensagemDeErro(e)))
  }, [])

  const autores = useMemo(() => [...new Set((linhas || []).map((h) => autorDaLinha(h, nomeDe)))].sort(), [linhas, nomeDe])
  const filtradas = (linhas || []).filter((h) => (!quem || autorDaLinha(h, nomeDe) === quem) && (!acao || h.acao === acao))

  if (erro) return <Aviso tipo="erro">{erro}</Aviso>
  if (!linhas) return <Carregando />

  return (
    <>
      <p className="suave">Últimos 500 registros das denúncias que você pode ver e das mudanças na comissão.</p>
      <div className="filtros" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 260px))' }}>
        <select value={quem} onChange={(e) => setQuem(e.target.value)} aria-label="Quem">
          <option value="">Todas as pessoas</option>
          {autores.map((a) => <option key={a}>{a}</option>)}
        </select>
        <select value={acao} onChange={(e) => setAcao(e.target.value)} aria-label="Ação">
          <option value="">Todas as ações</option>
          {Object.entries(ACOES).map(([v, t]) => <option key={v} value={v}>{t}</option>)}
        </select>
      </div>
      <div className="tabela-rolagem">
        <table className="tabela">
          <thead><tr><th>Quando</th><th>Quem</th><th>O quê</th><th>Denúncia</th><th>Detalhe</th></tr></thead>
          <tbody>
            {filtradas.map((h) => (
              <tr key={h.id}>
                <td className="nowrap">{dataHora(h.criado_em)}</td>
                <td>{autorDaLinha(h, nomeDe)}</td>
                <td>{ACOES[h.acao] || h.acao}</td>
                <td className="mono nowrap">{h.protocolo ? <Link to={`/comissao/denuncia/${h.denuncia_id}`}>{formatarProtocolo(h.protocolo)}</Link> : '—'}</td>
                <td className="fraco">{descreverDetalhe(h, nomeDe)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
