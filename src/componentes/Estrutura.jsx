import { NavLink, Link } from 'react-router-dom'
import { empresa } from '../config'
import { modoDemo } from '../lib/api'
import { sairRapido } from '../lib/sairRapido'
import { useBase, useEmpresa } from '../lib/contextoEmpresa'

export function FaixaDemo() {
  if (!modoDemo) return null
  return (
    <div className="faixa-demo" role="status">
      <strong>Modo demonstração.</strong> O banco de dados ainda não foi configurado: as denúncias ficam só neste
      navegador e ninguém as recebe. Não use para denúncias reais.
    </div>
  )
}

export function Topo({ comissao = false }) {
  const daEmpresa = useEmpresa()
  const base = useBase()
  return (
    <>
      <FaixaDemo />
      <header className="topo">
        <div className={`topo-conteudo ${comissao ? 'pagina-larga' : 'pagina'}`}>
          <Link to={comissao ? '/comissao/painel' : base || '/'} className="topo-marca">
            <img src="/escudo.svg" alt="" />
            <span>
              <strong>Canal de Denúncias</strong>
              <small>{comissao ? `Painel da ${empresa.comissao}` : daEmpresa?.nome || empresa.nomeCurto}</small>
            </span>
          </Link>
          {!comissao && (
            <>
              <nav className="topo-nav" aria-label="Principal">
                <NavLink to={base || '/'} end>Início</NavLink>
                {daEmpresa && <NavLink to={`${base}/denunciar`}>Fazer denúncia</NavLink>}
                <NavLink to={`${base}/acompanhar`}>Acompanhar</NavLink>
                <NavLink to={`${base}/como-funciona`}>Como funciona</NavLink>
              </nav>
              <button type="button" className="btn-sair-rapido" onClick={sairRapido}
                title="Sai do canal na hora, sem deixar a página no botão voltar (atalho: Esc duas vezes)">
                ✕ Sair rápido
              </button>
            </>
          )}
        </div>
      </header>
    </>
  )
}

export function Rodape({ larga = false }) {
  const daEmpresa = useEmpresa()
  const base = useBase()
  return (
    <footer className="rodape nao-imprimir">
      <div className={larga ? 'pagina-larga' : 'pagina'}>
        <span>{daEmpresa?.nome || empresa.nome} · Canal de Denúncias</span>
        <span>
          <Link to={`${base}/como-funciona`}>Política do canal e privacidade</Link>
          {' · '}
          <Link to="/comissao">Área da comissão</Link>
        </span>
      </div>
    </footer>
  )
}

export function Pagina({ children, larga = false, comissao = false }) {
  return (
    <div className="app">
      <Topo comissao={comissao} />
      <main>
        <div className={larga ? 'pagina-larga' : 'pagina'}>{children}</div>
      </main>
      <Rodape larga={larga} />
    </div>
  )
}

export function Selo({ tom = 'neutro', children, ponto = false }) {
  return (
    <span className={`selo selo-${tom}`}>
      {ponto && <span className="ponto" aria-hidden="true" />}
      {children}
    </span>
  )
}

export function Aviso({ tipo = 'info', titulo, children }) {
  return (
    <div className={`aviso ${tipo === 'info' ? '' : `aviso-${tipo}`}`} role={tipo === 'erro' ? 'alert' : undefined}>
      {titulo && <strong>{titulo} </strong>}
      {children}
    </div>
  )
}

/** Rádio em forma de cartão. */
export function Opcao({ nome, valor, marcado, aoMudar, titulo, detalhe, tipo = 'radio', className = '' }) {
  return (
    <label className={`opcao ${tipo === 'checkbox' ? 'quadrada' : ''} ${marcado ? 'marcada' : ''} ${className}`}>
      <input type={tipo} name={nome} value={valor} checked={marcado} onChange={aoMudar} />
      <span className="marcador" aria-hidden="true" />
      <span className="opcao-texto">
        <strong>{titulo}</strong>
        {detalhe && <small>{detalhe}</small>}
      </span>
    </label>
  )
}

export function Carregando({ texto = 'Carregando…' }) {
  return <p className="fraco" role="status">{texto}</p>
}
