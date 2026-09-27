import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { categoriaPorId, categorias, empresa, grupos, unidades as unidadesPadrao } from '../config'
import { Aviso, Opcao, Pagina } from '../componentes/Estrutura'
import Emergencia from '../componentes/Emergencia'
import SeletorAnexos from '../componentes/Anexos'
import { api, entregarAcesso } from '../lib/api'
import { formatarProtocolo, formatarSenha, gerarCodigo } from '../lib/codigos'
import { ACONTECENDO, FREQUENCIAS, JA_RELATOU, VINCULOS, data, mensagemDeErro, paraInputData } from '../lib/formato'
import { useAvisoAoSair, useCopiar, useTitulo } from '../lib/ganchos'
import { enderecoDoSite, useBase, useEmpresa } from '../lib/contextoEmpresa'

const ETAPAS = ['Assunto', 'Onde e quando', 'O que aconteceu', 'Sigilo', 'Revisar e enviar']

const INICIAL = {
  categoria: '', unidade: '', local: '', data_fato: '', quando: '', acontecendo: '', frequencia: '',
  descricao: '', envolvidos: '', testemunhas: '', ja_relatou: '',
  identificado: false, nome: '', contato: '', vinculo: 'nao_informado', impedidos: [],
}

/* O formulário vive só na memória da aba: nada de rascunho salvo no
   navegador, que ficaria no aparelho para quem pegar depois. Fechar a aba
   pede confirmação enquanto houver algo preenchido. */
