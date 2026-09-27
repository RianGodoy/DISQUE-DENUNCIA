/* Barras horizontais de uma série só (uma cor, sem legenda — o título do
   cartão diz o que é). O valor fica escrito ao lado de cada barra, então a
   barra é o próprio "modo tabela"; o `title` repete número e percentual.

   `modo`: 'numero' escreve a contagem; 'percentual' escreve o % do total. */
export function Barras({ dados, total, modo = 'numero' }) {
  const max = Math.max(1, ...dados.map((d) => d.valor))
  const pcts = percentuais(dados.map((d) => d.valor), total)
  return (
    <div className="barras" role="list">
      {dados.map((d, i) => (
        <div className="barra-linha" key={d.chave} role="listitem" title={`${d.rotulo}: ${d.valor} (${pcts[i]}%)`}>
          <span className="barra-rotulo">{d.rotulo}</span>
          <span className="barra-trilho">
            <span className="barra-valor" style={{ width: `${(d.valor / max) * 100}%`, display: 'block' }} />
          </span>
          <span className="barra-numero">{modo === 'percentual' ? `${pcts[i]}%` : d.valor}</span>
        </div>
      ))}
    </div>
  )
}

/** Conta ocorrências por chave e devolve [{chave, rotulo, valor}], do maior
    para o menor — ou na `ordem` dada, quando a ordem tem significado. */
export function contar(lista, chaveDe, rotuloDe, ordem) {
  const m = new Map()
  for (const item of lista) {
    const k = chaveDe(item)
    if (k === undefined) continue
    m.set(k, (m.get(k) || 0) + 1)
  }
  const r = [...m.entries()].map(([k, v]) => ({ chave: k, rotulo: rotuloDe(k), valor: v }))
  return ordem ? r.sort((a, b) => ordem.indexOf(a.chave) - ordem.indexOf(b.chave)) : r.sort((a, b) => b.valor - a.valor)
}

/** Percentuais inteiros de cada valor sobre o total.

    Quando os valores são as fatias de um mesmo todo, o arredondamento é feito
    em conjunto (maior resto) para fechar 100% — arredondar cada um sozinho dava
    73% + 28% = 101% com 29 e 11 de 40.

    Mas valores iguais mostram sempre o mesmo percentual: o ponto que falta vai
    para um grupo inteiro de empatados, ou para nenhum. Três assuntos com 2
    relatos cada não podem aparecer como 19%, 18% e 18%; nesse caso o total
    fica em 99% em vez de desempatar o que é igual. */
export function percentuais(valores, total) {
  if (!total) return valores.map(() => 0)
  const brutos = valores.map((v) => (v / total) * 100)
  if (valores.reduce((a, b) => a + b, 0) !== total) return brutos.map(Math.round)
  const res = brutos.map(Math.floor)
  let falta = 100 - res.reduce((a, b) => a + b, 0)
  const empatados = [...new Set(valores)]
    .map((v) => ({ resto: ((v / total) * 100) % 1, indices: valores.flatMap((x, i) => (x === v ? [i] : [])) }))
    .sort((a, b) => b.resto - a.resto)
  for (const g of empatados) {
    if (g.resto > 0 && g.indices.length <= falta) {
      g.indices.forEach((i) => { res[i] += 1 })
      falta -= g.indices.length
    }
  }
  return res
}
