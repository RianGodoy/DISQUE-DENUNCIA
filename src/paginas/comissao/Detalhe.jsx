import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { categoriaPorId, perigos } from '../../config'
import { Aviso, Carregando, Selo } from '../../componentes/Estrutura'
import { api } from '../../lib/api'
import { formatarProtocolo } from '../../lib/codigos'
import {
  ACOES, ACONTECENDO, FREQUENCIAS, GRAVIDADES, RESULTADOS, SITUACOES_MEDIDA, STATUS,
  TIPOS_MEDIDA, VINCULOS, data, dataHora, estaAberta, mensagemDeErro, paraInputData, rotuloStatus, situacaoPrazo,
} from '../../lib/formato'
import { useTitulo } from '../../lib/ganchos'
import { useComissao } from '../../lib/contextoComissao'
import { autorDaLinha, descreverDetalhe } from '../../lib/trilha'

const ORIGEM_IMPEDIMENTO = {
  denunciante: 'marcado pelo denunciante',
  declarado: 'declarou-se impedido(a)',
  admin: 'afastado(a) pelo administrador',
}

export default function Detalhe() {
  const { id } = useParams()
  const navegar = useNavigate()
  const { nomeDe } = useComissao()
  const [caso, setCaso] = useState(null)
  const [erro, setErro] = useState('')
  const [aba, setAba] = useState('conversa')
  useTitulo(caso ? `Denúncia ${formatarProtocolo(caso.denuncia.protocolo)}` : 'Denúncia')

  const recarregar = useCallback(
    (registrar = false) => api.abrirDenuncia(id, registrar).then(setCaso),
    [id],
  )

  useEffect(() => {
    recarregar(true).catch((e) => setErro(mensagemDeErro(e)))
  }, [recarregar])

  if (erro) {
    return (
      <>
        <Aviso tipo="erro">{erro}</Aviso>
        <p style={{ marginTop: 14 }}><Link to="/comissao/painel">← Voltar às denúncias</Link></p>
      </>
    )
  }
  if (!caso) return <Carregando />

  const d = caso.denuncia
  const cat = categoriaPorId(d.categoria)
  const prazo = situacaoPrazo(d)
  const novas = caso.mensagens.filter((m) => m.nova).length

  return (
    <>
      <p className="nao-imprimir" style={{ margin: '0 0 8px' }}><Link to="/comissao/painel">← Denúncias</Link></p>
      <div className="painel-cabeca">
        <div>
          <h1 className="mono" style={{ letterSpacing: '.06em' }}>{formatarProtocolo(d.protocolo)}</h1>
          <div className="botoes" style={{ marginTop: 8, gap: 6 }}>
            <Selo tom={STATUS[d.status].tom} ponto>{rotuloStatus(d.status)}</Selo>
            {d.gravidade && <Selo tom={GRAVIDADES[d.gravidade].tom}>Gravidade {GRAVIDADES[d.gravidade].rotulo.toLowerCase()}</Selo>}
            {cat?.urgente && <Selo tom="erro">urgente</Selo>}
            <span className={`prazo-${prazo.nivel}`} style={{ fontSize: '.9rem' }}>{prazo.texto}</span>
          </div>
        </div>
        <button className="btn btn-secundario btn-pequeno nao-imprimir" onClick={() => window.print()}>Imprimir</button>
      </div>

      <div className="detalhe-grade">
        <div className="pilha">
          <Relato d={d} anexos={caso.anexos} />
        </div>
        <div className="pilha nao-imprimir">
          <Triagem d={d} impedimentos={caso.impedimentos} aoSalvar={recarregar} />
          <Conclusao d={d} aoSalvar={recarregar} />
          <Sigilo d={d} impedimentos={caso.impedimentos} aoMudar={recarregar} aoPerderAcesso={() => navegar('/comissao/painel')} />
        </div>
      </div>

      <div className="cartao" style={{ marginTop: 16 }}>
        <nav className="abas nao-imprimir" style={{ marginTop: -6 }}>
          {[
            ['conversa', 'Conversa com denunciante', caso.mensagens.length, novas],
            ['notas', 'Notas internas', caso.notas.length],
            ['medidas', 'Medidas', caso.medidas.length],
            ['trilha', 'Trilha de auditoria', caso.historico.length],
          ].map(([chave, rotulo, qtd, destaque]) => (
            <button key={chave} className={aba === chave ? 'ativo' : ''} onClick={() => setAba(chave)}>
              {rotulo} <span className="fraco">({qtd})</span>
              {destaque > 0 && <span className="bolha">{destaque} nova{destaque > 1 ? 's' : ''}</span>}
            </button>
          ))}
        </nav>
        {aba === 'conversa' && <Conversa d={d} mensagens={caso.mensagens} nomeDe={nomeDe} aoEnviar={recarregar} />}
        {aba === 'notas' && <Notas d={d} notas={caso.notas} nomeDe={nomeDe} aoEnviar={recarregar} />}
        {aba === 'medidas' && <Medidas d={d} medidas={caso.medidas} aoMudar={recarregar} />}
        {aba === 'trilha' && <Trilha historico={caso.historico} nomeDe={nomeDe} />}
      </div>
    </>
  )
}

