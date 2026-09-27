// Roda supabase/schema.sql num PostgreSQL de verdade, embutido (PGlite), com
// imitações mínimas do que o Supabase fornece — papéis anon/authenticated,
// auth.uid(), storage — e confere as garantias de sigilo e anonimato:
// quem vê o quê, senha com bloqueio, relato imutável, trilha, impedimento.
//
// Rode depois de QUALQUER mudança em supabase/schema.sql:  npm run testar
import { PGlite } from '@electric-sql/pglite'
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto'
import { readFileSync } from 'node:fs'

const schema = readFileSync(new URL('../supabase/schema.sql', import.meta.url), 'utf8')
const db = new PGlite({ extensions: { pgcrypto } })

let falhas = 0
const ok = (cond, msg) => { console.log(`${cond ? '  ✔' : '  ✗'} ${msg}`); if (!cond) falhas++ }

await db.exec(`
  create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
  grant usage on schema public to anon, authenticated;
  create schema auth; create schema storage; create schema extensions;
  grant usage on schema auth, storage, extensions to anon, authenticated;
  create table auth.users (id uuid primary key default gen_random_uuid(), email text unique);
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant execute on function auth.uid() to anon, authenticated;
  create table storage.buckets (id text primary key, name text, public boolean,
    file_size_limit bigint, allowed_mime_types text[]);
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
  alter table storage.objects enable row level security;
  grant select, insert on storage.objects to anon, authenticated;
  create function storage.foldername(name text) returns text[] language sql immutable as $$
    select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
  grant execute on function storage.foldername(text) to anon, authenticated;
  -- o Supabase dá tudo a anon/authenticated por padrão; imita isso
  alter default privileges in schema public grant all on tables to anon, authenticated;
  alter default privileges in schema public grant all on sequences to anon, authenticated;
  alter default privileges in schema public grant execute on functions to anon, authenticated;
  -- Vault e pg_net de mentira: o "envio" de e-mail só anota a chamada
  create schema vault;
  create table vault.decrypted_secrets (name text primary key, decrypted_secret text);
  create view vault.secrets as select name from vault.decrypted_secrets;
  create schema net;
  create table net.chamadas (id bigserial primary key, url text, headers jsonb, body jsonb);
  create function net.http_post(url text, body jsonb default '{}', params jsonb default '{}',
    headers jsonb default '{}', timeout_milliseconds int default 5000)
  returns bigint language sql as $$ insert into net.chamadas (url, headers, body) values ($1, $4, $2) returning id $$;
`)

// Como no Supabase: parte 1 e parte 2, cada uma num "Run". Depois o schema
// inteiro por cima, para provar que rodar de novo não quebra nada.
for (const n of [1, 2]) await db.exec(readFileSync(new URL(`../supabase/partes/parte-${n}-de-2.sql`, import.meta.url), 'utf8'))
await db.exec(schema)
ok(true, 'partes 1 e 2 rodam em sequência, e o schema inteiro roda de novo por cima')

const emp = {}
for (const [slug, nome, ativa] of [['empresa-a', 'Empresa A', true], ['empresa-b', 'Empresa B & Cia', true], ['inativa', 'Empresa Inativa', false]]) {
  emp[slug] = (await db.query(`insert into empresas (nome, slug, ativa) values ($1, $2, $3) returning id`, [nome, slug, ativa])).rows[0].id
}

const [admin, membro, citado] = ['admin@x.com', 'membro@x.com', 'citado@x.com']
const ids = {}
for (const e of [admin, membro, citado]) {
  ids[e] = (await db.query(`insert into auth.users (email) values ($1) returning id`, [e])).rows[0].id
}
await db.query(`insert into comissao_membros (user_id, nome, email, papel) values ($1, 'Admin', $2, 'admin')`, [ids[admin], admin])

async function como(papel, uid, fn) {
  await db.exec('begin')
  try {
    await db.query(`select set_config('request.jwt.claim.sub', $1, true)`, [uid || ''])
    await db.exec(`set local role ${papel}`)
    const r = await fn()
    await db.exec('commit')
    return r
  } catch (e) {
    await db.exec('rollback')
    throw e
  }
}
const tenta = async (fn) => { try { return { r: await fn() } } catch (e) { return { e: e.message } } }

