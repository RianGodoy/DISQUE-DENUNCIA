import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { categoriaPorId, grupos, unidades as unidadesPadrao } from '../../config'
import { Aviso, Carregando, Selo } from '../../componentes/Estrutura'
import { Barras, contar, percentuais } from '../../componentes/Graficos'
import { api } from '../../lib/api'
import { useComissao } from '../../lib/contextoComissao'
import { SLUG_VALIDO, linkDaEmpresa, paraSlug } from '../../lib/contextoEmpresa'
import { ACOES, STATUS, data, dataHora, estaAberta, mensagemDeErro, rotuloStatus } from '../../lib/formato'
import { autorDaLinha, descreverDetalhe } from '../../lib/trilha'
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
          {admin && <button className={atual === 'historico' ? 'ativo' : ''} onClick={() => setAba('historico')}>Histórico</button>}
          {admin && <button className={atual === 'nova' ? 'ativo' : ''} onClick={() => setAba('nova')}>+ Nova empresa</button>}
        </nav>
      )}

      {atual === 'geral' && <VisaoGeral lista={lista} aoAbrir={setAba} />}
      {atual === 'nova' && admin && <FormEmpresa aoSalvar={(e) => setAba(e.id)} />}
      {atual === 'historico' && admin && <HistoricoEmpresas />}
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
                    <td>{e.nome}{!e.ativa && <> <Selo>vínculo encerrado</Selo></>}</td>
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
  const [vinculo, setVinculo] = useState(false)
  const [versaoHist, setVersaoHist] = useState(0)
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
          {empresa.ativa ? <Selo tom="ok" ponto>Vínculo ativo — recebendo denúncias</Selo> : <Selo ponto>Vínculo encerrado</Selo>}
        </div>
        {!empresa.ativa && (
          <div style={{ marginBottom: 14 }}>
            <Aviso tipo="alerta" titulo={`Vínculo encerrado${empresa.encerrada_em ? ` em ${data(empresa.encerrada_em)}` : ''}.`}>
              O link não abre mais e ninguém consegue denunciar por ele. As {den.length} denúncia(s) desta empresa
              continuam no painel até o prazo de guarda.
            </Aviso>
          </div>
        )}
        <label className="rotulo" htmlFor={`link-${empresa.id}`}>Link para divulgar</label>
        <div className="link-caixa" style={{ marginTop: 6 }}>
          <input id={`link-${empresa.id}`} type="text" readOnly value={link} onFocus={(e) => e.target.select()} />
          <button className="btn btn-secundario btn-pequeno" onClick={() => copiar(link)}>{copiado ? 'Copiado ✓' : 'Copiar'}</button>
          <Link className="btn btn-secundario btn-pequeno" to={`/e/${empresa.slug}`} target="_blank" rel="noreferrer">Abrir</Link>
          <Link className="btn btn-secundario btn-pequeno" to={`/cartaz/${empresa.slug}`}>Cartaz com QR code</Link>
          {admin && <button className="btn btn-fantasma btn-pequeno" onClick={() => { setEditando(!editando); setVinculo(false) }}>{editando ? 'Fechar edição' : 'Editar empresa'}</button>}
          {admin && (
            <button className={`btn btn-pequeno ${empresa.ativa ? 'btn-perigo' : 'btn-secundario'}`} onClick={() => { setVinculo(!vinculo); setEditando(false) }}>
              {vinculo ? 'Cancelar' : empresa.ativa ? 'Encerrar vínculo' : 'Reativar vínculo'}
            </button>
          )}
        </div>
        {editando && <div style={{ marginTop: 18 }}><FormEmpresa empresa={empresa} aoSalvar={() => setEditando(false)} /></div>}
        {vinculo && (
          <div style={{ marginTop: 18 }}>
            <FormVinculo empresa={empresa} abertas={den.filter(estaAberta).length} aoConcluir={() => { setVinculo(false); setVersaoHist((v) => v + 1) }} />
          </div>
        )}
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
      {admin && (
        <div className="cartao" style={{ marginTop: 16 }}>
          <h2>Histórico do vínculo</h2>
          <HistoricoEmpresas empresaId={empresa.id} slug={empresa.slug} versao={versaoHist} />
        </div>
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
        id: empresa?.id, nome, slug: slugFinal, unidades: unidades.split('\n'),
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
      {erro && <div style={{ marginBottom: 12 }}><Aviso tipo="erro">{erro}</Aviso></div>}
      <button className="btn btn-primario" disabled={salvando}>{salvando ? 'Salvando…' : nova ? 'Criar empresa e gerar link' : 'Salvar alterações'}</button>
    </form>
  )
}

