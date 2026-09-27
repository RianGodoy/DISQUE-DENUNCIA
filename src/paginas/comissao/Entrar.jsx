import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { empresa, senhaDemo } from '../../config'
import { Aviso, Pagina } from '../../componentes/Estrutura'
import { api, modoDemo } from '../../lib/api'
import { mensagemDeErro } from '../../lib/formato'
import { useTitulo } from '../../lib/ganchos'

export default function Entrar() {
  useTitulo('Área da comissão')
  const navegar = useNavigate()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [membros, setMembros] = useState([])
  const [empresasDemo, setEmpresasDemo] = useState([])
  const [membroDemo, setMembroDemo] = useState('')
  const [erro, setErro] = useState('')
  const [entrando, setEntrando] = useState(false)
  const [semAcesso, setSemAcesso] = useState(false)

  useEffect(() => {
    api.sessao().then((s) => {
      if (s?.membro) navegar('/comissao/painel', { replace: true })
      else if (s) setSemAcesso(true)
    }).catch(() => {})
    if (modoDemo) {
      api.empresasDemonstracao().then(setEmpresasDemo)
      api.listarMembros().then((l) => {
        const ativos = l.filter((m) => m.ativo)
        setMembros(ativos)
        setMembroDemo(ativos[0]?.user_id || '')
      })
    }
  }, [navegar])

  async function enviar(e) {
    e.preventDefault()
    setErro('')
    setEntrando(true)
    try {
      await api.entrar(modoDemo ? membroDemo : email, senha)
      const s = await api.sessao()
      if (!s?.membro) {
        setSemAcesso(true)
        return
      }
      navegar('/comissao/painel', { replace: true })
    } catch (e2) {
      setErro(mensagemDeErro(e2))
    } finally {
      setEntrando(false)
    }
  }

  return (
    <Pagina comissao>
      <div style={{ maxWidth: 460, margin: '24px auto 0' }}>
        <h1>Área da comissão</h1>
        <p className="suave">Acesso restrito aos membros da {empresa.comissao}. Todo acesso fica registrado.</p>
        {semAcesso ? (
          <div className="cartao">
            <Aviso tipo="alerta" titulo="Sem acesso.">
              Sua conta existe, mas não está ativa na comissão. Peça ao administrador do canal para cadastrá-la.
            </Aviso>
            <button className="btn btn-secundario" style={{ marginTop: 14 }} onClick={async () => { await api.sair(); setSemAcesso(false) }}>
              Entrar com outra conta
            </button>
          </div>
        ) : (
          <form className="cartao" onSubmit={enviar}>
            {modoDemo ? (
              <>
                <Aviso titulo="Demonstração:">
                  escolha qual membro você quer ser. Denúncias em que ele foi marcado como envolvido não aparecem para ele.
                  A senha é <strong className="mono">{senhaDemo}</strong>.
                </Aviso>
                <div className="campo" style={{ marginTop: 14 }}>
                  <label htmlFor="membro">Entrar como</label>
                  <select id="membro" value={membroDemo} onChange={(e) => setMembroDemo(e.target.value)}>
                    {membros.map((m) => <option key={m.user_id} value={m.user_id}>{m.nome}{m.papel === 'admin' ? ' (administrador)' : ''}{m.empresa_id ? ` — só ${empresasDemo.find((e) => e.id === m.empresa_id)?.nome || 'uma empresa'}` : ''}</option>)}
                  </select>
                </div>
              </>
            ) : (
              <div className="campo">
                <label htmlFor="email">E-mail</label>
                <input id="email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
            )}
            <div className="campo">
              <label htmlFor="senha">Senha</label>
              <input id="senha" type="password" autoComplete="current-password" value={senha} onChange={(e) => setSenha(e.target.value)} required />
            </div>
            {erro && <div style={{ marginBottom: 14 }}><Aviso tipo="erro">{erro}</Aviso></div>}
            <button className="btn btn-primario btn-bloco" disabled={entrando}>{entrando ? 'Entrando…' : 'Entrar'}</button>
            {!modoDemo && <p className="dica" style={{ marginTop: 12 }}>Esqueceu a senha? Peça ao administrador do canal para redefini-la no Supabase.</p>}
          </form>
        )}
      </div>
    </Pagina>
  )
}