// admin cadastra os outros pelo painel
await como('authenticated', ids[admin], () => db.query(`select canal_adicionar_membro($1, 'Membro', 'membro')`, [membro]))
await como('authenticated', ids[admin], () => db.query(`select canal_adicionar_membro($1, 'Citado', 'membro')`, [citado]))
ok((await db.query('select count(*)::int n from comissao_membros')).rows[0].n === 3, 'admin cadastra membros pela função')
let x = await tenta(() => como('authenticated', ids[membro], () => db.query(`select canal_adicionar_membro('a@b.c', 'X', 'admin')`)))
ok(!!x.e, 'membro comum não cadastra membro')

// ---------------------------------------------------------------- denunciante
const pub = await como('anon', null, () => db.query(`select * from canal_membros_publicos($1)`, [emp['empresa-a']]))
ok(pub.rows.length === 3, 'anon lista membros para marcar impedimento')

const reg = await como('anon', null, () => db.query(`select canal_registrar_denuncia($1::jsonb) r`, [JSON.stringify({ empresa: 'empresa-a', 
  categoria: 'assedio_moral', unidade: 'Matriz', descricao: 'O supervisor grita e humilha a equipe toda manhã na frente de todos.',
  acontecendo: 'sim', frequencia: 'frequente', impedidos: [ids[citado]], identificado: false, nome: 'Não deveria gravar',
})]))
const { protocolo, senha } = reg.rows[0].r
ok(/^[2-9A-Z]{8}$/.test(protocolo) && /^[2-9A-Z]{10}$/.test(senha), `protocolo ${protocolo} e senha no formato`)
const d = (await db.query(`select * from denuncias where protocolo = $1`, [protocolo])).rows[0]
ok(d.nome === null, 'anônima: nome enviado não é gravado')
ok(new Date(d.prazo_triagem) - new Date(d.criada_em) === 5 * 864e5, 'prazo de triagem 5 dias')

x = await tenta(() => como('anon', null, () => db.query(`select * from denuncias`)))
ok(!!x.e, 'anon não lê a tabela denuncias')
x = await tenta(() => como('anon', null, () => db.query(`select * from denuncia_credenciais`)))
ok(!!x.e, 'anon não lê credenciais')
x = await tenta(() => como('authenticated', ids[admin], () => db.query(`select * from denuncia_credenciais`)))
ok(!!x.e, 'nem o admin lê credenciais')
x = await tenta(() => como('anon', null, () => db.query(`select canal_registrar(null, 'forjado')`)))
ok(!!x.e, 'anon não chama função interna')
x = await tenta(() => como('authenticated', ids[membro], () => db.query(`select canal_registrar(null, 'forjado')`)))
ok(!!x.e, 'membro não forja linha de auditoria')
x = await tenta(() => como('authenticated', ids[membro], () => db.query(`select * from canal_autenticar($1, $2)`, [protocolo, senha])))
ok(!!x.e, 'canal_autenticar não é exposta')

// consulta
let c = await como('anon', null, () => db.query(`select canal_consultar($1, $2) r`, [protocolo.toLowerCase().replace(/(.{4})/, '$1-'), senha.slice(0, 5) + ' ' + senha.slice(5)]))
ok(c.rows[0].r.status === 'recebida', 'consulta aceita minúscula, hífen e espaço')
ok(!('gravidade' in c.rows[0].r) && !('notas' in c.rows[0].r), 'consulta não expõe dados internos')

// bloqueio por tentativas — o contador tem que sobreviver
for (let i = 0; i < 5; i++) await como('anon', null, () => db.query(`select canal_consultar($1, 'ERRADA') r`, [protocolo]))
c = await como('anon', null, () => db.query(`select canal_consultar($1, $2) r`, [protocolo, senha]))
ok(/Muitas tentativas/.test(c.rows[0].r.erro || ''), 'após 5 erros, até a senha certa fica travada')
await db.query(`update denuncia_credenciais set bloqueada_ate = now() - interval '1 second'`)
c = await como('anon', null, () => db.query(`select canal_consultar($1, $2) r`, [protocolo, senha]))
ok(c.rows[0].r.status === 'recebida', 'destrava depois do prazo')
c = await como('anon', null, () => db.query(`select canal_consultar('ZZZZZZZZ', 'X') r`))
ok(c.rows[0].r.erro === 'Protocolo ou senha incorretos.', 'protocolo inexistente dá o mesmo erro de senha errada')

