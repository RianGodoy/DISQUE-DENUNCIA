import { temBanco } from './supabase'
import * as local from './banco-local'
import * as remoto from './banco-supabase'

/* A única porta das telas para os dados. Com Supabase configurado, fala com
   o banco; sem ele, com o localStorage (modo demonstração). As duas
   implementações têm exatamente as mesmas funções. */
export const api = temBanco ? remoto : local
export const modoDemo = !temBanco

/* Entrega do protocolo e da senha da tela de confirmação para a de
   acompanhamento, sem passar pela URL nem pelo histórico do navegador —
   que ficariam gravados no aparelho. Vive só na memória desta aba. */
let acessoEmMaos = null
export const entregarAcesso = (acesso) => { acessoEmMaos = acesso }
export const receberAcesso = () => {
  const a = acessoEmMaos
  acessoEmMaos = null
  return a
}
