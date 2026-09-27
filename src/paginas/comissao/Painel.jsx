import { useCallback, useEffect, useState } from 'react'
import { Navigate, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { inatividadeMin } from '../../config'
import { Carregando, Pagina } from '../../componentes/Estrutura'
import { api, modoDemo } from '../../lib/api'
import { mensagemDeErro } from '../../lib/formato'
import { useInatividade } from '../../lib/ganchos'
import { ContextoComissao } from '../../lib/contextoComissao'
import { enderecoDoSite, foraDoEnderecoOficial } from '../../lib/contextoEmpresa'
import Lista from './Lista'
import Detalhe from './Detalhe'
import Indicadores from './Indicadores'
import Membros from './Membros'
import Auditoria from './Auditoria'
import Empresas from './Empresas'

/* Tudo o que a comissão vê depende de: sessão válida + membro ativo. As
   políticas do banco garantem isso de qualquer jeito; este guarda só evita
   mostrar uma tela vazia a quem não deveria estar aqui. */


export default function Painel() {
  const navegar = useNavigate()
  const { pathname } = useLocation()
  const [sessao, setSessao] = useState(undefined)
  const [membros, setMembros] = useState([])
  const [empresas, setEmpresas] = useState([])

  useEffect(() => {
    api.sessao().then(setSessao, () => setSessao(null))
    return api.aoMudarSessao(setSessao)
  }, [])

  useEffect(() => {
    if (!sessao?.membro) return
    api.listarMembros().then(setMembros).catch(() => {})
    api.listarEmpresas().then(setEmpresas).catch(() => {})
  }, [sessao])

  const sair = useCallback(async () => {
    await api.sair()
    navegar('/comissao', { replace: true })
  }, [navegar])
  useInatividade(inatividadeMin.comissao, sair, Boolean(sessao?.membro))

  const nomeDe = useCallback(
    (id) => (id ? membros.find((m) => m.user_id === id)?.nome || 'Membro removido' : null),
    [membros],
  )
  const nomeEmpresa = useCallback((id) => empresas.find((e) => e.id === id)?.nome || null, [empresas])

  if (sessao === undefined) return <Pagina comissao larga><Carregando /></Pagina>
  if (!sessao?.membro) return <Navigate to="/comissao" replace />

  const admin = sessao.membro.papel === 'admin'
  const valor = {
    sessao, membro: sessao.membro, admin, membros, nomeDe, empresas, nomeEmpresa,
    recarregarMembros: () => api.listarMembros().then(setMembros),
    recarregarEmpresas: () => api.listarEmpresas().then(setEmpresas),
  }

  return (
    <ContextoComissao.Provider value={valor}>
      <Pagina comissao larga>
        {foraDoEnderecoOficial() && (
          <div className="aviso aviso-alerta nao-imprimir" style={{ marginBottom: 16 }}>
            <strong>Endereço de teste da Vercel.</strong> Este painel foi aberto por {window.location.host}, que pede
            login na Vercel para quem não é da conta. Os links e cartazes das empresas saem sempre com o endereço
            oficial, mas prefira usar <a href={`${enderecoDoSite()}/#/comissao`}>{enderecoDoSite().replace(/^https?:\/\//, '')}</a>.
          </div>
        )}
        <div className="painel-cabeca nao-imprimir">
          <div>
            <p className="fraco" style={{ margin: 0 }}>Conectado como</p>
            <strong>{sessao.membro.nome}</strong>
            {admin && <span className="fraco"> · administrador</span>}
            {sessao.membro.empresa_id && <span className="fraco"> · {nomeEmpresa(sessao.membro.empresa_id) || 'uma empresa'}</span>}
          </div>
          <button className="btn btn-secundario btn-pequeno" onClick={sair}>Sair</button>
        </div>
        <nav className="abas nao-imprimir" aria-label="Seções do painel">
          <NavLink to="/comissao/painel" className={({ isActive }) => (isActive || pathname.startsWith('/comissao/denuncia/') ? 'ativo' : '')}>Denúncias</NavLink>
          <NavLink to="/comissao/indicadores" className={({ isActive }) => (isActive ? 'ativo' : '')}>Indicadores</NavLink>
          {admin && <NavLink to="/comissao/membros" className={({ isActive }) => (isActive ? 'ativo' : '')}>Membros</NavLink>}
          {admin && <NavLink to="/comissao/auditoria" className={({ isActive }) => (isActive ? 'ativo' : '')}>Auditoria</NavLink>}
          <NavLink to="/comissao/empresas" className={({ isActive }) => (isActive ? 'ativo' : '')}>Empresas</NavLink>
        </nav>
        <Routes>
          <Route path="painel" element={<Lista />} />
          <Route path="denuncia/:id" element={<Detalhe />} />
          <Route path="indicadores" element={<Indicadores />} />
          <Route path="empresas" element={<Empresas />} />
          <Route path="membros" element={admin ? <Membros /> : <Navigate to="/comissao/painel" replace />} />
          <Route path="auditoria" element={admin ? <Auditoria /> : <Navigate to="/comissao/painel" replace />} />
          <Route path="*" element={<Navigate to="/comissao/painel" replace />} />
        </Routes>
        {modoDemo && <DemoFerramentas admin={admin} />}
      </Pagina>
    </ContextoComissao.Provider>
  )
}

function DemoFerramentas({ admin }) {
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState('')
  if (!admin) return null
  return (
    <div className="cartao nao-imprimir" style={{ marginTop: 32, borderStyle: 'dashed' }}>
      <h3>Ferramentas da demonstração</h3>
      <p className="fraco">Só existem no modo demonstração, para ver o painel com volume.</p>
      <div className="botoes">
        <button className="btn btn-secundario btn-pequeno" disabled={ocupado} onClick={async () => {
          setOcupado(true)
          try { await api.gerarExemplos(); window.location.reload() } catch (e) { setErro(mensagemDeErro(e)); setOcupado(false) }
        }}>Gerar 40 denúncias de exemplo</button>
        <button className="btn btn-perigo btn-pequeno" onClick={() => {
          if (window.confirm('Apagar todas as denúncias e membros da demonstração?')) {
            api.limparDemo()
            api.sair().then(() => window.location.replace('#/comissao'))
          }
        }}>Apagar dados da demonstração</button>
      </div>
      {erro && <p className="dica" style={{ color: 'var(--erro)' }}>{erro}</p>}
    </div>
  )
}