// complemento
c = await como('anon', null, () => db.query(`select canal_complementar($1, $2, 'Aconteceu de novo hoje.') r`, [protocolo, senha]))
ok(c.rows[0].r.ok === true, 'denunciante envia complemento')

// anexo: storage
await db.exec(`insert into storage.objects (bucket_id, name) values ('x', 'y')`) // linha qualquer
x = await tenta(() => como('anon', null, () => db.query(`insert into storage.objects (bucket_id, name) values ('denuncia-anexos', $1)`, [`${protocolo}/abc-123.jpg`])))
ok(!x.e, 'anon sobe arquivo na pasta do protocolo')
x = await tenta(() => como('anon', null, () => db.query(`insert into storage.objects (bucket_id, name) values ('denuncia-anexos', 'QUALQUER/abc.jpg')`)))
ok(!!x.e, 'anon não sobe arquivo em pasta de protocolo inexistente')
x = await tenta(() => como('anon', null, () => db.query(`select * from storage.objects where bucket_id = 'denuncia-anexos'`)))
ok(!x.e && x.r.rows.length === 0, 'anon não lista anexos')
c = await como('anon', null, () => db.query(`select canal_registrar_anexo($1, $2, $3, 'image/jpeg', 1000) r`, [protocolo, senha, `${protocolo}/abc-123.jpg`]))
ok(c.rows[0].r.nome === 'anexo-1.jpg', 'anexo registrado com nome neutro')
c = await como('anon', null, () => db.query(`select canal_registrar_anexo($1, $2, 'OUTRO/abc.jpg', 'image/jpeg', 1000) r`, [protocolo, senha]))
ok(!!c.rows[0].r.erro, 'anexo fora da pasta é recusado')

// ------------------------------------------------------------------- comissão
let lista = await como('authenticated', ids[admin], () => db.query(`select id from denuncias`))
ok(lista.rows.length === 1, 'admin vê a denúncia')
lista = await como('authenticated', ids[membro], () => db.query(`select id from denuncias`))
ok(lista.rows.length === 1, 'membro vê a denúncia')
lista = await como('authenticated', ids[citado], () => db.query(`select id from denuncias`))
ok(lista.rows.length === 0, 'membro citado pelo denunciante NÃO vê')
lista = await como('authenticated', ids[citado], () => db.query(`select * from denuncia_impedimentos`))
ok(lista.rows.length === 0, 'citado não vê nem o próprio impedimento')
lista = await como('authenticated', ids[citado], () => db.query(`select * from denuncia_historico`))
ok(lista.rows.length === 0, 'citado não vê a trilha da denúncia')
lista = await como('authenticated', ids[citado], () => db.query(`select * from denuncia_mensagens`))
ok(lista.rows.length === 0, 'citado não vê mensagens')
lista = await como('authenticated', ids[citado], () => db.query(`select * from storage.objects where bucket_id = 'denuncia-anexos'`))
ok(lista.rows.length === 0, 'citado não baixa anexos')
lista = await como('authenticated', ids[membro], () => db.query(`select * from storage.objects where bucket_id = 'denuncia-anexos'`))
ok(lista.rows.length === 1, 'membro com acesso baixa anexo')

x = await tenta(() => como('authenticated', ids[membro], () => db.query(`update denuncias set descricao = 'mudei o relato todo aqui dentro' where id = $1`, [d.id])))
ok(/não pode ser alterado/.test(x.e || ''), 'relato original é imutável')
x = await tenta(() => como('authenticated', ids[membro], () => db.query(`delete from denuncias where id = $1`, [d.id])))
ok(!!x.e, 'comissão não apaga denúncia')
x = await tenta(() => como('authenticated', ids[membro], () => db.query(`update denuncias set status = 'concluida' where id = $1`, [d.id])))
ok(/conclusao_completa/.test(x.e || ''), 'não conclui sem resultado e resposta')

