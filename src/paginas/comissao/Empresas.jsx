import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { categoriaPorId, grupos, unidades as unidadesPadrao } from '../../config'
import { Aviso, Carregando, Selo } from '../../componentes/Estrutura'
import { Barras, contar, percentuais } from '../../componentes/Graficos'
import { api } from '../../lib/api'
import { useComissao } from '../../lib/contextoComissao'
import { SLUG_VALIDO, linkDaEmpresa, paraSlug } from '../../lib/contextoEmpresa'
import { STATUS, estaAberta, mensagemDeErro, rotuloStatus } from '../../lib/formato'
import { useCopiar, useTitulo } from '../../lib/ganchos'

/* Empresas atendidas pelo canal.

   Mini-abas no alto: "Visão geral" (quanto cada empresa pesa no total de
   relatos), uma aba por empresa (o dashboard dela, em percentuais, com o link
   e o cartaz) e "+ Nova empresa" para o administrador.

   Tudo aqui é contagem: nenhum relato, nenhum protocolo. Membro ligado a uma
   empresa só enxerga a dele — o banco nem devolve as outras. */
export default function Empresas() {
  useTitulo('Empresas')
  const { empresas, admin } = useComissao()
  const [lista, setLista] = useState(null)
  const [erro, setErro] = useState('')
  const [aba, setAba] = useState('geral')

  useEffect(() => {
    api.listarDenuncias().then(setLista).catch((e) => setErro(mensagemDeErro(e)))
  }, [])

  // quem só enxerga uma empresa vai direto para ela
  const soUma = empresas.length === 1 && !admin
  const atual = soUma ? empresas[0].id : aba
  const empresa = empresas.find((e) => e.id === atual)

  if (erro) return <Aviso tipo="erro">{erro}</Aviso>
  if (!lista) return <Carregando />

  return (
    <>
      {!soUma && (
        <nav className="miniabas" aria-label="Empresas">
          <button className={atual === 'geral' ? 'ativo' : ''} onClick={() => setAba('geral')}>Visão geral</button>
          {empresas.map((e) => (
            <button key={e.id} className={`${atual === e.id ? 'ativo' : ''} ${e.ativa ? '' : 'inativa'}`} onClick={() => setAba(e.id)}
              title={e.ativa ? undefined : 'Empresa desativada'}>
              {e.nome}
            </button>
          ))}
          {admin && <button className={atual === 'nova' ? 'ativo' : ''} onClick={() => setAba('nova')}>+ Nova empresa</button>}
        </nav>
      )}

      {atual === 'geral' && <VisaoGeral lista={lista} aoAbrir={setAba} />}
      {atual === 'nova' && admin && <FormEmpresa aoSalvar={(e) => setAba(e.id)} />}
      {empresa && <PainelEmpresa key={empresa.id} empresa={empresa} lista={lista} />}
    </>
  )
}

