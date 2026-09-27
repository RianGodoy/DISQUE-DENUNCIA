/* Protocolo e senha de acompanhamento.

   Com banco, quem gera os dois é o PostgreSQL (função canal_codigo). Aqui
   fica o mesmo gerador para o modo demonstração, e a formatação que vale
   para os dois modos.

   Alfabeto sem 0/O, 1/I/L: a pessoa anota num papel e depois digita — não
   pode haver dúvida entre letra e número. */

export const ALFABETO = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'

/** "d7k3-m9 xp" → "D7K3M9XP" */
export const normalizar = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '')

/** Protocolo com 8 caracteres, mostrado como XXXX-XXXX. */
export const formatarProtocolo = (p) => normalizar(p).replace(/^(.{4})(.+)$/, '$1-$2')

/** Senha com 10 caracteres, mostrada como XXXXX-XXXXX. */
export const formatarSenha = (s) => normalizar(s).replace(/^(.{5})(.+)$/, '$1-$2')

/** Código aleatório sem viés de módulo (248 = 8 × 31). */
export function gerarCodigo(tamanho) {
  let saida = ''
  while (saida.length < tamanho) {
    const bytes = crypto.getRandomValues(new Uint8Array(tamanho * 2))
    for (const b of bytes) {
      if (b < 248 && saida.length < tamanho) saida += ALFABETO[b % 31]
    }
  }
  return saida
}

/** SHA-256 em hexadecimal — só para o modo demonstração. */
export async function resumo(texto) {
  const dados = new TextEncoder().encode(texto)
  const hash = await crypto.subtle.digest('SHA-256', dados)
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, '0')).join('')
}