await como('authenticated', ids[membro], () => db.query(`select canal_abrir($1)`, [d.id]))
ok((await db.query(`select count(*)::int n from denuncia_mensagens where not lida`)).rows[0].n === 0, 'abrir marca mensagens como lidas')
await como('authenticated', ids[membro], () => db.query(`update denuncias set status = 'em_analise', gravidade = 'alta' where id = $1`, [d.id]))
let dd = (await db.query(`select * from denuncias where id = $1`, [d.id])).rows[0]
ok(dd.triada_em !== null, 'triagem registra data')
await como('authenticated', ids[membro], () => db.query(`insert into denuncia_mensagens (denuncia_id, autor, autor_id, texto) values ($1, 'comissao', $2, 'Recebemos. Pode dizer o turno?')`, [d.id, ids[membro]]))
x = await tenta(() => como('authenticated', ids[membro], () => db.query(`insert into denuncia_mensagens (denuncia_id, autor, texto) values ($1, 'denunciante', 'forjada')`, [d.id])))
ok(!!x.e, 'comissão não escreve em nome do denunciante')
await como('authenticated', ids[membro], () => db.query(`insert into denuncia_notas (denuncia_id, texto) values ($1, 'Ouvir o encarregado.')`, [d.id]))
await como('authenticated', ids[membro], () => db.query(`insert into denuncia_medidas (denuncia_id, tipo, descricao) values ($1, 'administrativa', 'Treinamento de liderança')`, [d.id]))
await como('authenticated', ids[membro], () => db.query(`update denuncias set status = 'aguardando_info' where id = $1`, [d.id]))
await como('anon', null, () => db.query(`select canal_complementar($1, $2, 'Turno da manhã.')`, [protocolo, senha]))
dd = (await db.query(`select status from denuncias where id = $1`, [d.id])).rows[0]
ok(dd.status === 'em_apuracao', 'resposta do denunciante retoma a apuração')

await como('authenticated', ids[membro], () => db.query(`update denuncias set status = 'concluida', resultado = 'procedente', resposta_final = 'Apurado e confirmado; medidas adotadas.' where id = $1`, [d.id]))
c = await como('anon', null, () => db.query(`select canal_consultar($1, $2) r`, [protocolo, senha]))
ok(c.rows[0].r.resultado === 'procedente' && c.rows[0].r.mensagens.length === 3, 'denunciante vê conclusão e conversa')

const trilha = (await db.query(`select acao from denuncia_historico where denuncia_id = $1 order by id`, [d.id])).rows.map((r) => r.acao)
ok(['recebida', 'visualizou', 'alterou', 'mensagem_comissao', 'nota_interna', 'medida_criada'].every((a) => trilha.includes(a)), `trilha completa (${trilha.join(', ')})`)
x = await tenta(() => como('authenticated', ids[admin], () => db.query(`delete from denuncia_historico`)))
ok(!!x.e || (await db.query('select count(*)::int n from denuncia_historico')).rows[0].n > 0, 'trilha não se apaga')

// declarar impedimento
await como('authenticated', ids[membro], () => db.query(`select canal_declarar_impedimento($1, 'parente')`, [d.id]))
lista = await como('authenticated', ids[membro], () => db.query(`select id from denuncias`))
ok(lista.rows.length === 0, 'quem se declara impedido perde o acesso na hora')

// todos impedidos
x = await tenta(() => como('anon', null, () => db.query(`select canal_registrar_denuncia($1::jsonb)`, [JSON.stringify({ empresa: 'empresa-a', 
  categoria: 'risco_grave', descricao: 'Máquina operando sem proteção na correia agora.', impedidos: [ids[admin], ids[membro], ids[citado]],
})])))
ok(/pelo menos um membro/.test(x.e || ''), 'não deixa excluir a comissão inteira')

// urgente = 24h
const r2 = await como('anon', null, () => db.query(`select canal_registrar_denuncia($1::jsonb) r`, [JSON.stringify({ empresa: 'empresa-a', 
  categoria: 'risco_grave', descricao: 'Máquina operando sem proteção na correia agora.', identificado: true, nome: 'Fulano', contato: '11 9999',
})]))
const d2 = (await db.query(`select * from denuncias where protocolo = $1`, [r2.rows[0].r.protocolo])).rows[0]
ok(new Date(d2.prazo_triagem) - new Date(d2.criada_em) === 864e5 && d2.nome === 'Fulano', 'risco grave: triagem 24h; identificada guarda nome')

x = await tenta(() => como('anon', null, () => db.query(`select canal_registrar_denuncia($1::jsonb)`, [JSON.stringify({ empresa: 'empresa-a',  categoria: 'inventada', descricao: 'x'.repeat(30) })])))
ok(!!x.e, 'categoria inexistente é recusada')