/* ------------------------------------------------------------------ relato */
function Relato({ d, anexos }) {
  const { nomeEmpresa } = useComissao()
  const cat = categoriaPorId(d.categoria)
  const [vendo, setVendo] = useState(null)
  const [erro, setErro] = useState('')

  async function abrir(a) {
    setErro('')
    try {
      const url = await api.urlAnexo(a)
      setVendo({ ...a, url })
    } catch (e) {
      setErro(mensagemDeErro(e))
    }
  }

  const quando = [d.data_fato && data(`${d.data_fato}T12:00`), d.quando].filter(Boolean).join(' · ')
  return (
    <div className="cartao">
      <div className="cartao-cabeca">
        <h2>Relato original</h2>
        <span className="fraco">recebido em {dataHora(d.criada_em)}</span>
      </div>
      <dl className="resumo-lista" style={{ marginBottom: 14 }}>
        <dt>Empresa</dt><dd><strong>{nomeEmpresa(d.empresa_id) || '—'}</strong></dd>
        <dt>Assunto</dt><dd>{cat?.titulo}</dd>
        <dt>Unidade</dt><dd>{d.unidade || '—'}</dd>
        {d.local && <><dt>Local</dt><dd>{d.local}</dd></>}
        {quando && <><dt>Quando</dt><dd>{quando}</dd></>}
        {d.acontecendo && <><dt>Ainda acontece?</dt><dd>{ACONTECENDO[d.acontecendo]}</dd></>}
        {d.frequencia && <><dt>Frequência</dt><dd>{FREQUENCIAS[d.frequencia]}</dd></>}
      </dl>
      <p className="relato-texto">{d.descricao}</p>
      <dl className="resumo-lista">
        <dt>Envolvidos</dt><dd>{d.envolvidos || '—'}</dd>
        <dt>Testemunhas</dt><dd>{d.testemunhas || '—'}</dd>
        <dt>Já contou a alguém?</dt><dd>{d.ja_relatou || '—'}</dd>
        <dt>Vínculo</dt><dd>{VINCULOS[d.vinculo] || '—'}</dd>
        <dt>Identificação</dt>
        <dd>{d.identificado ? <strong>{[d.nome, d.contato].filter(Boolean).join(' · ')}</strong> : 'Anônima'}</dd>
      </dl>
      <h3 style={{ marginTop: 16 }}>Anexos ({anexos.length})</h3>
      {anexos.length === 0 ? <p className="fraco" style={{ margin: 0 }}>Nenhum.</p> : (
        <div className="botoes" style={{ gap: 6 }}>
          {anexos.map((a) => (
            <button key={a.id} className="btn btn-secundario btn-pequeno" onClick={() => abrir(a)}>
              {a.tipo === 'application/pdf' ? '📄' : '🖼'} {a.nome}
            </button>
          ))}
        </div>
      )}
      {erro && <p className="dica" style={{ color: 'var(--erro)' }}>{erro}</p>}
      {vendo && (
        <div style={{ marginTop: 12 }}>
          <div className="botoes botoes-entre" style={{ marginBottom: 6 }}>
            <span className="fraco">{vendo.nome} · enviado em {dataHora(vendo.criado_em)}</span>
            <span className="botoes" style={{ gap: 6 }}>
              <a className="btn btn-secundario btn-pequeno" href={vendo.url} download={vendo.nome} target="_blank" rel="noreferrer">Baixar</a>
              <button className="btn btn-fantasma btn-pequeno" onClick={() => setVendo(null)}>Fechar</button>
            </span>
          </div>
          {vendo.tipo === 'application/pdf'
            ? <p className="fraco">PDF: use “Baixar” para abrir.</p>
            : <img src={vendo.url} alt={vendo.nome} style={{ borderRadius: 8, border: '1px solid var(--borda)' }} />}
        </div>
      )}
      <p className="dica" style={{ marginTop: 14 }}>O relato original não pode ser editado por ninguém.</p>
    </div>
  )
}

