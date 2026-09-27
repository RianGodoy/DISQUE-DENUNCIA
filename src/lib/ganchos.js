import { useEffect, useRef, useState } from 'react'

/** Chama `aoExpirar` depois de `minutos` sem toque, clique ou tecla. */
export function useInatividade(minutos, aoExpirar, ativo = true) {
  const callback = useRef(aoExpirar)
  callback.current = aoExpirar
  useEffect(() => {
    if (!ativo) return undefined
    let timer
    const reiniciar = () => {
      clearTimeout(timer)
      timer = setTimeout(() => callback.current(), minutos * 60e3)
    }
    const eventos = ['pointerdown', 'keydown', 'scroll', 'touchstart']
    eventos.forEach((e) => window.addEventListener(e, reiniciar, { passive: true }))
    reiniciar()
    return () => {
      clearTimeout(timer)
      eventos.forEach((e) => window.removeEventListener(e, reiniciar))
    }
  }, [minutos, ativo])
}

/** Pergunta antes de fechar a aba com o formulário preenchido. */
export function useAvisoAoSair(ativo) {
  useEffect(() => {
    if (!ativo) return undefined
    const f = (e) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', f)
    return () => window.removeEventListener('beforeunload', f)
  }, [ativo])
}

/** Copia para a área de transferência e devolve um "copiado!" por 2 s. */
export function useCopiar() {
  const [copiado, setCopiado] = useState(null)
  const copiar = async (texto, chave = texto) => {
    try {
      await navigator.clipboard.writeText(texto)
    } catch {
      const t = document.createElement('textarea')
      t.value = texto
      document.body.appendChild(t)
      t.select()
      document.execCommand('copy')
      t.remove()
    }
    setCopiado(chave)
    setTimeout(() => setCopiado((c) => (c === chave ? null : c)), 2000)
  }
  return [copiado, copiar]
}

export function useTitulo(titulo) {
  useEffect(() => {
    document.title = titulo ? `${titulo} · Canal de Denúncias` : 'Canal de Denúncias'
  }, [titulo])
}
