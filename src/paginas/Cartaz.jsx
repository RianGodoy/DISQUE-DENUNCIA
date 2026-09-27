import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import QRCode from 'qrcode'
import { empresa, prazos } from '../config'
import { Carregando, Pagina } from '../componentes/Estrutura'
import { api } from '../lib/api'
import { linkDaEmpresa } from '../lib/contextoEmpresa'
import { useTitulo } from '../lib/ganchos'

/* Cartaz para imprimir e colar nos quadros de aviso, refeitório, portaria.
   A Lei 14.457/2022 pede ampla divulgação das regras e do canal — um canal
   que ninguém conhece não cumpre a lei. O QR code é gerado aqui mesmo, sem
   serviço externo. */
export default function Cartaz() {
  useTitulo('Cartaz de divulgação')
  const { slug } = useParams()
  const [daEmpresa, setEmpresa] = useState(undefined)
  const endereco = linkDaEmpresa(slug)
  const [svg, setSvg] = useState('')

  useEffect(() => {
    api.empresaPublica(slug).then(setEmpresa, () => setEmpresa(null))
    QRCode.toString(endereco, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#10202e', light: '#ffffff' } })
      .then(setSvg)
  }, [slug, endereco])

  if (daEmpresa === undefined) return <Pagina><Carregando /></Pagina>
  if (!daEmpresa) {
    return (
      <Pagina>
        <h1>Empresa não encontrada ou desativada</h1>
        <p>Não dá para gerar cartaz de um link que não recebe denúncias.</p>
        <Link to="/comissao/empresas" className="btn btn-secundario">Voltar às empresas</Link>
      </Pagina>
    )
  }

  return (
    <Pagina>
      <div className="botoes nao-imprimir" style={{ marginBottom: 16, justifyContent: 'space-between' }}>
        <p className="suave" style={{ margin: 0 }}>Imprima em A4 (ou salve em PDF) e cole nos pontos de maior circulação.</p>
        <button className="btn btn-primario" onClick={() => window.print()}>Imprimir cartaz</button>
      </div>
      <div className="cartaz">
        <div className="cartaz-topo">
          <p>{daEmpresa.nome}</p>
          <h1>Canal de Denúncias</h1>
          <p>Viu ou sofreu algo errado no trabalho? Conte com segurança.</p>
        </div>
        <div className="cartaz-corpo">
          <div>
            <p style={{ fontWeight: 700, fontSize: '1.1rem' }}>Você pode relatar:</p>
            <ul>
              <li>assédio moral ou sexual</li>
              <li>violência, ameaça ou discriminação</li>
              <li>sobrecarga, jornada e pressão excessivas</li>
              <li>riscos, falta de EPI, condições inseguras</li>
              <li>acidentes e quase acidentes escondidos</li>
            </ul>
            <p style={{ margin: 0 }}>Resposta em até <strong>{prazos.conclusao} dias</strong>, acompanhada pelo seu protocolo.</p>
          </div>
          <div className="cartaz-qr">
            <div dangerouslySetInnerHTML={{ __html: svg }} aria-label="QR code do canal" role="img" />
            <div className="cartaz-endereco">{endereco.replace(/^https?:\/\//, '')}</div>
          </div>
        </div>
        <div className="cartaz-selos">
          <span>Anônimo</span><span>Sigiloso</span><span>Sem retaliação</span>
        </div>
        <div className="cartaz-rodape">
          Recebido e apurado pela {empresa.comissao}. Use o celular pessoal, fora do Wi-Fi da empresa, para mais privacidade.
        </div>
      </div>
    </Pagina>
  )
}