/* ----------------------------------------------------------------- triagem */
function Triagem({ d, impedimentos, aoSalvar }) {
  const { membros } = useComissao()
  const base = {
    status: d.status,
    gravidade: d.gravidade || '',
    perigo: d.perigo || categoriaPorId(d.categoria)?.perigo || '',
    encaminhar_pgr: d.encaminhar_pgr,
    responsavel_id: d.responsavel_id || '',
    prazo_conclusao: paraInputData(d.prazo_conclusao),
  }
  const [f, setF] = useState(base)
  const [motivo, setMotivo] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [msg, setMsg] = useState(null)
  useEffect(() => setF(base), [d.atualizada_em]) // eslint-disable-line react-hooks/exhaustive-deps

  const aberta = estaAberta(d)
  const impedidos = new Set(impedimentos.map((i) => i.user_id))
  const possiveis = membros.filter((m) => m.ativo && !impedidos.has(m.user_id))

  async function salvar(e) {
    e.preventDefault()
    const campos = {}
    if (f.status !== d.status) campos.status = f.status
    if ((f.gravidade || null) !== d.gravidade) campos.gravidade = f.gravidade || null
    if ((f.perigo || null) !== d.perigo) campos.perigo = f.perigo || null
    if (f.encaminhar_pgr !== d.encaminhar_pgr) campos.encaminhar_pgr = f.encaminhar_pgr
    if ((f.responsavel_id || null) !== d.responsavel_id) campos.responsavel_id = f.responsavel_id || null
    if (f.prazo_conclusao !== paraInputData(d.prazo_conclusao)) {
      // fim do dia escolhido, no fuso de quem está usando
      campos.prazo_conclusao = new Date(`${f.prazo_conclusao}T23:59:00`).toISOString()
    }
    if (!Object.keys(campos).length && !motivo.trim()) return setMsg({ tipo: 'info', texto: 'Nada mudou.' })
    setSalvando(true)
    setMsg(null)
    try {
      if (Object.keys(campos).length) await api.atualizarDenuncia(d.id, campos)
      if (motivo.trim()) await api.adicionarNota(d.id, `[Triagem] ${motivo.trim()}`)
      setMotivo('')
      await aoSalvar()
      setMsg({ tipo: 'ok', texto: 'Salvo.' })
    } catch (e2) {
      setMsg({ tipo: 'erro', texto: mensagemDeErro(e2) })
    } finally {
      setSalvando(false)
    }
  }

  const mudar = (c) => (e) => setF({ ...f, [c]: e.target.type === 'checkbox' ? e.target.checked : e.target.value })
  return (
    <form className="cartao" onSubmit={salvar}>
      <h2>Triagem e apuração</h2>
      <div className="grade-2">
        <div className="campo">
          <label htmlFor="t-status">Situação</label>
          <select id="t-status" value={f.status} onChange={mudar('status')} disabled={!aberta}>
            {['recebida', 'em_analise', 'em_apuracao', 'aguardando_info'].map((s) => <option key={s} value={s}>{rotuloStatus(s)}</option>)}
            {!aberta && <option value={d.status}>{rotuloStatus(d.status)}</option>}
          </select>
        </div>
        <div className="campo">
          <label htmlFor="t-grav">Gravidade</label>
          <select id="t-grav" value={f.gravidade} onChange={mudar('gravidade')}>
            <option value="">Não classificada</option>
            {Object.entries(GRAVIDADES).map(([v, g]) => <option key={v} value={v}>{g.rotulo}</option>)}
          </select>
        </div>
      </div>
      <div className="campo">
        <label htmlFor="t-perigo">Classificação do perigo (PGR)</label>
        <select id="t-perigo" value={f.perigo} onChange={mudar('perigo')}>
          <option value="">—</option>
          {Object.entries(perigos).map(([v, t]) => <option key={v} value={v}>{t}</option>)}
        </select>
      </div>
      <label className="caixa" style={{ marginBottom: 18 }}>
        <input type="checkbox" checked={f.encaminhar_pgr} onChange={mudar('encaminhar_pgr')} />
        <span>Encaminhar ao PGR <span className="fraco">— entra no relatório de riscos para o inventário e o plano de ação</span></span>
      </label>
      <div className="grade-2">
        <div className="campo">
          <label htmlFor="t-resp">Responsável</label>
          <select id="t-resp" value={f.responsavel_id} onChange={mudar('responsavel_id')}>
            <option value="">Ninguém ainda</option>
            {possiveis.map((m) => <option key={m.user_id} value={m.user_id}>{m.nome}</option>)}
          </select>
        </div>
        <div className="campo">
          <label htmlFor="t-prazo">Prazo de conclusão</label>
          <input id="t-prazo" type="date" value={f.prazo_conclusao} onChange={mudar('prazo_conclusao')} disabled={!aberta} />
        </div>
      </div>
      <div className="campo">
        <label htmlFor="t-motivo">Justificativa <span className="opcional">(vai para as notas internas)</span></label>
        <textarea id="t-motivo" rows={2} style={{ minHeight: 64 }} value={motivo} onChange={(e) => setMotivo(e.target.value)}
          placeholder="Ex.: prazo prorrogado porque a testemunha está de férias" />
      </div>
      {msg && <div style={{ marginBottom: 12 }}><Aviso tipo={msg.tipo}>{msg.texto}</Aviso></div>}
      <button className="btn btn-primario btn-bloco" disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar triagem'}</button>
    </form>
  )
}

