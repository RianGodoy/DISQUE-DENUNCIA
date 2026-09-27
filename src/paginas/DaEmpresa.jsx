import { useEffect, useState } from 'react'
import { Link, Outlet, useParams } from 'react-router-dom'
import { Carregando, Pagina } from '../componentes/Estrutura'
import { api } from '../lib/api'
import { EmpresaContexto } from '../lib/contextoEmpresa'

/* Porta de todas as telas públicas de uma empresa (site/#/e/<slug>/...).
   Carrega a empresa do link uma vez e a entrega às telas de dentro. Link
   inexistente ou de empresa desativada não abre formulário nenhum. */
export default function DaEmpresa() {
  const { slug } = useParams()
  const [estado, setEstado] = useState({ carregando: true })

  useEffect(() => {
    setEstado({ carregando: true })
    api.empresaPublica(slug).then(
      (empresa) => setEstado({ empresa }),
      () => setEstado({ falhou: true }),
    )
  }, [slug])

  if (estado.carregando) return <Pagina><Carregando /></Pagina>
  if (!estado.empresa) {
    return (
      <Pagina>
        <h1>{estado.falhou ? 'Não foi possível abrir o canal agora' : 'Link não encontrado'}</h1>
        <p>
          {estado.falhou
            ? 'Verifique a conexão com a internet e tente de novo em alguns minutos.'
            : 'Este link não corresponde a nenhuma empresa ativa. Confira o endereço no cartaz ou peça o link correto à sua empresa.'}
        </p>
        <div className="botoes">
          <Link to="/acompanhar" className="btn btn-secundario">Já tenho protocolo</Link>
        </div>
      </Pagina>
    )
  }
  return (
    <EmpresaContexto.Provider value={estado.empresa}>
      <Outlet />
    </EmpresaContexto.Provider>
  )
}