// expurgo
await db.query(`update denuncias set concluida_em = now() - interval '6 years' where id = $1`, [d.id])
const exp = await como('authenticated', ids[admin], () => db.query(`select canal_expurgar(5) n`))
dd = (await db.query(`select * from denuncias where id = $1`, [d.id])).rows[0]
ok(exp.rows[0].n === 1 && dd.descricao.startsWith('[relato removido') && dd.categoria === 'assedio_moral', 'expurgo apaga relato e mantém estatística')

// ------------------------------------------------------------ aviso por e-mail
const trilhaDe = async (id) => (await db.query(`select acao, detalhe from denuncia_historico where denuncia_id = $1`, [id])).rows
ok((await trilhaDe(d2.id)).some((h) => h.acao === 'aviso_email_falhou'), 'sem chave no Vault a denúncia entra e a trilha anota a falha do aviso')

await db.query(`insert into vault.decrypted_secrets values ('canal_resend_api_key', 're_teste')`)
const chamadas = async () => (await db.query(`select * from net.chamadas order by id`)).rows
const antes = (await chamadas()).length
const r3 = await como('anon', null, () => db.query(`select canal_registrar_denuncia($1::jsonb) r`, [JSON.stringify({ empresa: 'empresa-a', 
  categoria: 'assedio_sexual', descricao: 'SEGREDO-DO-RELATO: o supervisor manda mensagens de cunho sexual.',
  identificado: true, nome: 'Fulana Identificada', contato: 'fulana@x.com', envolvidos: 'Supervisor Beltrano',
})]))
let envio = (await chamadas()).at(-1)
const p3 = r3.rows[0].r.protocolo
ok((await chamadas()).length === antes + 1 && envio.url === 'https://api.resend.com/emails', 'denúncia nova dispara o e-mail pelo Resend')
ok(envio.headers.Authorization === 'Bearer re_teste', 'a chave vem do Vault')
ok(JSON.stringify(envio.body.to) === '["tiago.godoy@yahoo.com.br"]', 'vai para tiago.godoy@yahoo.com.br')
const corpo = JSON.stringify(envio.body)
ok(!/SEGREDO|Fulana|fulana@x|Beltrano/.test(corpo), 'o e-mail NÃO leva relato, identificação nem envolvidos')
ok(envio.body.text.includes(`${p3.slice(0, 4)}-${p3.slice(4)}`) && envio.body.text.includes('Assédio sexual'), 'o e-mail leva protocolo e assunto')
ok(!/Assédio/.test(envio.body.subject) && !/Assédio/.test(envio.body.text.split('\n')[0]), 'o tema não aparece no título nem na primeira linha (tela de bloqueio)')
ok(/NÃO chega ao denunciante/.test(envio.body.text), 'o e-mail avisa que responder por e-mail não chega ao denunciante')
const d3 = (await db.query(`select id from denuncias where protocolo = $1`, [p3])).rows[0]
ok((await trilhaDe(d3.id)).some((h) => h.acao === 'aviso_email'), 'a trilha registra o aviso')

await como('anon', null, () => db.query(`select canal_registrar_denuncia($1::jsonb)`, [JSON.stringify({ empresa: 'empresa-a',  categoria: 'risco_grave', descricao: 'Correia sem proteção operando agora.' })]))
envio = (await chamadas()).at(-1)
ok(envio.body.subject.startsWith('[URGENTE]'), 'risco grave sai com [URGENTE] no título')

// o dono do e-mail de aviso vira membro e é citado: não pode receber o aviso
const tiago = (await db.query(`insert into auth.users (email) values ('tiago.godoy@yahoo.com.br') returning id`)).rows[0].id
await como('authenticated', ids[admin], () => db.query(`select canal_adicionar_membro('tiago.godoy@yahoo.com.br', 'Tiago', 'membro')`))
const qtd = (await chamadas()).length
await como('anon', null, () => db.query(`select canal_registrar_denuncia($1::jsonb)`, [JSON.stringify({ empresa: 'empresa-a', 
  categoria: 'assedio_moral', descricao: 'O Tiago da comissão humilha a equipe.', impedidos: [tiago],
})]))
ok((await chamadas()).length === qtd, 'membro afastado pelo denunciante não recebe o aviso daquela denúncia')