/* --------------------------------------------------------------- conclusão */
function Conclusao({ d, aoSalvar }) {
  const [resultado, setResultado] = useState(d.resultado || '')
  const [resposta, setResposta] = useState(d.resposta_final || '')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const aberta = estaAberta(d)

  async function fechar(status) {
    setErro('')
    if (status === 'concluida' && !resultado) return setErro('Escolha o resultado da apuração.')
    if (resposta.trim().length < 10) return setErro('Escreva a resposta ao denunciante (ele vai ler este texto).')
    if (!window.confirm(status === 'concluida' ? 'Concluir a denúncia? O denunciante verá o resultado e a resposta.' : 'Arquivar a denúncia? O denunciante verá o motivo.')) return
    setSalvando(true)
    try {
      await api.atualizarDenuncia(d.id, { status, resultado: status === 'concluida' ? resultado : null, resposta_final: resposta.trim() })
      await aoSalvar()
    } catch (e) {
      setErro(mensagemDeErro(e))
    } finally {
      setSalvando(false)
    }
  }

  async function reabrir() {
    if (!window.confirm('Reabrir a denúncia? Ela volta para "Em apuração" e a resposta deixa de aparecer para o denunciante.')) return
    setSalvando(true)
    try {
      await api.atualizarDenuncia(d.id, { status: 'em_apuracao' })
      await aoSalvar()
    } catch (e) {
      setErro(mensagemDeErro(e))
    } finally {
      setSalvando(false)
    }
  }

  if (!aberta) {
    return (
      <div className="cartao">
        <div className="cartao-cabeca">
          <h2>{d.status === 'arquivada' ? 'Arquivada' : 'Concluída'}</h2>
          <span className="fraco">{dataHora(d.concluida_em)}</span>
        </div>
        {d.resultado && <p><Selo tom="info">{RESULTADOS[d.resultado]}</Selo></p>}
        <p style={{ whiteSpace: 'pre-wrap' }}>{d.resposta_final}</p>
        {erro && <div style={{ marginBottom: 12 }}><Aviso tipo="erro">{erro}</Aviso></div>}
        <button className="btn btn-secundario btn-pequeno" onClick={reabrir} disabled={salvando}>Reabrir</button>
      </div>
    )
  }

  return (
    <div className="cartao">
      <h2>Conclusão</h2>
      <div className="campo">
        <label htmlFor="c-res">Resultado</label>
        <select id="c-res" value={resultado} onChange={(e) => setResultado(e.target.value)}>
          <option value="">—</option>
          {Object.entries(RESULTADOS).map(([v, t]) => <option key={v} value={v}>{t}</option>)}
        </select>
      </div>
      <div className="campo">
        <label htmlFor="c-resp">Resposta ao denunciante</label>
        <textarea id="c-resp" rows={4} value={resposta} onChange={(e) => setResposta(e.target.value)}
          placeholder="O que foi apurado e o que foi feito — sem expor terceiros." />
        <p className="dica">O denunciante lê este texto. Não cite nomes de testemunhas nem detalhes sigilosos.</p>
      </div>
      {erro && <div style={{ marginBottom: 12 }}><Aviso tipo="erro">{erro}</Aviso></div>}
      <div className="botoes">
        <button className="btn btn-ok" onClick={() => fechar('concluida')} disabled={salvando}>Concluir</button>
        <button className="btn btn-secundario" onClick={() => fechar('arquivada')} disabled={salvando}>Arquivar</button>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ sigilo */
function Sigilo({ d, impedimentos, aoMudar, aoPerderAcesso }) {
  const { admin, membros, membro, nomeDe } = useComissao()
  const [alvo, setAlvo] = useState('')
  const [erro, setErro] = useState('')
  const impedidos = new Set(impedimentos.map((i) => i.user_id))
  const afastaveis = membros.filter((m) => m.ativo && !impedidos.has(m.user_id) && m.user_id !== membro.user_id)

  async function declarar() {
    const motivo = window.prompt('Você deixará de ver esta denúncia imediatamente. Motivo do impedimento (ex.: parentesco, subordinação, citado no relato):')
    if (motivo === null) return
    try {
      await api.declararImpedimento(d.id, motivo)
      aoPerderAcesso()
    } catch (e) {
      setErro(mensagemDeErro(e))
    }
  }

  async function afastar() {
    const motivo = window.prompt(`Motivo do afastamento de ${nomeDe(alvo)}:`)
    if (motivo === null) return
    try {
      await api.afastarMembro(d.id, alvo, motivo)
      setAlvo('')
      await aoMudar()
    } catch (e) {
      setErro(mensagemDeErro(e))
    }
  }

  async function revogar(userId) {
    if (!window.confirm(`Devolver o acesso de ${nomeDe(userId)} a esta denúncia?`)) return
    try {
      await api.revogarImpedimento(d.id, userId)
      await aoMudar()
    } catch (e) {
      setErro(mensagemDeErro(e))
    }
  }

  return (
    <div className="cartao">
      <h2>Sigilo</h2>
      {impedimentos.length === 0 ? (
        <p className="fraco">Nenhum membro afastado desta denúncia.</p>
      ) : (
        <ul style={{ paddingLeft: 18 }}>
          {impedimentos.map((i) => (
            <li key={i.user_id}>
              <strong>{nomeDe(i.user_id)}</strong> <span className="fraco">— {ORIGEM_IMPEDIMENTO[i.origem]}{i.motivo ? `: ${i.motivo}` : ''}</span>
              {admin && i.origem !== 'denunciante' && (
                <button className="btn btn-fantasma btn-pequeno" onClick={() => revogar(i.user_id)}>revogar</button>
              )}
            </li>
          ))}
        </ul>
      )}
      <p className="dica" style={{ marginBottom: 12 }}>Quem está afastado não vê a denúncia, a conversa, os anexos nem a trilha.</p>
      <button className="btn btn-perigo btn-pequeno" onClick={declarar}>Declarar-me impedido(a)</button>
      {admin && afastaveis.length > 0 && (
        <div className="botoes" style={{ marginTop: 12, gap: 6 }}>
          <select value={alvo} onChange={(e) => setAlvo(e.target.value)} style={{ flex: '1 1 180px', minHeight: 36, padding: '6px 10px' }} aria-label="Membro a afastar">
            <option value="">Afastar outro membro…</option>
            {afastaveis.map((m) => <option key={m.user_id} value={m.user_id}>{m.nome}</option>)}
          </select>
          <button className="btn btn-secundario btn-pequeno" disabled={!alvo} onClick={afastar}>Afastar</button>
        </div>
      )}
      {erro && <p className="dica" style={{ color: 'var(--erro)', marginTop: 8 }}>{erro}</p>}
    </div>
  )
}

/* ---------------------------------------------------------------- conversa */
function Conversa({ d, mensagens, nomeDe, aoEnviar }) {
  const [texto, setTexto] = useState('')
  const [pedirInfo, setPedirInfo] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')

  async function enviar(e) {
    e.preventDefault()
    if (!texto.trim()) return
    setEnviando(true)
    setErro('')
    try {
      await api.enviarMensagem(d.id, texto)
      if (pedirInfo && d.status !== 'aguardando_info') await api.atualizarDenuncia(d.id, { status: 'aguardando_info' })
      setTexto('')
      setPedirInfo(false)
      await aoEnviar()
    } catch (e2) {
      setErro(mensagemDeErro(e2))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <>
      <div className="conversa">
        {mensagens.length === 0 && <div className="vazio">Nenhuma mensagem. Use a conversa para pedir detalhes ao denunciante sem saber quem ele é.</div>}
        {mensagens.map((m) => (
          <div key={m.id} className={`msg ${m.autor === 'denunciante' ? 'msg-esquerda' : 'msg-direita'} ${m.nova ? 'msg-nova' : ''}`}>
            <small>{m.autor === 'denunciante' ? 'Denunciante' : nomeDe(m.autor_id) || 'Comissão'} · {dataHora(m.criada_em)}{m.nova ? ' · nova' : ''}</small>
            {m.texto}
          </div>
        ))}
      </div>
      {estaAberta(d) ? (
        <form onSubmit={enviar} className="nao-imprimir" style={{ marginTop: 16 }}>
          <div className="campo">
            <label htmlFor="m-texto">Mensagem ao denunciante</label>
            <textarea id="m-texto" rows={3} value={texto} onChange={(e) => setTexto(e.target.value)} maxLength={10000}
              placeholder="O denunciante lê esta mensagem no acompanhamento. Ele assina como “Comissão”." />
          </div>
          <label className="caixa" style={{ marginBottom: 12 }}>
            <input type="checkbox" checked={pedirInfo} onChange={(e) => setPedirInfo(e.target.checked)} />
            <span>É um pedido de informação — mudar a situação para “Aguardando denunciante”</span>
          </label>
          {erro && <div style={{ marginBottom: 12 }}><Aviso tipo="erro">{erro}</Aviso></div>}
          <div className="botoes botoes-fim"><button className="btn btn-primario" disabled={enviando || !texto.trim()}>{enviando ? 'Enviando…' : 'Enviar mensagem'}</button></div>
        </form>
      ) : <p className="fraco" style={{ marginTop: 12 }}>Denúncia encerrada. Reabra para voltar a conversar.</p>}
    </>
  )
}

/* ------------------------------------------------------------------- notas */
function Notas({ d, notas, nomeDe, aoEnviar }) {
  const [texto, setTexto] = useState('')
  const [erro, setErro] = useState('')
  async function enviar(e) {
    e.preventDefault()
    if (!texto.trim()) return
    try {
      await api.adicionarNota(d.id, texto)
      setTexto('')
      await aoEnviar()
    } catch (e2) {
      setErro(mensagemDeErro(e2))
    }
  }
  return (
    <>
      <p className="fraco">Só a comissão vê. Registre aqui entrevistas, diligências, encaminhamentos e decisões.</p>
      <div className="conversa">
        {notas.length === 0 && <div className="vazio">Nenhuma nota.</div>}
        {notas.map((n) => (
          <div key={n.id} className="msg msg-nota">
            <small>{nomeDe(n.autor_id)} · {dataHora(n.criada_em)}</small>
            {n.texto}
          </div>
        ))}
      </div>
      <form onSubmit={enviar} className="nao-imprimir" style={{ marginTop: 16 }}>
        <div className="campo">
          <label htmlFor="n-texto">Nova nota interna</label>
          <textarea id="n-texto" rows={3} value={texto} onChange={(e) => setTexto(e.target.value)} maxLength={10000} />
        </div>
        {erro && <div style={{ marginBottom: 12 }}><Aviso tipo="erro">{erro}</Aviso></div>}
        <div className="botoes botoes-fim"><button className="btn btn-primario" disabled={!texto.trim()}>Registrar nota</button></div>
      </form>
    </>
  )
}

/* ----------------------------------------------------------------- medidas */
function Medidas({ d, medidas, aoMudar }) {
  const vazio = { tipo: 'administrativa', descricao: '', responsavel: '', prazo: '' }
  const [nova, setNova] = useState(vazio)
  const [erro, setErro] = useState('')

  async function criar(e) {
    e.preventDefault()
    setErro('')
    try {
      await api.criarMedida(d.id, nova)
      setNova(vazio)
      await aoMudar()
    } catch (e2) {
      setErro(mensagemDeErro(e2))
    }
  }

  async function mudarSituacao(m, situacao) {
    try {
      await api.atualizarMedida(m.id, { situacao })
      await aoMudar()
    } catch (e) {
      setErro(mensagemDeErro(e))
    }
  }

  return (
    <>
      <p className="fraco">
        Registro das medidas de prevenção e correção (NR-01, item 1.5.5.3.1). Para risco ocupacional, siga a ordem de
        prioridade: eliminar o risco, proteção coletiva, medidas administrativas e, por último, EPI.
      </p>
      {medidas.length === 0 ? <div className="vazio">Nenhuma medida registrada.</div> : (
        <div className="tabela-rolagem">
          <table className="tabela">
            <thead><tr><th>Tipo</th><th>Medida</th><th>Responsável</th><th>Prazo</th><th>Situação</th></tr></thead>
            <tbody>
              {medidas.map((m) => {
                const atrasada = m.prazo && !['concluida', 'cancelada'].includes(m.situacao) && m.prazo < paraInputData(new Date())
                return (
                  <tr key={m.id}>
                    <td>{TIPOS_MEDIDA[m.tipo]}</td>
                    <td>{m.descricao}</td>
                    <td>{m.responsavel || '—'}</td>
                    <td className={`nowrap ${atrasada ? 'prazo-vencido' : ''}`}>{m.prazo ? data(`${m.prazo}T12:00`) : '—'}</td>
                    <td>
                      <select value={m.situacao} onChange={(e) => mudarSituacao(m, e.target.value)} style={{ minHeight: 34, padding: '4px 8px' }} aria-label="Situação da medida">
                        {Object.entries(SITUACOES_MEDIDA).map(([v, t]) => <option key={v} value={v}>{t}</option>)}
                      </select>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      <form onSubmit={criar} className="nao-imprimir" style={{ marginTop: 16 }}>
        <h3>Nova medida</h3>
        <div className="grade-2">
          <div className="campo">
            <label htmlFor="md-tipo">Tipo</label>
            <select id="md-tipo" value={nova.tipo} onChange={(e) => setNova({ ...nova, tipo: e.target.value })}>
              {Object.entries(TIPOS_MEDIDA).map(([v, t]) => <option key={v} value={v}>{t}</option>)}
            </select>
          </div>
          <div className="campo">
            <label htmlFor="md-resp">Responsável <span className="opcional">(opcional)</span></label>
            <input id="md-resp" type="text" maxLength={160} value={nova.responsavel} onChange={(e) => setNova({ ...nova, responsavel: e.target.value })} placeholder="Pessoa ou área" />
          </div>
        </div>
        <div className="campo">
          <label htmlFor="md-desc">O que será feito</label>
          <input id="md-desc" type="text" maxLength={2000} value={nova.descricao} onChange={(e) => setNova({ ...nova, descricao: e.target.value })} />
        </div>
        <div className="campo" style={{ maxWidth: 240 }}>
          <label htmlFor="md-prazo">Prazo <span className="opcional">(opcional)</span></label>
          <input id="md-prazo" type="date" value={nova.prazo} onChange={(e) => setNova({ ...nova, prazo: e.target.value })} />
        </div>
        {erro && <div style={{ marginBottom: 12 }}><Aviso tipo="erro">{erro}</Aviso></div>}
        <div className="botoes botoes-fim"><button className="btn btn-primario" disabled={nova.descricao.trim().length < 3}>Registrar medida</button></div>
      </form>
    </>
  )
}

/* ------------------------------------------------------------------ trilha */
function Trilha({ historico, nomeDe }) {
  return (
    <>
      <p className="fraco">Registro automático e permanente de quem fez o quê. Não pode ser editado nem apagado.</p>
      <div className="tabela-rolagem">
        <table className="tabela">
          <thead><tr><th>Quando</th><th>Quem</th><th>O quê</th><th>Detalhe</th></tr></thead>
          <tbody>
            {historico.map((h) => (
              <tr key={h.id}>
                <td className="nowrap">{dataHora(h.criado_em)}</td>
                <td>{autorDaLinha(h, nomeDe)}</td>
                <td>{ACOES[h.acao] || h.acao}</td>
                <td className="fraco">{descreverDetalhe(h, nomeDe)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
