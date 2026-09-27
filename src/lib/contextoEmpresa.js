import { createContext, useContext } from 'react'
import { siteOficial } from '../config'
import { temBanco } from './supabase'

// no modo demonstração os links ficam no endereço local: as empresas de
// exemplo não existem no site oficial
const oficial = temBanco ? siteOficial : ''

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

/** Endereço de onde saem os links: o oficial (config.js), nunca um endereço
    de teste da Vercel que por acaso esteja aberto no navegador. */
export const enderecoDoSite = () =>
  (oficial || `${window.location.origin}${window.location.pathname}`).replace(/\/+$/, '')

/** Link que se divulga para a empresa (vai no cartaz e no QR code). */
export const linkDaEmpresa = (slug) => `${enderecoDoSite()}/#/e/${slug}`

/** O navegador está num endereço diferente do oficial (e não é teste local)? */
export const foraDoEnderecoOficial = () =>
  Boolean(oficial) && !/^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(window.location.origin) &&
  new URL(oficial).origin !== window.location.origin

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