/* ------------------------------------------------------------ visão geral */
function VisaoGeral({ lista, aoAbrir }) {
  const { empresas, admin } = useComissao()
  const porEmpresa = empresas
    .map((e) => {
      const d = lista.filter((x) => x.empresa_id === e.id)
      return { ...e, total: d.length, abertas: d.filter(estaAberta).length }
    })
    .sort((a, b) => b.total - a.total)
  const pcts = percentuais(porEmpresa.map((e) => e.total), lista.length)

  if (!empresas.length) {
    return (
      <div className="vazio">
        Nenhuma empresa cadastrada ainda.{admin ? ' Crie a primeira em “+ Nova empresa”: sem empresa, ninguém consegue denunciar.' : ''}
      </div>
    )
  }

  return (
    <>
      <div className="kpis">
        <div className="kpi"><small>Empresas ativas</small><strong>{empresas.filter((e) => e.ativa).length}</strong></div>
        <div className="kpi"><small>Relatos no canal</small><strong>{lista.length}</strong><span>todas as empresas, desde o início</span></div>
        <div className="kpi"><small>Abertos agora</small><strong>{lista.filter(estaAberta).length}</strong></div>
      </div>

      <div className="grade-2">
        <div className="cartao">
          <h2>Relatos por empresa</h2>
          <p className="fraco">Percentual de cada empresa no total de relatos do canal.</p>
          {lista.length
            ? <Barras modo="percentual" total={lista.length} dados={porEmpresa.map((e) => ({ chave: e.id, rotulo: e.nome, valor: e.total }))} />
            : <p className="fraco">Nenhum relato recebido ainda.</p>}
        </div>
        <div className="cartao">
          <h2>Empresas</h2>
          <div className="tabela-rolagem">
            <table className="tabela">
              <thead><tr><th>Empresa</th><th className="num">Relatos</th><th className="num">% do total</th><th className="num">Abertos</th><th /></tr></thead>
              <tbody>
                {porEmpresa.map((e, i) => (
                  <tr key={e.id} className="clicavel" onClick={() => aoAbrir(e.id)}>
                    <td>{e.nome}{!e.ativa && <> <Selo>desativada</Selo></>}</td>
                    <td className="num">{e.total}</td>
                    <td className="num">{pcts[i]}%</td>
                    <td className="num">{e.abertas}</td>
                    <td className="num"><span className="fraco">abrir →</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  )
}

/* ------------------------------------------------- dashboard de uma empresa */
function PainelEmpresa({ empresa, lista }) {
  const { admin, membro } = useComissao()
  // "% do total do canal" só tem sentido para quem enxerga todas as empresas;
  // para o membro de uma empresa o "total" que ele vê é a própria empresa
  const veTodas = !membro.empresa_id
  const [copiado, copiar] = useCopiar()
  const [editando, setEditando] = useState(false)
  const link = linkDaEmpresa(empresa.slug)
  const doCanal = lista.length
  const den = useMemo(() => lista.filter((d) => d.empresa_id === empresa.id), [lista, empresa.id])
  const encerradas = den.filter((d) => !estaAberta(d))
  const concluidas = encerradas.filter((d) => d.resultado)
  const pct = (a, b) => (b ? `${Math.round((a / b) * 100)}%` : '—')

  return (
    <>
      <div className="cartao">
        <div className="cartao-cabeca">
          <h2>{empresa.nome}</h2>
          {empresa.ativa ? <Selo tom="ok" ponto>Recebendo denúncias</Selo> : <Selo ponto>Desativada — o link não abre</Selo>}
        </div>
        <label className="rotulo" htmlFor={`link-${empresa.id}`}>Link para divulgar</label>
        <div className="link-caixa" style={{ marginTop: 6 }}>
          <input id={`link-${empresa.id}`} type="text" readOnly value={link} onFocus={(e) => e.target.select()} />
          <button className="btn btn-secundario btn-pequeno" onClick={() => copiar(link)}>{copiado ? 'Copiado ✓' : 'Copiar'}</button>
          <Link className="btn btn-secundario btn-pequeno" to={`/e/${empresa.slug}`} target="_blank" rel="noreferrer">Abrir</Link>
          <Link className="btn btn-secundario btn-pequeno" to={`/cartaz/${empresa.slug}`}>Cartaz com QR code</Link>
          {admin && <button className="btn btn-fantasma btn-pequeno" onClick={() => setEditando(!editando)}>{editando ? 'Fechar edição' : 'Editar empresa'}</button>}
        </div>
        {editando && <div style={{ marginTop: 18 }}><FormEmpresa empresa={empresa} aoSalvar={() => setEditando(false)} /></div>}
      </div>

      <div className="kpis" style={{ marginTop: 16 }}>
        <div className="kpi"><small>Relatos</small><strong>{den.length}</strong><span>desde o início</span></div>
        {veTodas && <div className="kpi"><small>% do total do canal</small><strong>{pct(den.length, doCanal)}</strong><span>de {doCanal} relato(s)</span></div>}
        <div className="kpi"><small>Abertos</small><strong>{den.length - encerradas.length}</strong><span>{pct(den.length - encerradas.length, den.length)} dos relatos</span></div>
        <div className="kpi"><small>Respondidos no prazo</small><strong>{pct(encerradas.filter((d) => new Date(d.concluida_em) <= new Date(d.prazo_conclusao)).length, encerradas.length)}</strong><span>de {encerradas.length} encerrado(s)</span></div>
        <div className="kpi"><small>Procedentes</small><strong>{pct(concluidas.filter((d) => ['procedente', 'parcialmente_procedente'].includes(d.resultado)).length, concluidas.length)}</strong><span>total ou parcialmente</span></div>
      </div>

      {den.length === 0 ? (
        <div className="vazio">Nenhum relato desta empresa ainda. Divulgue o link e o cartaz com QR code.</div>
      ) : (
        <>
          <div className="grade-2">
            <div className="cartao">
              <h2>% por assunto</h2>
              <Barras modo="percentual" total={den.length} dados={contar(den, (d) => d.categoria, (k) => categoriaPorId(k)?.titulo || k)} />
            </div>
            <div className="cartao">
              <h2>% por tipo de risco</h2>
              <Barras modo="percentual" total={den.length} dados={contar(den, (d) => categoriaPorId(d.categoria)?.grupo, (k) => grupos[k] || k, Object.keys(grupos))} />
            </div>
          </div>
          <div className="grade-2" style={{ marginTop: 16 }}>
            <div className="cartao">
              <h2>% por situação</h2>
              <Barras modo="percentual" total={den.length} dados={contar(den, (d) => d.status, rotuloStatus, Object.keys(STATUS))} />
            </div>
            <div className="cartao">
              <h2>% por unidade</h2>
              <Barras modo="percentual" total={den.length} dados={contar(den, (d) => d.unidade || 'Não informada', (k) => k)} />
            </div>
          </div>
        </>
      )}
    </>
  )
}

/* --------------------------------------------------- criar / editar empresa */
function FormEmpresa({ empresa, aoSalvar }) {
  const { recarregarEmpresas } = useComissao()
  const nova = !empresa
  const [nome, setNome] = useState(empresa?.nome || '')
  const [slug, setSlug] = useState(empresa?.slug || '')
  const [slugManual, setSlugManual] = useState(!nova)
  const [unidades, setUnidades] = useState((empresa?.unidades?.length ? empresa.unidades : unidadesPadrao).join('\n'))
  const [ativa, setAtiva] = useState(empresa?.ativa ?? true)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const slugFinal = slugManual ? slug : paraSlug(nome)

  async function salvar(e) {
    e.preventDefault()
    setErro('')
    if (!SLUG_VALIDO.test(slugFinal) || slugFinal.length < 2) return setErro('O link aceita só letras minúsculas, números e hífen (ex.: construtora-abc).')
    if (!nova && slugFinal !== empresa.slug &&
      !window.confirm('Mudar o link invalida os cartazes e QR codes já impressos com o link antigo. Continuar?')) return
    setSalvando(true)
    try {
      const salva = await api.salvarEmpresa({
        id: empresa?.id, nome, slug: slugFinal, unidades: unidades.split('\n'), ativa,
      })
      await recarregarEmpresas()
      aoSalvar(salva)
    } catch (e2) {
      setErro(mensagemDeErro(e2))
    } finally {
      setSalvando(false)
    }
  }

  return (
    <form className={nova ? 'cartao' : ''} onSubmit={salvar}>
      {nova && <h2>Nova empresa</h2>}
      <div className="grade-2">
        <div className="campo">
          <label htmlFor="emp-nome">Nome da empresa</label>
          <input id="emp-nome" type="text" maxLength={160} value={nome} onChange={(e) => setNome(e.target.value)} required minLength={2} />
        </div>
        <div className="campo">
          <label htmlFor="emp-slug">Link <span className="opcional">(o final do endereço)</span></label>
          <input id="emp-slug" type="text" maxLength={60} className="mono" value={slugFinal}
            onChange={(e) => { setSlugManual(true); setSlug(e.target.value.toLowerCase()) }} required />
          <p className="dica">{linkDaEmpresa(slugFinal || '…')}</p>
        </div>
      </div>
      <div className="campo">
        <label htmlFor="emp-unidades">Unidades <span className="opcional">(uma por linha — aparecem no formulário de denúncia)</span></label>
        <textarea id="emp-unidades" rows={4} style={{ minHeight: 96 }} value={unidades} onChange={(e) => setUnidades(e.target.value)} />
      </div>
      {!nova && (
        <label className="caixa" style={{ marginBottom: 16 }}>
          <input type="checkbox" checked={ativa} onChange={(e) => setAtiva(e.target.checked)} />
          <span>Recebendo denúncias <span className="fraco">— desmarcado, o link para de abrir. As denúncias já recebidas continuam no painel.</span></span>
        </label>
      )}
      {erro && <div style={{ marginBottom: 12 }}><Aviso tipo="erro">{erro}</Aviso></div>}
      <button className="btn btn-primario" disabled={salvando}>{salvando ? 'Salvando…' : nova ? 'Criar empresa e gerar link' : 'Salvar alterações'}</button>
    </form>
  )
}
