import { createClient } from '@supabase/supabase-js'

/* Clientes do Supabase.

   Sem as variáveis configuradas o canal roda em MODO DEMONSTRAÇÃO (tudo no
   navegador, ver banco-local.js). `temBanco` é a chave que decide.

   São DOIS clientes, e isso é parte do anonimato:

   - `publico` é o que o denunciante usa. Não guarda sessão nenhuma, então
     nunca manda o token de ninguém. Se um membro da comissão estiver logado
     neste mesmo navegador e fizer uma denúncia, ela chega ao banco como
     anônima do mesmo jeito — não há como ligá-la à conta dele.

   - `comissao` é o do painel. A sessão fica no sessionStorage: fechou a aba,
     saiu. Num computador compartilhado, ninguém abre o painel no dia
     seguinte com a sessão de outra pessoa. */

/* A chave pública pode vir no formato novo do Supabase ("sb_publishable_…",
   em VITE_SUPABASE_PUBLISHABLE_KEY) ou no antigo ("anon", um JWT, em
   VITE_SUPABASE_ANON_KEY). As duas fazem o mesmo papel. */
const url = import.meta.env.VITE_SUPABASE_URL || ''
const chave = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || ''

export const temBanco = Boolean(url && chave)

export const publico = temBanco
  ? createClient(url, chave, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: 'canal-publico' },
    })
  : null

export const comissao = temBanco
  ? createClient(url, chave, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        storageKey: 'canal-comissao',
        storage: typeof window !== 'undefined' ? window.sessionStorage : undefined,
      },
    })
  : null
