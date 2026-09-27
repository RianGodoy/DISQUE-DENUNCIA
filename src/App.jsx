import { Component, Suspense, lazy, useEffect } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import Portal from './paginas/Portal'
import DaEmpresa from './paginas/DaEmpresa'
import Inicio from './paginas/Inicio'
import Denunciar from './paginas/Denunciar'
import Acompanhar from './paginas/Acompanhar'
import ComoFunciona from './paginas/ComoFunciona'
import NaoEncontrada from './paginas/NaoEncontrada'

/* O painel da comissão e o cartaz (com o gerador de QR code) só baixam
   quando alguém abre essas telas — quem vai denunciar pelo 4G do celular
   carrega só o formulário. */
const Cartaz = lazy(() => import('./paginas/Cartaz'))
const Entrar = lazy(() => import('./paginas/comissao/Entrar'))
const Painel = lazy(() => import('./paginas/comissao/Painel'))

class LimiteDeErro extends Component {
  state = { erro: null }
  static getDerivedStateFromError(erro) {
    return { erro }
  }
  render() {
    if (!this.state.erro) return this.props.children
    return (
      <div className="pagina" style={{ padding: '48px 16px' }}>
        <h1>Algo deu errado nesta tela</h1>
        <p>Recarregue a página. Se você estava preenchendo uma denúncia, ela ainda não foi enviada.</p>
        <button className="btn btn-primario" onClick={() => window.location.reload()}>Recarregar</button>
      </div>
    )
  }
}

function AoTopo() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}

export default function App() {
  return (
    <LimiteDeErro>
      <AoTopo />
      <Suspense fallback={<p className="fraco" style={{ padding: 24 }}>Carregando…</p>}>
        <Routes>
          <Route path="/" element={<Portal />} />
          <Route path="/acompanhar" element={<Acompanhar />} />
          <Route path="/como-funciona" element={<ComoFunciona />} />

          {/* cada empresa tem o seu link: site/#/e/<slug> */}
          <Route path="/e/:slug" element={<DaEmpresa />}>
            <Route index element={<Inicio />} />
            <Route path="denunciar" element={<Denunciar />} />
            <Route path="acompanhar" element={<Acompanhar />} />
            <Route path="como-funciona" element={<ComoFunciona />} />
          </Route>
          <Route path="/cartaz/:slug" element={<Cartaz />} />

          {/* endereços de antes das várias empresas */}
          <Route path="/denunciar" element={<Navigate to="/" replace />} />
          <Route path="/cartaz" element={<Navigate to="/comissao/empresas" replace />} />

          <Route path="/comissao" element={<Entrar />} />
          <Route path="/comissao/*" element={<Painel />} />

          <Route path="/inicio" element={<Navigate to="/" replace />} />
          <Route path="*" element={<NaoEncontrada />} />
        </Routes>
      </Suspense>
    </LimiteDeErro>
  )
}
