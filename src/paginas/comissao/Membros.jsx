import { useEffect, useState } from 'react'
import { empresa } from '../../config'
import { Aviso, Selo } from '../../componentes/Estrutura'
import { api, modoDemo } from '../../lib/api'
import { data, mensagemDeErro } from '../../lib/formato'
import { useTitulo } from '../../lib/ganchos'
import { useComissao } from '../../lib/contextoComissao'
import { enderecoDoSite } from '../../lib/contextoEmpresa'

export default function Membros() {
  useTitulo('Membros da comissão')
  const { membros, membro: eu, recarregarMembros, empresas } = useComissao()
  const [novo, setNovo] = useState({ email: '', nome: '', papel: 'membro', empresaId: '' })
  const [msg, setMsg] = useState(null)
  const [anos, setAnos] = useState(empresa.retencaoAnos)

  async function adicionar(e) {
    e.preventDefault()
    setMsg(null)
    try {
      await api.adicionarMembro({ ...novo, empresaId: novo.empresaId || null })
      setNovo({ email: '', nome: '', papel: 'membro', empresaId: '' })
      await recarregarMembros()
      setMsg({ tipo: 'ok', texto: 'Membro cadastrado.' })
    } catch (e2) {
      setMsg({ tipo: 'erro', texto: mensagemDeErro(e2) })
    }
  }

  async function alterar(m, campos) {
    setMsg(null)
    const ativosAdmin = membros.filter((x) => x.ativo && x.papel === 'admin')
    const perdeAdmin = m.papel === 'admin' && (campos.papel === 'membro' || campos.ativo === false)
    if (perdeAdmin && ativosAdmin.length <= 1) {
      return setMsg({ tipo: 'erro', texto: 'O canal precisa de pelo menos um administrador ativo.' })
    }
    if (m.user_id === eu.user_id && perdeAdmin && !window.confirm('Você vai perder o acesso de administrador. Continuar?')) return
    try {
      await api.atualizarMembro(m.user_id, campos)
      await recarregarMembros()
    } catch (e) {
      setMsg({ tipo: 'erro', texto: mensagemDeErro(e) })
    }
  }

  async function expurgar() {
    if (!window.confirm(`Apagar o relato, os nomes citados, a identificação e as conversas das denúncias encerradas há mais de ${anos} ano(s)? Isso não pode ser desfeito.`)) return
    try {
      const n = await api.expurgar(Number(anos))
      setMsg({ tipo: 'ok', texto: `${n} denúncia(s) expurgada(s).` })
    } catch (e) {
      setMsg({ tipo: 'erro', texto: mensagemDeErro(e) })
    }
  }

  return (
    <div className="pilha">
      {msg && <Aviso tipo={msg.tipo}>{msg.texto}</Aviso>}
      <div className="cartao">
        <h2>Membros da {empresa.comissao}</h2>
        <p className="fraco">
          Recomendado: representantes de áreas diferentes (RH, CIPA, segurança do trabalho, jurídico), para que sempre
          sobre alguém sem conflito de interesse. Membro inativo perde o acesso na hora. Membro ligado a uma empresa só
          vê as denúncias dela; o administrador vê todas.
        </p>
        <div className="tabela-rolagem">
          <table className="tabela">
            <thead><tr><th>Nome</th><th>E-mail</th><th>Papel</th><th>Vê as denúncias de</th><th>Situação</th><th>Desde</th></tr></thead>
            <tbody>
              {membros.map((m) => (
                <tr key={m.user_id}>
                  <td><strong>{m.nome}</strong>{m.user_id === eu.user_id && <span className="fraco"> (você)</span>}</td>
                  <td>{m.email}</td>
                  <td>
                    <select value={m.papel} style={{ minHeight: 34, padding: '4px 8px' }} aria-label={`Papel de ${m.nome}`}
                      onChange={(e) => {
                        const papel = e.target.value
                        // administrador é sempre da administração do canal: passa a ver todas as empresas
                        if (papel === 'admin' && m.empresa_id && !window.confirm(`${m.nome} passará a ver as denúncias de TODAS as empresas. Continuar?`)) return
                        alterar(m, papel === 'admin' ? { papel, empresa_id: null } : { papel })
                      }}>
                      <option value="membro">Membro</option>
                      <option value="admin">Administrador</option>
                    </select>
                  </td>
                  <td>
                    <select value={m.empresa_id || ''} disabled={m.papel === 'admin'} style={{ minHeight: 34, padding: '4px 8px' }}
                      aria-label={`Empresas que ${m.nome} vê`}
                      onChange={(e) => {
                        const empresaId = e.target.value || null
                        if (!empresaId && !window.confirm(`${m.nome} passará a ver as denúncias de TODAS as empresas. Continuar?`)) return
                        alterar(m, { empresa_id: empresaId })
                      }}>
                      <option value="">Todas as empresas</option>
                      {empresas.map((e) => <option key={e.id} value={e.id}>Só {e.nome}</option>)}
                    </select>
                  </td>
                  <td>
                    <button className="btn btn-fantasma btn-pequeno" onClick={() => alterar(m, { ativo: !m.ativo })} title={m.ativo ? 'Desativar' : 'Reativar'}>
                      {m.ativo ? <Selo tom="ok" ponto>Ativo</Selo> : <Selo ponto>Inativo</Selo>}
                    </button>
                  </td>
                  <td className="nowrap">{data(m.criado_em)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <form className="cartao" onSubmit={adicionar}>
        <h2>Cadastrar membro</h2>
        {!modoDemo && (
          <Aviso>
            Primeiro crie o usuário no Supabase em <strong>Authentication → Users → Add user</strong> (com “Auto Confirm
            User” marcado) e passe a senha à pessoa. Depois cadastre aqui o mesmo e-mail.
          </Aviso>
        )}
        <div className="grade-2" style={{ marginTop: 14 }}>
          <div className="campo">
            <label htmlFor="mb-nome">Nome</label>
            <input id="mb-nome" type="text" value={novo.nome} onChange={(e) => setNovo({ ...novo, nome: e.target.value })} required minLength={2} />
          </div>
          <div className="campo">
            <label htmlFor="mb-email">E-mail</label>
            <input id="mb-email" type="email" value={novo.email} onChange={(e) => setNovo({ ...novo, email: e.target.value })} required />
          </div>
          <div className="campo">
            <label htmlFor="mb-papel">Papel</label>
            <select id="mb-papel" value={novo.papel}
              onChange={(e) => setNovo({ ...novo, papel: e.target.value, empresaId: e.target.value === 'admin' ? '' : novo.empresaId })}>
              <option value="membro">Membro</option>
              <option value="admin">Administrador</option>
            </select>
          </div>
          <div className="campo">
            <label htmlFor="mb-empresa">Vê as denúncias de</label>
            <select id="mb-empresa" value={novo.empresaId} disabled={novo.papel === 'admin'}
              onChange={(e) => setNovo({ ...novo, empresaId: e.target.value })}>
              <option value="">Todas as empresas (administração do canal)</option>
              {empresas.map((e) => <option key={e.id} value={e.id}>Só {e.nome}</option>)}
            </select>
            <p className="dica">Para o RH ou a CIPA de uma empresa cliente, escolha a empresa: ele não verá as outras.</p>
          </div>
        </div>
        <button className="btn btn-primario">Cadastrar</button>
      </form>

      <AvisosEmail />

      <div className="cartao">
        <h2>Expurgo de dados (LGPD)</h2>
        <p className="fraco">
          Apaga o texto do relato, os nomes citados, a identificação do denunciante, as mensagens e as notas das
          denúncias encerradas há mais tempo que o prazo de guarda. Ficam só assunto, unidade, datas, gravidade e
          resultado, que alimentam os indicadores. Os arquivos anexos devem ser apagados à parte, no painel Storage do
          Supabase. Rode uma vez por ano.
        </p>
        <div className="botoes">
          <label htmlFor="anos" className="rotulo">Encerradas há mais de</label>
          <input id="anos" type="number" min={1} max={20} value={anos} onChange={(e) => setAnos(e.target.value)} style={{ width: 90 }} />
          <span>ano(s)</span>
          <button className="btn btn-perigo" onClick={expurgar} type="button">Executar expurgo</button>
        </div>
      </div>
    </div>
  )
}

/* Quem recebe o e-mail de "chegou denúncia nova". O e-mail nunca leva o
   relato: só avisa, com protocolo, assunto e prazo, e aponta para o painel. */
function AvisosEmail() {
  const [dados, setDados] = useState(null)
  const [novo, setNovo] = useState('')
  const [site, setSite] = useState('')
  const [msg, setMsg] = useState(null)

  const carregar = () => api.listarAvisos().then((d) => { setDados(d); setSite(d.siteUrl) })
  useEffect(() => {
    carregar().catch((e) => setMsg({ tipo: 'erro', texto: mensagemDeErro(e) }))
  }, [])

  async function agir(fn, ok) {
    setMsg(null)
    try {
      await fn()
      await carregar()
      if (ok) setMsg({ tipo: 'ok', texto: ok })
    } catch (e) {
      setMsg({ tipo: 'erro', texto: mensagemDeErro(e) })
    }
  }

  if (!dados) return null
  return (
    <div className="cartao">
      <h2>Aviso de denúncia nova por e-mail</h2>
      <p className="fraco">
        Cada denúncia que chega gera um e-mail curto para os endereços abaixo, com protocolo, assunto e prazo de
        triagem. O relato e a identificação nunca vão por e-mail. Endereço de membro afastado da denúncia não é
        avisado. {modoDemo
          ? 'Na demonstração nada é enviado: a trilha só registra o aviso como simulado.'
          : 'O envio é pelo Resend; a chave fica no Vault do Supabase (README, "Aviso por e-mail").'}
      </p>
      {msg && <div style={{ marginBottom: 12 }}><Aviso tipo={msg.tipo}>{msg.texto}</Aviso></div>}
      {dados.emails.length === 0 ? <div className="vazio">Ninguém recebe aviso. Denúncias novas só aparecem no painel.</div> : (
        <div className="tabela-rolagem" style={{ marginBottom: 14 }}>
          <table className="tabela">
            <thead><tr><th>E-mail</th><th>Situação</th><th /></tr></thead>
            <tbody>
              {dados.emails.map((a) => (
                <tr key={a.email}>
                  <td>{a.email}</td>
                  <td>
                    <button className="btn btn-fantasma btn-pequeno" onClick={() => agir(() => api.salvarAviso(a.email, !a.ativo))} title={a.ativo ? 'Pausar' : 'Reativar'}>
                      {a.ativo ? <Selo tom="ok" ponto>Recebe</Selo> : <Selo ponto>Pausado</Selo>}
                    </button>
                  </td>
                  <td className="num">
                    <button className="btn btn-fantasma btn-pequeno" onClick={() => window.confirm(`Parar de avisar ${a.email}?`) && agir(() => api.removerAviso(a.email))}>Remover</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <form className="botoes" onSubmit={(e) => { e.preventDefault(); agir(() => api.salvarAviso(novo), 'E-mail incluído.').then(() => setNovo('')) }}>
        <input type="email" placeholder="outro@empresa.com.br" value={novo} onChange={(e) => setNovo(e.target.value)} required style={{ flex: '1 1 240px' }} aria-label="E-mail a avisar" />
        <button className="btn btn-secundario">Incluir</button>
      </form>
      <form className="campo" style={{ marginTop: 18, marginBottom: 0 }} onSubmit={(e) => { e.preventDefault(); agir(() => api.salvarSiteUrl(site), 'Endereço salvo.') }}>
        <label htmlFor="site-url">Endereço do site <span className="opcional">(vai no botão “Abrir o painel” do e-mail)</span></label>
        <div className="botoes">
          <input id="site-url" type="text" placeholder="https://denuncia.suaempresa.com.br" value={site} onChange={(e) => setSite(e.target.value)} style={{ flex: '1 1 280px' }} />
          <button className="btn btn-secundario" disabled={site === dados.siteUrl}>Salvar</button>
          {!dados.siteUrl && <button type="button" className="btn btn-fantasma btn-pequeno" onClick={() => setSite(enderecoDoSite())}>Usar {enderecoDoSite().replace(/^https?:\/\//, '')}</button>}
        </div>
      </form>
    </div>
  )
}
