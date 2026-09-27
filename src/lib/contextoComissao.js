import { createContext, useContext } from 'react'

/* Sessão da comissão compartilhada entre as telas do painel: quem está
   logado, se é admin, a lista de membros e `nomeDe(id)`. Quem fornece é
   paginas/comissao/Painel.jsx. */
export const ContextoComissao = createContext(null)
export const useComissao = () => useContext(ContextoComissao)
