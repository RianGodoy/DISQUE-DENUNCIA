// Divide supabase/schema.sql em partes de até 50 mil caracteres, para colar no
// SQL Editor do Supabase vindo pelo WhatsApp (que corta mensagens maiores).
//
// O corte é sempre entre seções, e o schema não usa nada que dependa da mesma
// conexão (tabela temporária, begin/commit): cada parte roda num "Run" próprio.
// A ordem importa — a parte 2 usa as tabelas e funções da parte 1.
//
// Não edite os arquivos de supabase/partes/: edite o schema.sql e rode
//   npm run dividir-sql
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'

const LIMITE = 50000
const origem = new URL('../supabase/schema.sql', import.meta.url)
const schema = readFileSync(origem, 'utf8')

// primeira linha "-- ----" antes do cabeçalho das funções públicas
const marco = schema.indexOf('-- Funções PÚBLICAS')
const corte = schema.lastIndexOf('-- ------', marco)
if (marco < 0 || corte < 0) throw new Error('Não achei a seção "Funções PÚBLICAS" no schema.sql para cortar.')

const cabecalho = (n, oQue) => `-- =============================================================================
--  Canal de Denúncias — banco de dados, PARTE ${n} DE 2 (${oQue})
--
--  Rode a PARTE 1 e depois a PARTE 2, cada uma inteira, no SQL Editor do
--  Supabase. Podem ser rodadas de novo sem perder dados.
--
--  Arquivo gerado a partir de supabase/schema.sql (npm run dividir-sql).
--  Não edite aqui: edite o schema.sql e gere de novo.
-- =============================================================================

`
const partes = [
  cabecalho(1, 'tabelas, regras de acesso e gatilhos') + schema.slice(0, corte),
  cabecalho(2, 'funções, aviso por e-mail, permissões e anexos') + schema.slice(corte),
]

mkdirSync(new URL('../supabase/partes/', import.meta.url), { recursive: true })
partes.forEach((texto, i) => {
  if (texto.length > LIMITE) throw new Error(`Parte ${i + 1} ficou com ${texto.length} caracteres (limite ${LIMITE}). Mude o ponto de corte.`)
  writeFileSync(new URL(`../supabase/partes/parte-${i + 1}-de-2.sql`, import.meta.url), texto)
  console.log(`  supabase/partes/parte-${i + 1}-de-2.sql — ${texto.length.toLocaleString('pt-BR')} caracteres`)
})
