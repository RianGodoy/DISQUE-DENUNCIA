import { Link } from 'react-router-dom'
import { Pagina } from '../componentes/Estrutura'

export default function NaoEncontrada() {
  return (
    <Pagina>
      <h1>Página não encontrada</h1>
      <p>O endereço pode ter sido digitado com algum caractere a mais ou a menos.</p>
      <div className="botoes">
        <Link to="/" className="btn btn-primario">Ir para o início</Link>
        <Link to="/acompanhar" className="btn btn-secundario">Acompanhar denúncia</Link>
      </div>
    </Pagina>
  )
}
