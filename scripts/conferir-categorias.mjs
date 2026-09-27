// Confere que src/config.js e supabase/schema.sql dizem a mesma coisa.
//
// As categorias e os prazos existem nos dois lugares: o site mostra o texto e
// o banco valida e calcula o prazo. Se alguém criar uma categoria só no site,
// o banco recusa toda denúncia dela; se mudar um prazo só no site, a tela
// promete um prazo e o painel cobra outro. Este script acusa a diferença.
import { readFileSync } from 'node:fs'
import { categorias, prazos } from '../src/config.js'

const sql = readFileSync(new URL('../supabase/schema.sql', import.meta.url), 'utf8')
let falhas = 0
const ok = (cond, msg) => { console.log(`${cond ? '  ✔' : '  ✗'} ${msg}`); if (!cond) falhas++ }

// categorias aceitas pelo banco
const restricao = sql.match(/constraint denuncias_categoria_valida check \(categoria in \(([\s\S]*?)\)\)/)
const noBanco = new Set([...(restricao?.[1] || '').matchAll(/'([a-z_]+)'/g)].map((m) => m[1]))
const noSite = new Set(categorias.map((c) => c.id))
const soSite = [...noSite].filter((c) => !noBanco.has(c))
const soBanco = [...noBanco].filter((c) => !noSite.has(c))
ok(soSite.length === 0, `toda categoria do site existe no banco${soSite.length ? ` — faltam: ${soSite.join(', ')}` : ''}`)
ok(soBanco.length === 0, `o banco não aceita categoria que o site não mostra${soBanco.length ? ` — sobram: ${soBanco.join(', ')}` : ''}`)

// categorias urgentes e prazos (função canal_prazos)
const fn = sql.match(/create or replace function public\.canal_prazos[\s\S]*?\$\$([\s\S]*?)\$\$/)?.[1] || ''
const urgentesBanco = new Set([...(fn.match(/p_categoria in \(([^)]*)\)/)?.[1] || '').matchAll(/'([a-z_]+)'/g)].map((m) => m[1]))
const urgentesSite = new Set(categorias.filter((c) => c.urgente).map((c) => c.id))
ok(
  urgentesBanco.size === urgentesSite.size && [...urgentesSite].every((c) => urgentesBanco.has(c)),
  `mesmas categorias urgentes (site: ${[...urgentesSite].join(', ')} · banco: ${[...urgentesBanco].join(', ')})`,
)
const dias = [...fn.matchAll(/interval '(\d+) days?'/g)].map((m) => Number(m[1]))
// ordem no SQL: triagem urgente, triagem normal, conclusão urgente, conclusão normal
const esperado = [prazos.triagemUrgente, prazos.triagem, prazos.conclusaoUrgente, prazos.conclusao]
ok(JSON.stringify(dias) === JSON.stringify(esperado), `mesmos prazos em dias (site: ${esperado.join('/')} · banco: ${dias.join('/')})`)

// títulos que vão no e-mail de aviso (função canal_categoria_titulo)
const fnTitulo = sql.match(/create or replace function public\.canal_categoria_titulo[\s\S]*?\$\$([\s\S]*?)\$\$/)?.[1] || ''
const titulosBanco = Object.fromEntries([...fnTitulo.matchAll(/when '([a-z_]+)'\s+then '([^']+)'/g)].map((m) => [m[1], m[2]]))
const titulosDiferentes = categorias.filter((c) => titulosBanco[c.id] !== c.titulo).map((c) => `${c.id} ("${c.titulo}" × "${titulosBanco[c.id] ?? 'ausente'}")`)
ok(titulosDiferentes.length === 0, `mesmos títulos no e-mail de aviso${titulosDiferentes.length ? ` — diferem: ${titulosDiferentes.join(', ')}` : ''}`)

console.log(falhas ? `\n${falhas} diferença(s) entre src/config.js e supabase/schema.sql` : '\nconfig.js e schema.sql conferem.')
process.exit(falhas ? 1 : 0)
