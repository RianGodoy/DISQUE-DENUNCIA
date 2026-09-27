import { useRef, useState } from 'react'
import { anexos as limites } from '../config'
import { prepararAnexo, tamanhoLegivel } from '../lib/anexos'

/**
 * Escolha de anexos com limpeza de metadados feita no aparelho.
 * `itens` é a lista de anexos já preparados: {id, blob, tipo, tamanho, previa, aviso}.
 */
export default function SeletorAnexos({ itens, aoMudar, maximo = limites.maximo }) {
  const entrada = useRef(null)
  const [processando, setProcessando] = useState(false)
  const [erro, setErro] = useState('')
  const [arrastando, setArrastando] = useState(false)

  async function adicionar(lista) {
    setErro('')
    const arquivos = Array.from(lista || [])
    if (!arquivos.length) return
    if (itens.length + arquivos.length > maximo) {
      setErro(`No máximo ${maximo} arquivos por envio.`)
      return
    }
    setProcessando(true)
    const novos = []
    for (const a of arquivos) {
      try {
        novos.push({ id: crypto.randomUUID(), ...(await prepararAnexo(a)) })
      } catch (e) {
        setErro(e.message)
      }
    }
    setProcessando(false)
    aoMudar([...itens, ...novos])
    if (entrada.current) entrada.current.value = ''
  }

  function remover(id) {
    const item = itens.find((i) => i.id === id)
    if (item?.previa) URL.revokeObjectURL(item.previa)
    aoMudar(itens.filter((i) => i.id !== id))
  }

  return (
    <div>
      <div
        className={`soltar ${arrastando ? 'arrastando' : ''}`}
        onClick={() => entrada.current?.click()}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && entrada.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setArrastando(true) }}
        onDragLeave={() => setArrastando(false)}
        onDrop={(e) => { e.preventDefault(); setArrastando(false); adicionar(e.dataTransfer.files) }}
        role="button"
        tabIndex={0}
      >
        {processando ? 'Preparando arquivos…' : <>📎 Toque para escolher fotos ou PDF <span className="fraco">(até {maximo}, {limites.tamanhoMaxMB} MB cada)</span></>}
      </div>
      <input
        ref={entrada}
        type="file"
        multiple
        accept="image/*,application/pdf"
        className="oculto-visual"
        onChange={(e) => adicionar(e.target.files)}
        tabIndex={-1}
        aria-hidden="true"
      />
      <p className="dica" style={{ marginTop: 6 }}>
        Fotos são limpas antes de sair do seu aparelho: removemos localização GPS, modelo do celular, data e o nome
        original do arquivo.
      </p>
      {erro && <p className="dica" style={{ color: 'var(--erro)' }} role="alert">{erro}</p>}
      {itens.length > 0 && (
        <div className="anexos-lista">
          {itens.map((i, n) => (
            <div className="anexo" key={i.id}>
              <div className="miniatura">
                {i.previa ? <img src={i.previa} alt={`Anexo ${n + 1}`} /> : <span>PDF</span>}
              </div>
              <div className="rodape-anexo">
                <span>anexo-{n + 1} · {tamanhoLegivel(i.tamanho)}</span>
                <button type="button" className="btn btn-fantasma btn-pequeno" onClick={() => remover(i.id)} aria-label={`Remover anexo ${n + 1}`}>✕</button>
              </div>
            </div>
          ))}
        </div>
      )}
      {itens.some((i) => i.aviso) && (
        <p className="dica" style={{ marginTop: 8, color: 'var(--alerta)' }}>{itens.find((i) => i.aviso).aviso}</p>
      )}
    </div>
  )
}
