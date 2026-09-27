import { anexos as limites } from '../config'

/* Preparação dos anexos ANTES de sair do aparelho.

   Foto de celular carrega, escondido no arquivo, o modelo do aparelho, a data
   e hora exatas e muitas vezes as coordenadas GPS de onde foi tirada. Para um
   canal anônimo isso é uma assinatura. Então toda imagem é redesenhada num
   canvas e exportada de novo como JPEG: o que sai é só a imagem, sem nenhum
   metadado. De quebra, fica menor (lado maior limitado a 2400 px).

   O nome do arquivo também identifica ("WhatsApp Image 2026-09-12 at
   07.04.51.jpeg", "IMG_joao.jpg"): ele nunca é enviado. O arquivo vira
   "anexo-N".

   PDF não tem como ser limpo no navegador sem uma biblioteca pesada. Ele
   passa como está, e a tela avisa que as propriedades do PDF podem trazer o
   nome de quem o criou. */

const LADO_MAX = 2400

export const ehImagem = (arquivo) =>
  /^image\//.test(arquivo.type) || /\.(jpe?g|png|webp|heic|heif)$/i.test(arquivo.name)
export const ehPdf = (arquivo) => arquivo.type === 'application/pdf' || /\.pdf$/i.test(arquivo.name)

async function reencodarImagem(arquivo) {
  let bitmap
  try {
    // 'from-image' aplica a rotação do EXIF antes de o EXIF ser descartado —
    // senão a foto em pé chegaria deitada
    bitmap = await createImageBitmap(arquivo, { imageOrientation: 'from-image' })
  } catch {
    throw new Error(
      /heic|heif/i.test(arquivo.type + arquivo.name)
        ? 'Este navegador não abre fotos HEIC do iPhone. Tire um print da foto e anexe o print.'
        : 'Não foi possível abrir esta imagem.',
    )
  }
  const escala = Math.min(1, LADO_MAX / Math.max(bitmap.width, bitmap.height))
  const largura = Math.round(bitmap.width * escala)
  const altura = Math.round(bitmap.height * escala)
  const canvas = document.createElement('canvas')
  canvas.width = largura
  canvas.height = altura
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#fff' // PNG transparente não vira fundo preto no JPEG
  ctx.fillRect(0, 0, largura, altura)
  ctx.drawImage(bitmap, 0, 0, largura, altura)
  bitmap.close?.()
  const blob = await new Promise((ok) => canvas.toBlob(ok, 'image/jpeg', 0.85))
  if (!blob) throw new Error('Não foi possível processar esta imagem.')
  return blob
}

/**
 * Transforma o arquivo escolhido no que de fato vai ser enviado.
 * @returns {Promise<{blob: Blob, tipo: string, tamanho: number, previa: string|null, aviso: string|null}>}
 */
export async function prepararAnexo(arquivo) {
  const maxBytes = limites.tamanhoMaxMB * 1024 * 1024
  if (ehImagem(arquivo)) {
    const blob = await reencodarImagem(arquivo)
    if (blob.size > maxBytes) throw new Error(`Imagem maior que ${limites.tamanhoMaxMB} MB mesmo depois de reduzida.`)
    return { blob, tipo: 'image/jpeg', tamanho: blob.size, previa: URL.createObjectURL(blob), aviso: null }
  }
  if (ehPdf(arquivo)) {
    if (arquivo.size > maxBytes) throw new Error(`PDF maior que ${limites.tamanhoMaxMB} MB.`)
    return {
      blob: arquivo,
      tipo: 'application/pdf',
      tamanho: arquivo.size,
      previa: null,
      aviso: 'PDFs podem guardar o nome de quem os criou. Se isso te preocupa, anexe um print em vez do arquivo.',
    }
  }
  throw new Error('Envie fotos (JPG, PNG, WEBP) ou PDF.')
}

export const tamanhoLegivel = (bytes) =>
  bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`
