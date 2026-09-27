import { createContext, useContext } from 'react'

/* A empresa do link (site/#/e/<slug>). Quem fornece é paginas/DaEmpresa.jsx,
   em volta de todas as telas públicas daquela empresa. Fora de um link de
   empresa (portal, /acompanhar), vale null. */
export const EmpresaContexto = createContext(null)
export const useEmpresa = () => useContext(EmpresaContexto)

/** Prefixo das rotas públicas: "/e/<slug>" dentro de um link de empresa, "" fora. */
export const useBase = () => {
  const empresa = useEmpresa()
  return empresa ? `/e/${empresa.slug}` : ''
}

/** Endereço completo que se divulga para a empresa (vai no cartaz e no QR code). */
export const linkDaEmpresa = (slug) => `${window.location.origin}${window.location.pathname}#/e/${slug}`

/** "Construtora São João & Filhos" → "construtora-sao-joao-filhos" */
export const paraSlug = (nome) =>
  String(nome || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/, '')

export const SLUG_VALIDO = /^[a-z0-9]+(-[a-z0-9]+)*$/