export default function Denunciar() {
  useTitulo('Fazer denúncia')
  const daEmpresa = useEmpresa()
  const base = useBase()
  const unidades = daEmpresa.unidades?.length ? daEmpresa.unidades : unidadesPadrao
  const [etapa, setEtapa] = useState(0)
  const [d, setD] = useState(INICIAL)
  const [anexos, setAnexos] = useState([])
  const [membros, setMembros] = useState(null)
  const [boaFe, setBoaFe] = useState(false)
  const [armadilha, setArmadilha] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')
  const [resultado, setResultado] = useState(null)
  const cabeca = useRef(null)
  const hoje = paraInputData(new Date())

  useEffect(() => {
    // null = carregando · 'erro' = falhou · [] = comissão sem ninguém ainda
    api.membrosPublicos(daEmpresa.id).then(setMembros).catch(() => setMembros('erro'))
  }, [daEmpresa.id])
  useAvisoAoSair(!resultado && Boolean(d.categoria || d.descricao))

  const mudar = (campo) => (e) => {
    const v = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    setD((x) => ({ ...x, [campo]: v }))
  }
  const cat = categoriaPorId(d.categoria)

  function validar(n) {
    if (n === 0 && !d.categoria) return 'Escolha o assunto da denúncia.'
    if (n === 1 && d.data_fato && d.data_fato > hoje) return 'A data do fato não pode estar no futuro.'
    if (n === 2 && d.descricao.trim().length < 20) return 'Descreva o que aconteceu com pelo menos 20 caracteres.'
    if (n === 3 && d.identificado && !d.nome.trim() && !d.contato.trim()) {
      return 'Para se identificar, informe o nome ou um contato — ou volte para a opção anônima.'
    }
    if (n === 3 && Array.isArray(membros) && membros.length && d.impedidos.length >= membros.length) {
      return 'Deixe pelo menos um membro da comissão com acesso à denúncia.'
    }
    return ''
  }

  function irPara(n) {
    setErro('')
    setEtapa(n)
    cabeca.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function avancar() {
    const e = validar(etapa)
    if (e) return setErro(e)
    irPara(etapa + 1)
  }

  async function enviar() {
    for (let n = 0; n < 4; n++) {
      const e = validar(n)
      if (e) {
        irPara(n)
        return setErro(e)
      }
    }
    if (!boaFe) return setErro('Marque a declaração de boa-fé para enviar.')
    // campo-armadilha: invisível para pessoas, robôs preenchem. Finge que deu
    // certo e não envia nada.
    if (armadilha) return setResultado({ protocolo: gerarCodigo(8), senha: gerarCodigo(10), falhas: [], qtd: 0 })

    setEnviando(true)
    setErro('')
    try {
      const { protocolo, senha } = await api.registrarDenuncia({
        ...d,
        empresa: daEmpresa.slug,
        nome: d.identificado ? d.nome : '',
        contato: d.identificado ? d.contato : '',
        data_fato: d.data_fato || null,
      })
      const falhas = []
      for (let i = 0; i < anexos.length; i++) {
        try {
          await api.enviarAnexo(protocolo, senha, anexos[i])
        } catch {
          falhas.push(i + 1)
        }
      }
      anexos.forEach((a) => a.previa && URL.revokeObjectURL(a.previa))
      setResultado({ protocolo, senha, falhas, qtd: anexos.length, urgente: cat?.urgente })
      setAnexos([])
      setD(INICIAL)
    } catch (e) {
      setErro(mensagemDeErro(e))
    } finally {
      setEnviando(false)
    }
  }

  if (resultado) return <Confirmacao {...resultado} />

  return (
    <Pagina>
      <div ref={cabeca} style={{ scrollMarginTop: 80 }}>
        <p className="fraco" style={{ margin: 0, fontWeight: 600 }}>{daEmpresa.nome}</p>
        <h1>Fazer uma denúncia</h1>
        <p className="suave">Leva uns 5 minutos. Nada é enviado até você confirmar na última etapa.</p>
      </div>

      <ol className="etapas" aria-label="Etapas">
        {ETAPAS.map((nome, i) => (
          <li key={nome} className={i < etapa ? 'feita' : i === etapa ? 'atual' : ''} aria-current={i === etapa ? 'step' : undefined}>
            <div className="barra" />
            <span>{i + 1}. {nome}</span>
          </li>
        ))}
      </ol>

      <div className="cartao">
        {etapa === 0 && (
          <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
            <legend className="rotulo" style={{ marginBottom: 12 }}>Sobre o que é a denúncia?</legend>
            {Object.entries(grupos).map(([g, titulo]) => (
              <div key={g}>
                <p className="grupo-titulo">{titulo}</p>
                <div className="opcoes opcoes-2">
                  {categorias.filter((c) => c.grupo === g).map((c) => (
                    <Opcao key={c.id} nome="categoria" valor={c.id} marcado={d.categoria === c.id}
                      aoMudar={mudar('categoria')} titulo={c.titulo} detalhe={c.resumo}
                      className={c.urgente ? 'urgente' : ''} />
                  ))}
                </div>
              </div>
            ))}
            {cat?.exemplos.length > 0 && (
              <div className="aviso" style={{ marginTop: 16 }}>
                <strong>{cat.titulo}</strong> — por exemplo:
                <ul style={{ margin: '6px 0 0' }}>{cat.exemplos.map((x) => <li key={x}>{x}</li>)}</ul>
              </div>
            )}
            {cat?.urgente && <Emergencia />}
          </fieldset>
        )}

        {etapa === 1 && (
          <>
            <div className="grade-2">
              <div className="campo">
                <label htmlFor="unidade">Unidade <span className="opcional">(opcional)</span></label>
                <select id="unidade" value={d.unidade} onChange={mudar('unidade')}>
                  <option value="">Prefiro não informar</option>
                  {unidades.map((u) => <option key={u}>{u}</option>)}
                </select>
              </div>
              <div className="campo">
                <label htmlFor="local">Setor ou local <span className="opcional">(opcional)</span></label>
                <input id="local" type="text" maxLength={200} value={d.local} onChange={mudar('local')}
                  placeholder="Ex.: oficina, refeitório, linha 2" />
              </div>
            </div>
            <div className="grade-2">
              <div className="campo">
                <label htmlFor="data">Data do fato <span className="opcional">(se souber)</span></label>
                <input id="data" type="date" max={hoje} value={d.data_fato} onChange={mudar('data_fato')} />
              </div>
              <div className="campo">
                <label htmlFor="quando">Quando acontece <span className="opcional">(opcional)</span></label>
                <input id="quando" type="text" maxLength={200} value={d.quando} onChange={mudar('quando')}
                  placeholder="Ex.: toda segunda de manhã, desde março" />
              </div>
            </div>
            <div className="campo">
              <span className="rotulo">Ainda está acontecendo?</span>
              <div className="opcoes-linha">
                {Object.entries(ACONTECENDO).map(([v, t]) => (
                  <Opcao key={v} nome="acontecendo" valor={v} marcado={d.acontecendo === v} aoMudar={mudar('acontecendo')} titulo={t} className="compacta" />
                ))}
              </div>
            </div>
            <div className="campo" style={{ marginBottom: 0 }}>
              <span className="rotulo">Com que frequência?</span>
              <div className="opcoes-linha">
                {Object.entries(FREQUENCIAS).map(([v, t]) => (
                  <Opcao key={v} nome="frequencia" valor={v} marcado={d.frequencia === v} aoMudar={mudar('frequencia')} titulo={t} className="compacta" />
                ))}
              </div>
            </div>
          </>
        )}

        {etapa === 2 && (
          <>
            <div className="campo">
              <label htmlFor="descricao">O que aconteceu?</label>
              <p className="dica">
                Conte o que houve, quem fez (nome ou cargo), com quem, onde e como. Se quiser ficar anônimo(a), evite
                detalhes que só você saberia.
              </p>
              <textarea id="descricao" rows={8} maxLength={20000} value={d.descricao} onChange={mudar('descricao')} />
              <span className={`contador ${d.descricao.trim().length < 20 ? 'falta' : ''}`}>
                {d.descricao.trim().length < 20 ? `mínimo 20 caracteres (${d.descricao.trim().length})` : `${d.descricao.length} caracteres`}
              </span>
            </div>
            <div className="grade-2">
              <div className="campo">
                <label htmlFor="envolvidos">Pessoas envolvidas <span className="opcional">(opcional)</span></label>
                <textarea id="envolvidos" rows={3} maxLength={2000} value={d.envolvidos} onChange={mudar('envolvidos')}
                  placeholder="Nome, apelido ou cargo de quem praticou" style={{ minHeight: 90 }} />
              </div>
              <div className="campo">
                <label htmlFor="testemunhas">Testemunhas <span className="opcional">(opcional)</span></label>
                <textarea id="testemunhas" rows={3} maxLength={2000} value={d.testemunhas} onChange={mudar('testemunhas')}
                  placeholder="Quem viu ou sabe do que aconteceu" style={{ minHeight: 90 }} />
              </div>
            </div>
            <div className="campo">
              <label htmlFor="ja_relatou">Você já contou isso a alguém da empresa? <span className="opcional">(opcional)</span></label>
              <select id="ja_relatou" value={d.ja_relatou} onChange={mudar('ja_relatou')}>
                <option value="">Prefiro não dizer</option>
                {JA_RELATOU.map((x) => <option key={x}>{x}</option>)}
              </select>
            </div>
            <div className="campo" style={{ marginBottom: 0 }}>
              <span className="rotulo">Provas <span className="opcional">(opcional)</span></span>
              <SeletorAnexos itens={anexos} aoMudar={setAnexos} />
            </div>
          </>
        )}

        {etapa === 3 && (
          <>
            {/* comissão ainda sem ninguém cadastrado: não há quem marcar */}
            {!(Array.isArray(membros) && membros.length === 0) && <div className="campo">
              <span className="rotulo">Alguém da comissão está envolvido?</span>
              <p className="dica">
                Marque quem NÃO deve ter acesso. Essa pessoa não verá a denúncia nem saberá que ela existe.
              </p>
              {membros === null ? (
                <p className="fraco">Carregando a lista da comissão…</p>
              ) : membros === 'erro' ? (
                <Aviso tipo="alerta">
                  Não foi possível carregar a lista da comissão agora. Se alguém da comissão estiver envolvido,
                  tente de novo em alguns minutos antes de enviar.
                </Aviso>
              ) : (
                <div className="opcoes opcoes-2">
                  {membros.map((m) => (
                    <Opcao key={m.id} tipo="checkbox" nome="impedidos" valor={m.id} titulo={m.nome}
                      marcado={d.impedidos.includes(m.id)}
                      aoMudar={() => setD((x) => ({
                        ...x,
                        impedidos: x.impedidos.includes(m.id) ? x.impedidos.filter((i) => i !== m.id) : [...x.impedidos, m.id],
                      }))} />
                  ))}
                </div>
              )}
            </div>}

            <div className="campo">
              <span className="rotulo">Identificação</span>
              <div className="opcoes opcoes-2">
                <Opcao nome="identificado" valor="nao" marcado={!d.identificado}
                  aoMudar={() => setD((x) => ({ ...x, identificado: false }))}
                  titulo="Quero continuar anônimo(a)" detalhe="Recomendado. Você acompanha pelo protocolo e senha." />
                <Opcao nome="identificado" valor="sim" marcado={d.identificado}
                  aoMudar={() => setD((x) => ({ ...x, identificado: true }))}
                  titulo="Quero me identificar" detalhe="A comissão verá seu nome e poderá falar com você." />
              </div>
            </div>
            {d.identificado && (
              <>
                <Aviso tipo="alerta" titulo="Atenção:">
                  com identificação, seu nome fica visível para a comissão. O sigilo continua: ele não é revelado a
                  quem foi denunciado nem a outras áreas.
                </Aviso>
                <div className="grade-2" style={{ marginTop: 14 }}>
                  <div className="campo">
                    <label htmlFor="nome">Nome</label>
                    <input id="nome" type="text" maxLength={160} value={d.nome} onChange={mudar('nome')} autoComplete="off" />
                  </div>
                  <div className="campo">
                    <label htmlFor="contato">Telefone ou e-mail <span className="opcional">(opcional)</span></label>
                    <input id="contato" type="text" maxLength={160} value={d.contato} onChange={mudar('contato')} autoComplete="off" />
                  </div>
                </div>
              </>
            )}
            <div className="campo" style={{ marginBottom: 0 }}>
              <label htmlFor="vinculo">Sua relação com a empresa <span className="opcional">(opcional)</span></label>
              <select id="vinculo" value={d.vinculo} onChange={mudar('vinculo')}>
                {Object.entries(VINCULOS).map(([v, t]) => <option key={v} value={v}>{t}</option>)}
              </select>
              <p className="dica">Ajuda a direcionar a apuração. Se isso puder te identificar, deixe “Prefiro não informar”.</p>
            </div>
          </>
        )}

        {etapa === 4 && (
          <>
            <h2>Confira antes de enviar</h2>
            <dl className="resumo-lista">
              <dt>Assunto</dt><dd>{cat?.titulo}</dd>
              <dt>Unidade</dt><dd>{d.unidade || 'Não informada'}</dd>
              {d.local && <><dt>Local</dt><dd>{d.local}</dd></>}
              {(d.data_fato || d.quando) && <><dt>Quando</dt><dd>{[d.data_fato && data(`${d.data_fato}T12:00`), d.quando].filter(Boolean).join(' · ')}</dd></>}
              {d.acontecendo && <><dt>Ainda acontece?</dt><dd>{ACONTECENDO[d.acontecendo]}</dd></>}
              {d.frequencia && <><dt>Frequência</dt><dd>{FREQUENCIAS[d.frequencia]}</dd></>}
              <dt>Relato</dt><dd>{d.descricao}</dd>
              {d.envolvidos && <><dt>Envolvidos</dt><dd>{d.envolvidos}</dd></>}
              {d.testemunhas && <><dt>Testemunhas</dt><dd>{d.testemunhas}</dd></>}
              {d.ja_relatou && <><dt>Já contou a alguém?</dt><dd>{d.ja_relatou}</dd></>}
              <dt>Anexos</dt><dd>{anexos.length ? `${anexos.length} arquivo(s), sem metadados` : 'Nenhum'}</dd>
              <dt>Sem acesso</dt><dd>{d.impedidos.length && Array.isArray(membros) ? membros.filter((m) => d.impedidos.includes(m.id)).map((m) => m.nome).join(', ') : 'Ninguém excluído'}</dd>
              <dt>Identificação</dt><dd>{d.identificado ? [d.nome, d.contato].filter(Boolean).join(' · ') : 'Anônima'}</dd>
            </dl>
            <div style={{ marginTop: 20 }}>
              <label className="caixa">
                <input type="checkbox" checked={boaFe} onChange={(e) => setBoaFe(e.target.checked)} />
                <span>Relato de boa-fé, com informações verdadeiras até onde sei.</span>
              </label>
            </div>
            {/* armadilha para robôs — fora da tela, fora do Tab, sem autocompletar */}
            <div className="oculto-visual" aria-hidden="true">
              <label>Não preencha este campo <input type="text" tabIndex={-1} autoComplete="off" value={armadilha} onChange={(e) => setArmadilha(e.target.value)} /></label>
            </div>
          </>
        )}

        {erro && <div style={{ marginTop: 16 }}><Aviso tipo="erro">{erro}</Aviso></div>}

        <div className="botoes botoes-entre" style={{ marginTop: 22 }}>
          {etapa > 0
            ? <button type="button" className="btn btn-secundario" onClick={() => irPara(etapa - 1)} disabled={enviando}>Voltar</button>
            : <Link to={base} className="btn btn-fantasma">Cancelar</Link>}
          {etapa < ETAPAS.length - 1
            ? <button type="button" className="btn btn-primario" onClick={avancar}>Continuar</button>
            : <button type="button" className="btn btn-primario btn-grande" onClick={enviar} disabled={enviando}>
                {enviando ? 'Enviando…' : 'Enviar denúncia'}
              </button>}
        </div>
      </div>
      <p className="fraco" style={{ marginTop: 14 }}>
        Quem recebe: {empresa.comissao}. Veja a <Link to={`${base}/como-funciona`}>política do canal</Link>.
      </p>
    </Pagina>
  )
}

function Confirmacao({ protocolo, senha, falhas, qtd, urgente }) {
  useTitulo('Denúncia enviada')
  const navegar = useNavigate()
  const daEmpresa = useEmpresa()
  const base = useBase()
  const [copiado, copiar] = useCopiar()
  const [anotei, setAnotei] = useState(false)
  useAvisoAoSair(!anotei)
  const p = formatarProtocolo(protocolo)
  const s = formatarSenha(senha)
  const texto = `Canal de Denúncias — ${daEmpresa.nome}\nProtocolo: ${p}\nSenha: ${s}\n\nAcompanhe em: ${enderecoDoSite()}/#${base}/acompanhar\nGuarde em local seguro. A senha não pode ser recuperada.\n`

  function baixar() {
    const url = URL.createObjectURL(new Blob([texto], { type: 'text/plain;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = 'canal-denuncia-protocolo.txt'
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return (
    <Pagina>
      <div className="cartao">
        <Aviso tipo="ok" titulo="Denúncia enviada.">A {empresa.comissao} já pode lê-la.</Aviso>
        <h1 style={{ marginTop: 18 }}>Anote agora o protocolo e a senha</h1>
        <p>
          Esta é a <strong>única vez</strong> que a senha aparece. Sem ela não dá para acompanhar a denúncia nem
          responder à comissão — e ninguém consegue recuperá-la, porque ela não fica guardada em lugar nenhum.
        </p>
        <div className="credenciais">
          <div className="credencial">
            <small>Protocolo</small>
            <div className="codigo-grande">{p}</div>
            <button className="btn btn-secundario btn-pequeno" onClick={() => copiar(p, 'p')}>{copiado === 'p' ? 'Copiado ✓' : 'Copiar'}</button>
          </div>
          <div className="credencial">
            <small>Senha</small>
            <div className="codigo-grande">{s}</div>
            <button className="btn btn-secundario btn-pequeno" onClick={() => copiar(s, 's')}>{copiado === 's' ? 'Copiada ✓' : 'Copiar'}</button>
          </div>
        </div>
        <div className="botoes">
          <button className="btn btn-secundario" onClick={() => copiar(texto, 't')}>{copiado === 't' ? 'Copiado ✓' : 'Copiar os dois'}</button>
          <button className="btn btn-secundario" onClick={baixar}>Baixar em arquivo</button>
        </div>
        <p className="dica" style={{ marginTop: 8 }}>
          O arquivo baixado e o que você copiar ficam no seu aparelho. Se outra pessoa usa este aparelho, prefira anotar em papel.
        </p>

        {falhas.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <Aviso tipo="alerta" titulo="Anexos não enviados:">
              {falhas.length === qtd ? 'nenhum dos anexos foi enviado' : `anexo(s) ${falhas.join(', ')}`}. A denúncia foi
              registrada mesmo assim; você pode mandar os arquivos pelo acompanhamento.
            </Aviso>
          </div>
        )}
        {urgente && (
          <div style={{ marginTop: 16 }}>
            <Aviso tipo="erro" titulo="Risco urgente:">
              se a situação continua agora, avise também o supervisor ou a segurança do trabalho. A triagem deste
              caso é em até 24 horas, mas um aviso imediato pode evitar um acidente.
            </Aviso>
          </div>
        )}

        <h2 style={{ marginTop: 24 }}>E agora?</h2>
        <ul>
          <li>A comissão faz a primeira análise e pode te mandar perguntas pelo canal.</li>
          <li>Volte de vez em quando em <strong>Acompanhar</strong> e informe protocolo e senha para ver a situação e responder.</li>
          <li>Quando a apuração terminar, a resposta aparece lá.</li>
        </ul>

        <label className="caixa" style={{ margin: '18px 0' }}>
          <input type="checkbox" checked={anotei} onChange={(e) => setAnotei(e.target.checked)} />
          <span>Anotei o protocolo e a senha.</span>
        </label>
        <div className="botoes">
          <button className="btn btn-primario" disabled={!anotei}
            onClick={() => { entregarAcesso({ protocolo, senha }); navegar(`${base}/acompanhar`) }}>
            Ver o acompanhamento
          </button>
          <button className="btn btn-fantasma" disabled={!anotei} onClick={() => navegar(base)}>Voltar ao início</button>
        </div>
      </div>
    </Pagina>
  )
}
