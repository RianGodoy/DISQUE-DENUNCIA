import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Pagina } from '../componentes/Estrutura'
import Emergencia from '../componentes/Emergencia'
import { api, modoDemo } from '../lib/api'
import { useTitulo } from '../lib/ganchos'

/* Endereço raiz, sem empresa. Cada empresa divulga o próprio link
   (site/#/e/<empresa>); aqui só se explica isso e se oferece o
   acompanhamento, que funciona para qualquer empresa pelo protocolo.
   A lista de empresas atendidas NÃO aparece: ela é informação do canal, não
   do público. Só na demonstração as empresas fictícias ficam à mão. */
export default function Portal() {
  useTitulo(null)
  const [demo, setDemo] = useState([])
  useEffect(() => {
    if (modoDemo) api.empresasDemonstracao().then(setDemo)
  }, [])

  return (
    <Pagina>
      <section className="heroi">
        <h1>Canal de Denúncias</h1>
        <p className="lead">
          Para fazer uma denúncia, use o <strong>link ou o QR code divulgado pela sua empresa</strong> — no cartaz do
          mural, no treinamento ou na integração. Assim ela chega à comissão certa.
        </p>
        <div className="botoes">
          <Link to="/acompanhar" className="btn btn-primario btn-grande">Já tenho protocolo</Link>
          <Link to="/como-funciona" className="btn btn-secundario btn-grande">Como funciona</Link>
        </div>
      </section>

      {demo.length > 0 && (
        <div className="cartao" style={{ marginTop: 24 }}>
          <h2>Empresas da demonstração</h2>
          <p className="fraco">Com o banco configurado, esta lista não aparece: cada empresa só conhece o próprio link.</p>
          <div className="botoes">
            {demo.map((e) => <Link key={e.slug} to={`/e/${e.slug}`} className="btn btn-secundario">{e.nome}</Link>)}
          </div>
        </div>
      )}

      <Emergencia />
    </Pagina>
  )
}