/* ------------------------------------------------ encerrar / reativar vínculo */
function FormVinculo({ empresa, abertas, aoConcluir }) {
  const { membros, recarregarEmpresas, recarregarMembros } = useComissao()
  const encerrar = empresa.ativa
  const daEmpresa = membros.filter((m) => m.empresa_id === empresa.id && m.ativo)
  const [motivo, setMotivo] = useState('')
  const [desativar, setDesativar] = useState(true)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')

  async function confirmar(e) {
    e.preventDefault()
    setErro('')
    if (motivo.trim().length < 3) return setErro('Escreva o motivo — ele fica no histórico.')
    if (encerrar && !window.confirm(`Encerrar o vínculo com ${empresa.nome}? O link para de abrir na hora.`)) return
    setEnviando(true)
    try {
      if (encerrar) await api.encerrarEmpresa(empresa.id, motivo.trim(), desativar)
      else await api.reativarEmpresa(empresa.id, motivo.trim())
      await Promise.all([recarregarEmpresas(), recarregarMembros()])
      aoConcluir()
    } catch (e2) {
      setErro(mensagemDeErro(e2))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <form onSubmit={confirmar} style={{ borderTop: '1px solid var(--borda)', paddingTop: 16 }}>
      <h3>{encerrar ? 'Encerrar vínculo' : 'Reativar vínculo'} com {empresa.nome}</h3>
      {encerrar ? (
        <ul className="fraco" style={{ marginBottom: 12 }}>
          <li>O link e o QR code param de abrir na hora; ninguém mais denuncia por eles.</li>
          <li>As denúncias já recebidas continuam no painel{abertas ? <> — <strong>{abertas} ainda aberta(s)</strong>, que a comissão deve concluir</> : ''}.</li>
          <li>Dá para reativar depois; tudo fica no histórico.</li>
        </ul>
      ) : (
        <p className="fraco">O link volta a abrir. Membros desativados no encerramento não voltam sozinhos: reative em Membros.</p>
      )}
      <div className="campo">
        <label htmlFor={`motivo-${empresa.id}`}>Motivo</label>
        <textarea id={`motivo-${empresa.id}`} rows={2} style={{ minHeight: 64 }} value={motivo} onChange={(e) => setMotivo(e.target.value)}
          placeholder={encerrar ? 'Ex.: fim do contrato em 30/09/2026' : 'Ex.: contrato renovado'} maxLength={500} />
      </div>
      {encerrar && daEmpresa.length > 0 && (
        <label className="caixa" style={{ marginBottom: 14 }}>
          <input type="checkbox" checked={desativar} onChange={(e) => setDesativar(e.target.checked)} />
          <span>Desativar também os {daEmpresa.length} membro(s) da comissão ligados só a esta empresa ({daEmpresa.map((m) => m.nome).join(', ')})</span>
        </label>
      )}
      {erro && <div style={{ marginBottom: 12 }}><Aviso tipo="erro">{erro}</Aviso></div>}
      <button className={`btn ${encerrar ? 'btn-perigo' : 'btn-primario'}`} disabled={enviando}>
        {enviando ? 'Salvando…' : encerrar ? 'Encerrar vínculo' : 'Reativar vínculo'}
      </button>
    </form>
  )
}

/* ------------------------------------------------------------- histórico */
/** Cadastro, encerramento, reativação e mudanças das empresas. Sem `empresaId`
    mostra todas (mini-aba "Histórico"); com, só as daquela empresa. */
function HistoricoEmpresas({ empresaId, slug, versao = 0 }) {
  const { empresas, nomeDe } = useComissao()
  const [linhas, setLinhas] = useState(null)
  const [erro, setErro] = useState('')
  const [filtro, setFiltro] = useState('')

  useEffect(() => {
    api.historicoEmpresas().then(setLinhas).catch((e) => setErro(mensagemDeErro(e)))
  }, [versao, empresas])

  if (erro) return <Aviso tipo="erro">{erro}</Aviso>
  if (!linhas) return <Carregando />

  // registros antigos não têm empresa_id: aí o slug identifica
  const daEmpresa = (h, id, s) => h.detalhe?.empresa_id === id || (!h.detalhe?.empresa_id && h.detalhe?.slug === s)
  const alvo = empresaId ? { id: empresaId, slug } : empresas.find((e) => e.id === filtro)
  const visiveis = alvo ? linhas.filter((h) => daEmpresa(h, alvo.id, alvo.slug)) : linhas

  return (
    <>
      {!empresaId && (
        <div className="filtros" style={{ gridTemplateColumns: 'minmax(0, 320px)' }}>
          <select value={filtro} onChange={(e) => setFiltro(e.target.value)} aria-label="Empresa">
            <option value="">Todas as empresas</option>
            {empresas.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
          </select>
        </div>
      )}
      {visiveis.length === 0 ? <div className="vazio">Nenhum registro.</div> : (
        <div className="tabela-rolagem">
          <table className="tabela">
            <thead><tr><th>Quando</th>{!empresaId && <th>Empresa</th>}<th>O quê</th><th>Quem</th><th>Detalhe</th></tr></thead>
            <tbody>
              {visiveis.map((h) => (
                <tr key={h.id}>
                  <td className="nowrap">{dataHora(h.criado_em)}</td>
                  {!empresaId && <td>{h.detalhe?.nome || '—'}</td>}
                  <td>{ACOES[h.acao] || h.acao}</td>
                  <td>{autorDaLinha(h, nomeDe)}</td>
                  <td className="fraco">{descreverDetalhe(h, nomeDe)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