x = await tenta(() => como('anon', null, () => db.query(`select * from canal_avisos`)))
ok(!!x.e, 'anon não lê a lista de avisos')
x = await tenta(() => como('anon', null, () => db.query(`select canal_avisar_nova($1)`, [d3.id])))
ok(!!x.e, 'ninguém dispara aviso pela API')
lista = await como('authenticated', ids[membro], () => db.query(`select * from canal_avisos`))
ok(lista.rows.length === 0, 'membro comum não vê quem é avisado')
await como('authenticated', ids[admin], () => db.query(`insert into canal_avisos (email) values ('outra@empresa.com.br')`))
ok((await db.query(`select 1 from denuncia_historico where acao = 'aviso_insert'`)).rows.length === 1, 'admin muda a lista de avisos e fica na trilha')
x = await tenta(() => como('authenticated', ids[admin], () => db.query(`insert into canal_avisos (email) values ('MAIUSCULO@x.com')`)))
ok(!!x.e, 'e-mail de aviso é gravado em minúsculas')

// ------------------------------------------------------------ várias empresas
let ep = await como('anon', null, () => db.query(`select canal_empresa_publica('Empresa-A') r`))
ok(ep.rows[0].r?.nome === 'Empresa A', 'o link público acha a empresa')
ep = await como('anon', null, () => db.query(`select canal_empresa_publica('inativa') r`))
ok(ep.rows[0].r === null, 'empresa desativada não aparece pelo link')
x = await tenta(() => como('anon', null, () => db.query(`select canal_registrar_denuncia($1::jsonb)`, [JSON.stringify({ empresa: 'empresa-a', empresa: 'inativa', categoria: 'outro', descricao: 'x'.repeat(30) })])))
ok(/Link de empresa/.test(x.e || ''), 'empresa desativada não recebe denúncia')
x = await tenta(() => como('anon', null, () => db.query(`select canal_registrar_denuncia($1::jsonb)`, [JSON.stringify({ empresa: 'empresa-a', empresa: '', categoria: 'outro', descricao: 'x'.repeat(30) })])))
ok(/Link de empresa/.test(x.e || ''), 'denúncia sem empresa é recusada')

const membroB = 'membro-b@x.com'
ids[membroB] = (await db.query(`insert into auth.users (email) values ($1) returning id`, [membroB])).rows[0].id
await como('authenticated', ids[admin], () => db.query(`select canal_adicionar_membro($1, 'Membro da B', 'membro', $2)`, [membroB, emp['empresa-b']]))
x = await tenta(() => como('authenticated', ids[admin], () => db.query(`select canal_adicionar_membro($1, 'Membro da B', 'admin', $2)`, [membroB, emp['empresa-b']])))
ok(/administração do canal/.test(x.e || ''), 'administrador não pode ficar preso a uma empresa')

