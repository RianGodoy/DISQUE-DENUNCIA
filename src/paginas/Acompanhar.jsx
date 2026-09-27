import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { categoriaPorId, empresa, inatividadeMin } from '../config'
import { Aviso, Pagina, Selo } from '../componentes/Estrutura'
import SeletorAnexos from '../componentes/Anexos'
import { api, receberAcesso } from '../lib/api'
import { formatarProtocolo } from '../lib/codigos'
import { RESULTADOS, STATUS, data, dataHora, estaAberta, mensagemDeErro } from '../lib/formato'
import { useInatividade, useTitulo } from '../lib/ganchos'
import { useBase } from '../lib/contextoEmpresa'

/* Acompanhamento pelo protocolo + senha. O acesso vive só na memória da aba:
   recarregou, fechou ou ficou parado, precisa digitar de novo. */
export default function Acompanhar() {
  useTitulo('Acompanhar denúncia')
  const base = useBase()
  const [acesso, setAcesso] = useState(null)
  const [dados, setDados] = useState(null)
  const [form, setForm] = useState({ protocolo: '', senha: '' })
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')
  const [expirou, setExpirou] = useState(false)

  const entrarCom = useCallback(async (a) => {
    setCarregando(true)
    setErro('')
    setExpirou(false)
    try {
      setDados(await api.consultar(a.protocolo, a.senha))
      setAcesso(a)
      setForm({ protocolo: '', senha: '' })
    } catch (e) {
      setErro(mensagemDeErro(e))
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => {
    const a = receberAcesso()
    if (a) entrarCom(a)
  }, [entrarCom])

  const sair = useCallback((porTempo = false) => {
    setAcesso(null)
    setDados(null)
    setExpirou(porTempo === true)
  }, [])
  useInatividade(inatividadeMin.acompanhamento, () => sair(true), Boolean(acesso))

  if (!acesso || !dados) {
    return (
      <Pagina>
        <h1>Acompanhar denúncia</h1>
        <p className="suave">Informe o protocolo e a senha que apareceram quando você enviou a denúncia.</p>
        <form className="cartao" style={{ maxWidth: 520 }} onSubmit={(e) => { e.preventDefault(); entrarCom(form) }}>
          {expirou && <div style={{ marginBottom: 14 }}><Aviso>Saímos do acompanhamento depois de {inatividadeMin.acompanhamento} minutos sem uso, para proteger você.</Aviso></div>}
          <div className="campo">
            <label htmlFor="protocolo">Protocolo</label>
            <input id="protocolo" type="text" className="campo-codigo" autoComplete="off" autoCapitalize="characters"
              spellCheck={false} placeholder="XXXX-XXXX" value={form.protocolo}
              onChange={(e) => setForm({ ...form, protocolo: e.target.value })} required />
          </div>
          <div className="campo">
            <label htmlFor="senha">Senha</label>
            <input id="senha" type="password" className="campo-codigo" autoComplete="off" spellCheck={false}
              placeholder="XXXXX-XXXXX" value={form.senha}
              onChange={(e) => setForm({ ...form, senha: e.target.value })} required />
            <p className="dica">Maiúsculas, minúsculas e hífen tanto faz.</p>
          </div>
          {erro && <div style={{ marginBottom: 14 }}><Aviso tipo="erro">{erro}</Aviso></div>}
          <button className="btn btn-primario btn-bloco" disabled={carregando}>{carregando ? 'Conferindo…' : 'Ver minha denúncia'}</button>
        </form>
        <p className="fraco" style={{ marginTop: 16 }}>
          Perdeu a senha? Por segurança ela não pode ser recuperada. Se precisar, faça uma nova denúncia
          {base ? <> <Link to={`${base}/denunciar`}>por aqui</Link></> : ' pelo link da sua empresa'} e mencione no relato
          que é sobre o mesmo fato.
        </p>
      </Pagina>
    )
  }

  return (
    <Pagina>
      <Painel dados={dados} acesso={acesso} aoSair={sair} aoAtualizar={() => api.consultar(acesso.protocolo, acesso.senha).then(setDados)} />
    </Pagina>
  )
}

const ETAPAS = [
  { rotulo: 'Recebida', campo: 'criada_em' },
  { rotulo: 'Em análise', campo: 'triada_em' },
  { rotulo: 'Em apuração', campo: null },
  { rotulo: 'Resposta final', campo: 'concluida_em' },
]
const POSICAO = { recebida: 0, em_analise: 1, em_apuracao: 2, aguardando_info: 2, concluida: 3, arquivada: 3 }

function Painel({ dados, acesso, aoSair, aoAtualizar }) {
  const [texto, setTexto] = useState('')
  const [anexos, setAnexos] = useState([])
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')
  const [ok, setOk] = useState('')
  const st = STATUS[dados.status]
  const atual = POSICAO[dados.status]
  const aberta = estaAberta(dados)

  async function enviar(e) {
    e.preventDefault()
    if (!texto.trim() && !anexos.length) return setErro('Escreva uma mensagem ou escolha um arquivo.')
    setEnviando(true)
    setErro('')
    setOk('')
    try {
      if (texto.trim()) await api.complementar(acesso.protocolo, acesso.senha, texto)
      const falhas = []
      for (const [i, a] of anexos.entries()) {
        try {
          await api.enviarAnexo(acesso.protocolo, acesso.senha, a)
        } catch {
          falhas.push(i + 1)
        }
      }
      anexos.forEach((a) => a.previa && URL.revokeObjectURL(a.previa))
      setTexto('')
      setAnexos([])
      await aoAtualizar()
      if (falhas.length) setErro(`Não foi possível enviar o(s) anexo(s) ${falhas.join(', ')}. Tente de novo.`)
      else setOk('Enviado. A comissão verá sua mensagem.')
    } catch (e2) {
      setErro(mensagemDeErro(e2))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <>
      <div className="painel-cabeca">
        <div>
          <p className="fraco" style={{ margin: 0 }}>{dados.empresa ? `${dados.empresa} · protocolo` : 'Protocolo'}</p>
          <h1 className="mono" style={{ letterSpacing: '.08em' }}>{formatarProtocolo(dados.protocolo)}</h1>
        </div>
        <div className="botoes">
          <button className="btn btn-secundario btn-pequeno" onClick={() => aoAtualizar()}>Atualizar</button>
          <button className="btn btn-perigo btn-pequeno" onClick={aoSair}>Sair</button>
        </div>
      </div>

      <div className="cartao">
        <div className="cartao-cabeca">
          <h2>Situação</h2>
          <Selo tom={st.tom} ponto>{st.rotulo}</Selo>
        </div>
        <ol className="linha-tempo" aria-label="Andamento">
          {ETAPAS.map((e, i) => (
            <li key={e.rotulo} className={i < atual || (i === 3 && atual === 3) ? 'feito' : i === atual ? 'atual' : ''}>
              <b>{i === 3 && dados.status === 'arquivada' ? 'Arquivada' : e.rotulo}</b>
              {e.campo && dados[e.campo] ? data(dados[e.campo]) : ''}
            </li>
          ))}
        </ol>
        <p style={{ margin: '18px 0 0' }}>{st.paraDenunciante}</p>
        {aberta && <p className="fraco" style={{ margin: '6px 0 0' }}>Prazo para a resposta final: até {data(dados.prazo_conclusao)}.</p>}
      </div>

      {!aberta && (
        <div className="cartao">
          <div className="cartao-cabeca">
            <h2>Resposta da comissão</h2>
            {dados.resultado && <Selo tom="info">{RESULTADOS[dados.resultado]}</Selo>}
          </div>
          <p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{dados.resposta_final}</p>
        </div>
      )}

      <div className="cartao">
        <h2>Conversa com a comissão</h2>
        <p className="fraco">A comissão não sabe quem você é. Responda por aqui — nunca por outro meio que te identifique.</p>
        <div className="conversa">
          {dados.mensagens.length === 0 && <div className="vazio">Nenhuma mensagem ainda.</div>}
          {dados.mensagens.map((m, i) => (
            <div key={i} className={`msg ${m.autor === 'comissao' ? 'msg-esquerda' : 'msg-direita'}`}>
              <small>{m.autor === 'comissao' ? empresa.comissao : 'Você'} · {dataHora(m.criada_em)}</small>
              {m.texto}
            </div>
          ))}
        </div>
        <form onSubmit={enviar} style={{ marginTop: 18 }}>
          <div className="campo">
            <label htmlFor="msg">{dados.status === 'aguardando_info' ? 'Responder à comissão' : 'Acrescentar informação'}</label>
            <textarea id="msg" rows={4} maxLength={10000} value={texto} onChange={(e) => setTexto(e.target.value)}
              placeholder="Escreva aqui. Se quiser, anexe novas provas abaixo." />
          </div>
          <SeletorAnexos itens={anexos} aoMudar={setAnexos} />
          {erro && <div style={{ marginTop: 12 }}><Aviso tipo="erro">{erro}</Aviso></div>}
          {ok && <div style={{ marginTop: 12 }}><Aviso tipo="ok">{ok}</Aviso></div>}
          <div className="botoes botoes-fim" style={{ marginTop: 14 }}>
            <button className="btn btn-primario" disabled={enviando}>{enviando ? 'Enviando…' : 'Enviar'}</button>
          </div>
        </form>
      </div>

      <details className="dobra" style={{ marginTop: 16 }}>
        <summary>Seu relato original</summary>
        <div>
          <p className="fraco" style={{ marginBottom: 6 }}>
            {categoriaPorId(dados.categoria)?.titulo}{dados.unidade ? ` · ${dados.unidade}` : ''} · enviado em {dataHora(dados.criada_em)}
          </p>
          <p className="relato-texto">{dados.descricao}</p>
          {dados.anexos.length > 0 && <p className="fraco" style={{ margin: 0 }}>Anexos enviados: {dados.anexos.map((a) => a.nome).join(', ')}</p>}
        </div>
      </details>
      <p className="fraco" style={{ marginTop: 16 }}>Por segurança, esta tela fecha sozinha depois de {inatividadeMin.acompanhamento} minutos sem uso.</p>
    </>
  )
}
