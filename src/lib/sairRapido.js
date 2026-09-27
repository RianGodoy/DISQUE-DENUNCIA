/* "Sair rápido": troca a página por um site neutro SEM deixar o canal no
   histórico de voltar (replace). Para quem está sendo observado enquanto
   denuncia. Também dispara com Esc apertado duas vezes seguidas. */
export function sairRapido() {
  window.location.replace('https://www.google.com.br/search?q=previs%C3%A3o+do+tempo')
}

let ultimoEsc = 0
if (typeof window !== 'undefined') {
  window.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return
    const t = Date.now()
    if (t - ultimoEsc < 600 && !location.hash.startsWith('#/comissao')) sairRapido()
    ultimoEsc = t
  })
}