lista = await como('authenticated', ids[membroB], () => db.query(`select id from denuncias`))
ok(lista.rows.length === 0, 'membro da Empresa B não vê denúncias da Empresa A')
await db.query(`insert into canal_avisos (email) values ($1)`, [membroB])
const qtdA = (await chamadas()).length
await como('anon', null, () => db.query(`select canal_registrar_denuncia($1::jsonb)`, [JSON.stringify({ empresa: 'empresa-a', categoria: 'outro', descricao: 'Mais uma denúncia da Empresa A aqui.' })]))
envio = (await chamadas()).at(-1)
ok((await chamadas()).length === qtdA + 1 && !envio.body.to.includes(membroB), 'membro da Empresa B não recebe aviso de denúncia da Empresa A')
const rB = await como('anon', null, () => db.query(`select canal_registrar_denuncia($1::jsonb) r`, [JSON.stringify({ empresa: 'empresa-a', empresa: 'empresa-b', categoria: 'sobrecarga', descricao: 'Jornada de 12 horas na Empresa B.' })]))
envio = (await chamadas()).at(-1)
ok(envio.body.to.includes(membroB) && envio.body.to.includes('tiago.godoy@yahoo.com.br'), 'denúncia da Empresa B avisa o Tiago e o membro da B')
ok(envio.body.subject.includes('Empresa B & Cia') && envio.body.text.includes('Empresa: Empresa B & Cia'), 'o e-mail diz de qual empresa é, no título e no corpo')
ok(envio.body.html.includes('Empresa B &amp; Cia'), 'nome da empresa vai escapado no HTML do e-mail')
lista = await como('authenticated', ids[membroB], () => db.query(`select id, empresa_id from denuncias`))
ok(lista.rows.length === 1 && lista.rows[0].empresa_id === emp['empresa-b'], 'membro da Empresa B vê só a denúncia da B')
lista = await como('authenticated', ids[membroB], () => db.query(`select nome from empresas`))
ok(lista.rows.length === 1 && lista.rows[0].nome === 'Empresa B & Cia', 'membro da Empresa B só enxerga a própria empresa')
lista = await como('authenticated', ids[admin], () => db.query(`select distinct empresa_id from denuncias`))
ok(lista.rows.length === 2, 'administrador vê as denúncias de todas as empresas')
c = await como('anon', null, () => db.query(`select canal_consultar($1, $2) r`, [rB.rows[0].r.protocolo, rB.rows[0].r.senha]))
ok(c.rows[0].r.empresa === 'Empresa B & Cia' && c.rows[0].r.empresa_slug === 'empresa-b', 'acompanhamento mostra a empresa')
let pubA = await como('anon', null, () => db.query(`select nome from canal_membros_publicos($1)`, [emp['empresa-a']]))
let pubB = await como('anon', null, () => db.query(`select nome from canal_membros_publicos($1)`, [emp['empresa-b']]))
ok(!pubA.rows.some((r) => r.nome === 'Membro da B') && pubB.rows.some((r) => r.nome === 'Membro da B'),
  'no formulário de cada empresa só aparecem os membros que a enxergam')

x = await tenta(() => como('authenticated', ids[admin], () => db.query(`insert into empresas (nome, slug, unidades) values ('Nova', 'nova-empresa', '{Matriz,Filial}')`)))
ok(!x.e, 'administrador cria empresa')
ok((await db.query(`select 1 from denuncia_historico where acao = 'empresa_insert'`)).rows.length >= 1, 'criação de empresa fica na trilha')
x = await tenta(() => como('authenticated', ids[membro], () => db.query(`insert into empresas (nome, slug) values ('Pirata', 'pirata')`)))
ok(!!x.e, 'membro comum não cria empresa')
x = await tenta(() => como('authenticated', ids[admin], () => db.query(`insert into empresas (nome, slug) values ('Ruim', 'Com Espaço')`)))
ok(!!x.e, 'link da empresa só aceita letras minúsculas, números e hífen')
x = await tenta(() => como('authenticated', ids[admin], () => db.query(`delete from empresas where slug = 'nova-empresa'`)))
ok(!!x.e || (await db.query(`select 1 from empresas where slug = 'nova-empresa'`)).rows.length === 1, 'empresa não se apaga (só desativa)')

// rate limit
const ja = (await db.query(`select count(*)::int n from denuncias where criada_em > now() - interval '10 minutes'`)).rows[0].n
for (let i = 0; i < 30 - ja; i++) await db.query(`select canal_registrar_denuncia($1::jsonb)`, [JSON.stringify({ empresa: 'empresa-a',  categoria: 'outro', descricao: 'teste de volume de envios ' + i })])
x = await tenta(() => como('anon', null, () => db.query(`select canal_registrar_denuncia($1::jsonb)`, [JSON.stringify({ empresa: 'empresa-a',  categoria: 'outro', descricao: 'mais um envio de teste aqui' })])))
ok(/muitos envios/.test(x.e || ''), 'freio de 30 envios por 10 minutos')

// a consulta de conferência roda e enxerga o que foi instalado aqui
const conferencia = (await db.query(readFileSync(new URL('../supabase/conferir-instalacao.sql', import.meta.url), 'utf8'))).rows
const falta = conferencia.filter((r) => r.situacao !== '✔').map((r) => r.item)
// neste banco de teste não há pg_net de verdade nem site publicado
ok(conferencia.length === 11 && JSON.stringify(falta) === JSON.stringify(['Extensão pg_net (envio do e-mail)', 'Endereço do site (botão do e-mail)']),
  `conferir-instalacao.sql funciona (faltando aqui, como esperado: ${falta.join(', ')})`)

console.log(falhas ? `\n${falhas} FALHA(S)` : '\nTudo certo.')
process.exit(falhas ? 1 : 0)
