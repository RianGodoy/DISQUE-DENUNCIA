-- =============================================================================
--  Canal de Denúncias — banco de dados, PARTE 1 DE 2 (tabelas, regras de acesso e gatilhos)
--
--  Rode a PARTE 1 e depois a PARTE 2, cada uma inteira, no SQL Editor do
--  Supabase. Podem ser rodadas de novo sem perder dados.
--
--  Arquivo gerado a partir de supabase/schema.sql (npm run dividir-sql).
--  Não edite aqui: edite o schema.sql e gere de novo.
-- =============================================================================

-- =============================================================================
--  Canal de Denúncias — estrutura do banco (Supabase / PostgreSQL)
--
--  Rode este arquivo INTEIRO no SQL Editor de um projeto Supabase NOVO, só
--  dele. Não reaproveite o banco de outro sistema: quem tem acesso de
--  administrador ao banco lê tudo, e denúncia de assédio não pode ficar ao
--  alcance de quem administra o sistema de produção, estoque etc.
--
--  É idempotente: pode rodar de novo sem perder dados.
--
--  Depois dele, cadastre o primeiro administrador — ver o README, seção
--  "Banco de dados", ou o fim deste arquivo.
--
--  COMO O ANONIMATO E O SIGILO FUNCIONAM AQUI
--  ------------------------------------------------------------------
--  1. QUEM DENUNCIA não tem conta. O site fala com o banco só pelas funções
--     `canal_*` marcadas `security definer`, com a chave pública. Nenhuma
--     tabela aceita leitura ou escrita direta dessa chave.
--
--  2. NADA QUE IDENTIFIQUE O APARELHO É GRAVADO: nem IP, nem navegador, nem
--     usuário logado. As funções públicas não leem `auth.uid()` e o site
--     chama o banco com um cliente sem sessão. (A infraestrutura do Supabase
--     e da Vercel guarda IP nos logs de acesso por alguns dias — isso é
--     dito ao trabalhador na política do canal.)
--
--  3. O ACOMPANHAMENTO é por protocolo + senha. A senha nasce aqui, é
--     devolvida uma única vez e só o hash (bcrypt) fica guardado, numa
--     tabela à parte que nenhuma chave lê. Nem a comissão consegue ver ou
--     recuperar a senha.
--
--  4. A COMISSÃO entra com e-mail e senha (Supabase Auth) E precisa estar
--     ativa em `comissao_membros`. Estar logado não basta: qualquer um cria
--     conta com a chave pública.
--
--  5. IMPEDIMENTO: membro citado na denúncia (ou que se declara impedido)
--     deixa de enxergá-la — a regra está em `canal_pode_ver`, usada por todas
--     as políticas. O próprio denunciante pode marcar, no formulário, quais
--     membros não devem ter acesso.
--
--  6. O RELATO ORIGINAL NÃO SE ALTERA. Um gatilho recusa mudança nas colunas
--     do relato; a comissão só mexe na triagem, na apuração e na conclusão.
--
--  7. TUDO FICA NA TRILHA DE AUDITORIA (`denuncia_historico`): quem abriu,
--     quem mudou o quê e quando. A trilha só recebe linhas — não há política
--     que permita alterar ou apagar.
--
--  8. VÁRIAS EMPRESAS num canal só: cada uma tem o seu link (site/#/e/<slug>)
--     e a denúncia nasce presa à empresa do link. Membro da comissão ligado a
--     uma empresa só enxerga as denúncias dela; sem empresa (administração do
--     canal), enxerga todas. A regra também está em `canal_pode_ver`.
-- =============================================================================

create extension if not exists pgcrypto with schema extensions;

-- -----------------------------------------------------------------------------
-- Empresas atendidas pelo canal
--
-- `slug` é o pedaço do link: site/#/e/<slug>. Vai impresso no cartaz e no QR
-- code, então mudar depois invalida o material já colado nos murais.
-- `unidades` é a lista do campo "Unidade" do formulário daquela empresa.
-- Empresa não se apaga (as denúncias dela continuam existindo): desativa.
-- -----------------------------------------------------------------------------
create table if not exists public.empresas (
  id         uuid primary key default gen_random_uuid(),
  nome       text not null check (length(trim(nome)) between 2 and 160),
  slug       text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) between 2 and 60),
  unidades   text[] not null default '{}',
  ativa      boolean not null default true,
  criada_em  timestamptz not null default now()
);
-- quando o vínculo foi encerrado (vazio enquanto a empresa está ativa)
alter table public.empresas add column if not exists encerrada_em timestamptz;

-- -----------------------------------------------------------------------------
-- Comissão
--
-- `empresa_id` preenchido = membro daquela empresa, vê só as denúncias dela.
-- Vazio = membro da administração do canal, vê todas. Administrador é sempre
-- da administração do canal (é quem cria empresas e cadastra membros).
-- -----------------------------------------------------------------------------
create table if not exists public.comissao_membros (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  nome       text not null check (length(trim(nome)) between 2 and 120),
  email      text not null,
  papel      text not null default 'membro' check (papel in ('admin', 'membro')),
  ativo      boolean not null default true,
  criado_em  timestamptz not null default now()
);
alter table public.comissao_membros add column if not exists empresa_id uuid references public.empresas (id);
alter table public.comissao_membros drop constraint if exists comissao_admin_sem_empresa;
alter table public.comissao_membros add constraint comissao_admin_sem_empresa check (papel <> 'admin' or empresa_id is null);

-- -----------------------------------------------------------------------------
-- Denúncias
-- -----------------------------------------------------------------------------
create table if not exists public.denuncias (
  id             uuid primary key default gen_random_uuid(),
  protocolo      text not null unique,
  empresa_id     uuid not null references public.empresas (id),

  -- relato (imutável depois de gravado — ver gatilho denuncias_antes_de_alterar)
  categoria      text not null,
  unidade        text,
  local          text,
  quando         text,              -- texto livre: "semana passada", "todo dia"
  data_fato      date,
  acontecendo    text check (acontecendo in ('sim', 'nao', 'nao_sei')),
  frequencia     text check (frequencia in ('uma_vez', 'algumas_vezes', 'frequente', 'nao_sei')),
  descricao      text not null check (length(descricao) between 20 and 20000),
  envolvidos     text check (length(envolvidos) <= 2000),
  testemunhas    text check (length(testemunhas) <= 2000),
  ja_relatou     text check (length(ja_relatou) <= 500),
  vinculo        text check (vinculo in ('empregado', 'terceirizado', 'estagiario', 'ex_empregado', 'visitante', 'nao_informado')),
  identificado   boolean not null default false,
  nome           text check (length(nome) <= 160),
  contato        text check (length(contato) <= 160),

  -- triagem e apuração (a comissão altera)
  status         text not null default 'recebida'
                 check (status in ('recebida', 'em_analise', 'em_apuracao', 'aguardando_info', 'concluida', 'arquivada')),
  gravidade      text check (gravidade in ('baixa', 'media', 'alta', 'critica')),
  perigo         text check (perigo in ('psicossocial', 'ergonomico', 'acidente', 'fisico', 'quimico', 'biologico', 'nao_aplica')),
  encaminhar_pgr boolean not null default false,
  responsavel_id uuid references public.comissao_membros (user_id) on delete set null,
  resultado      text check (resultado in ('procedente', 'parcialmente_procedente', 'improcedente', 'sem_elementos')),
  resposta_final text check (length(resposta_final) <= 10000),

  -- datas
  criada_em        timestamptz not null default now(),
  atualizada_em    timestamptz not null default now(),
  triada_em        timestamptz,
  concluida_em     timestamptz,
  prazo_triagem    timestamptz not null,
  prazo_conclusao  timestamptz not null,

  constraint denuncias_categoria_valida check (categoria in (
    'assedio_moral', 'assedio_sexual', 'violencia', 'discriminacao', 'sobrecarga',
    'risco_grave', 'condicao_insegura', 'acidente_oculto', 'conduta', 'outro'
  )),
  -- identificação só existe se a pessoa escolheu se identificar
  constraint denuncias_anonima_sem_nome check (identificado or (nome is null and contato is null)),
  -- não se conclui sem dizer o resultado e o que foi feito
  constraint denuncias_conclusao_completa check (
    status <> 'concluida' or (resultado is not null and length(coalesce(resposta_final, '')) >= 10)
  ),
  constraint denuncias_arquivamento_explicado check (
    status <> 'arquivada' or length(coalesce(resposta_final, '')) >= 10
  )
);

create index if not exists denuncias_criada_em_idx on public.denuncias (criada_em desc);
create index if not exists denuncias_status_idx on public.denuncias (status);

-- Instalações anteriores às várias empresas: a coluna chega vazia. Se já houver
-- denúncia, ela vai para uma empresa "Empresa principal", que o administrador
-- renomeia no painel.
alter table public.denuncias add column if not exists empresa_id uuid references public.empresas (id);
do $$
begin
  if exists (select 1 from public.denuncias where empresa_id is null) then
    insert into public.empresas (nome, slug) values ('Empresa principal', 'principal') on conflict (slug) do nothing;
    update public.denuncias set empresa_id = (select id from public.empresas where slug = 'principal')
     where empresa_id is null;
  end if;
end $$;
alter table public.denuncias alter column empresa_id set not null;
create index if not exists denuncias_empresa_idx on public.denuncias (empresa_id, criada_em desc);

-- Senha de acompanhamento: tabela à parte, sem nenhuma política — só as
-- funções security definer abaixo leem.
create table if not exists public.denuncia_credenciais (
  denuncia_id    uuid primary key references public.denuncias (id) on delete cascade,
  senha_hash     text not null,
  tentativas     int not null default 0,
  bloqueada_ate  timestamptz
);

create table if not exists public.denuncia_mensagens (
  id           uuid primary key default gen_random_uuid(),
  denuncia_id  uuid not null references public.denuncias (id) on delete cascade,
  autor        text not null check (autor in ('denunciante', 'comissao')),
  autor_id     uuid references auth.users (id) on delete set null,  -- só quando autor = comissao
  texto        text not null check (length(trim(texto)) between 1 and 10000),
  lida         boolean not null default false,                      -- lida pela comissão
  criada_em    timestamptz not null default now(),
  constraint mensagens_denunciante_sem_autor check (autor = 'comissao' or autor_id is null)
);
create index if not exists denuncia_mensagens_denuncia_idx on public.denuncia_mensagens (denuncia_id, criada_em);

-- Notas internas: a comissão conversa entre si; o denunciante nunca vê.
create table if not exists public.denuncia_notas (
  id           uuid primary key default gen_random_uuid(),
  denuncia_id  uuid not null references public.denuncias (id) on delete cascade,
  autor_id     uuid references auth.users (id) on delete set null default auth.uid(),
  texto        text not null check (length(trim(texto)) between 1 and 10000),
  criada_em    timestamptz not null default now()
);
create index if not exists denuncia_notas_denuncia_idx on public.denuncia_notas (denuncia_id, criada_em);

-- Medidas adotadas — NR-01 1.5.5.3.1: "A implementação das medidas de
-- prevenção e respectivos ajustes devem ser registrados". O `tipo` segue a
-- ordem de prioridade da NR-01 1.4.1 "g" (eliminação > coletiva >
-- administrativa > individual), mais as medidas de conduta.
create table if not exists public.denuncia_medidas (
  id           uuid primary key default gen_random_uuid(),
  denuncia_id  uuid not null references public.denuncias (id) on delete cascade,
  tipo         text not null check (tipo in ('eliminacao', 'protecao_coletiva', 'administrativa', 'protecao_individual', 'disciplinar', 'acolhimento', 'outra')),
  descricao    text not null check (length(trim(descricao)) between 3 and 2000),
  responsavel  text check (length(responsavel) <= 160),
  prazo        date,
  situacao     text not null default 'planejada' check (situacao in ('planejada', 'em_andamento', 'concluida', 'cancelada')),
  criada_em    timestamptz not null default now(),
  concluida_em timestamptz
);
create index if not exists denuncia_medidas_denuncia_idx on public.denuncia_medidas (denuncia_id);

create table if not exists public.denuncia_anexos (
  id           uuid primary key default gen_random_uuid(),
  denuncia_id  uuid not null references public.denuncias (id) on delete cascade,
  caminho      text not null unique,     -- caminho no bucket denuncia-anexos
  nome         text not null,            -- "anexo-1.jpg" — nunca o nome original do arquivo
  tipo         text not null,
  tamanho      int not null check (tamanho between 1 and 10485760),
  enviado_por  text not null default 'denunciante' check (enviado_por in ('denunciante', 'comissao')),
  criado_em    timestamptz not null default now()
);
create index if not exists denuncia_anexos_denuncia_idx on public.denuncia_anexos (denuncia_id);

create table if not exists public.denuncia_impedimentos (
  denuncia_id  uuid not null references public.denuncias (id) on delete cascade,
  user_id      uuid not null references public.comissao_membros (user_id) on delete cascade,
  origem       text not null check (origem in ('denunciante', 'declarado', 'admin')),
  motivo       text check (length(motivo) <= 500),
  criado_em    timestamptz not null default now(),
  primary key (denuncia_id, user_id)
);

-- Trilha de auditoria. `usuario_id` nulo = ação do denunciante ou do sistema.
create table if not exists public.denuncia_historico (
  id           bigint generated always as identity primary key,
  denuncia_id  uuid references public.denuncias (id) on delete cascade,
  usuario_id   uuid references auth.users (id) on delete set null,
  acao         text not null,
  detalhe      jsonb not null default '{}'::jsonb,
  criado_em    timestamptz not null default now()
);
create index if not exists denuncia_historico_denuncia_idx on public.denuncia_historico (denuncia_id, criado_em);
create index if not exists denuncia_historico_criado_idx on public.denuncia_historico (criado_em desc);

-- -----------------------------------------------------------------------------
-- Regras de acesso
-- -----------------------------------------------------------------------------
create or replace function public.canal_eh_membro()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from comissao_membros where user_id = auth.uid() and ativo);
$$;

create or replace function public.canal_eh_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from comissao_membros where user_id = auth.uid() and ativo and papel = 'admin');
$$;

-- Membro ativo que enxerga a empresa: da própria empresa ou da administração.
create or replace function public.canal_ve_empresa(p_empresa uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from comissao_membros
                  where user_id = auth.uid() and ativo
                    and (empresa_id is null or empresa_id = p_empresa));
$$;

create or replace function public.canal_pode_ver(p_denuncia uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from denuncias d where d.id = p_denuncia and canal_ve_empresa(d.empresa_id))
     and not exists (select 1 from denuncia_impedimentos
                     where denuncia_id = p_denuncia and user_id = auth.uid());
$$;

create or replace function public.canal_registrar(p_denuncia uuid, p_acao text, p_detalhe jsonb default '{}'::jsonb)
returns void language sql security definer set search_path = public as $$
  insert into denuncia_historico (denuncia_id, usuario_id, acao, detalhe)
  values (p_denuncia, auth.uid(), p_acao, coalesce(p_detalhe, '{}'::jsonb));
$$;

-- Prazos da política interna (dias corridos). Espelha `prazos` em src/config.js.
create or replace function public.canal_prazos(p_categoria text, p_inicio timestamptz,
  out prazo_triagem timestamptz, out prazo_conclusao timestamptz)
language sql stable as $$
  select p_inicio + case when p_categoria in ('risco_grave', 'violencia') then interval '1 day'  else interval '5 days'  end,
         p_inicio + case when p_categoria in ('risco_grave', 'violencia') then interval '15 days' else interval '30 days' end;
$$;

alter table public.empresas              enable row level security;
alter table public.comissao_membros      enable row level security;
alter table public.denuncias             enable row level security;
alter table public.denuncia_credenciais  enable row level security;
alter table public.denuncia_mensagens    enable row level security;
alter table public.denuncia_notas        enable row level security;
alter table public.denuncia_medidas      enable row level security;
alter table public.denuncia_anexos       enable row level security;
alter table public.denuncia_impedimentos enable row level security;
alter table public.denuncia_historico    enable row level security;

-- A chave pública (anon) não toca em tabela nenhuma.
revoke all on public.empresas, public.comissao_membros, public.denuncias, public.denuncia_credenciais,
  public.denuncia_mensagens, public.denuncia_notas, public.denuncia_medidas,
  public.denuncia_anexos, public.denuncia_impedimentos, public.denuncia_historico
  from anon;
-- Credenciais: nem a comissão.
revoke all on public.denuncia_credenciais from authenticated;
-- Trilha: a comissão só lê; quem escreve são as funções e gatilhos.
revoke insert, update, delete on public.denuncia_historico from authenticated;
-- Denúncia nasce só pela função pública e não se apaga pelo site.
revoke insert, delete on public.denuncias from authenticated;

-- empresas: cada membro vê as que atende; só o administrador cria e altera
drop policy if exists empresas_ler on public.empresas;
create policy empresas_ler on public.empresas for select to authenticated
  using (canal_ve_empresa(id));
drop policy if exists empresas_criar on public.empresas;
create policy empresas_criar on public.empresas for insert to authenticated
  with check (canal_eh_admin());
drop policy if exists empresas_alterar on public.empresas;
create policy empresas_alterar on public.empresas for update to authenticated
  using (canal_eh_admin()) with check (canal_eh_admin());
revoke delete on public.empresas from authenticated;

-- comissao_membros
drop policy if exists membros_ler on public.comissao_membros;
create policy membros_ler on public.comissao_membros for select to authenticated
  using (canal_eh_membro() or user_id = auth.uid());
drop policy if exists membros_admin on public.comissao_membros;
create policy membros_admin on public.comissao_membros for all to authenticated
  using (canal_eh_admin()) with check (canal_eh_admin());

-- denuncias
drop policy if exists denuncias_ler on public.denuncias;
create policy denuncias_ler on public.denuncias for select to authenticated
  using (canal_pode_ver(id));
drop policy if exists denuncias_alterar on public.denuncias;
create policy denuncias_alterar on public.denuncias for update to authenticated
  using (canal_pode_ver(id)) with check (canal_pode_ver(id));

-- mensagens: a comissão lê e escreve como "comissao", sempre em nome próprio
drop policy if exists mensagens_ler on public.denuncia_mensagens;
create policy mensagens_ler on public.denuncia_mensagens for select to authenticated
  using (canal_pode_ver(denuncia_id));
drop policy if exists mensagens_escrever on public.denuncia_mensagens;
create policy mensagens_escrever on public.denuncia_mensagens for insert to authenticated
  with check (canal_pode_ver(denuncia_id) and autor = 'comissao' and autor_id = auth.uid() and not lida);
revoke update, delete on public.denuncia_mensagens from authenticated;

-- notas internas
drop policy if exists notas_ler on public.denuncia_notas;
create policy notas_ler on public.denuncia_notas for select to authenticated
  using (canal_pode_ver(denuncia_id));
drop policy if exists notas_escrever on public.denuncia_notas;
create policy notas_escrever on public.denuncia_notas for insert to authenticated
  with check (canal_pode_ver(denuncia_id) and autor_id = auth.uid());
revoke update, delete on public.denuncia_notas from authenticated;

-- medidas
drop policy if exists medidas_ler on public.denuncia_medidas;
create policy medidas_ler on public.denuncia_medidas for select to authenticated
  using (canal_pode_ver(denuncia_id));
drop policy if exists medidas_criar on public.denuncia_medidas;
create policy medidas_criar on public.denuncia_medidas for insert to authenticated
  with check (canal_pode_ver(denuncia_id));
drop policy if exists medidas_alterar on public.denuncia_medidas;
create policy medidas_alterar on public.denuncia_medidas for update to authenticated
  using (canal_pode_ver(denuncia_id)) with check (canal_pode_ver(denuncia_id));
revoke delete on public.denuncia_medidas from authenticated;

-- anexos (a gravação vem pelas funções)
drop policy if exists anexos_ler on public.denuncia_anexos;
create policy anexos_ler on public.denuncia_anexos for select to authenticated
  using (canal_pode_ver(denuncia_id));
revoke insert, update, delete on public.denuncia_anexos from authenticated;

-- impedimentos: quem pode ver a denúncia vê quem está afastado dela. O próprio
-- afastado não vê nem a linha do afastamento — saber que "existe uma denúncia
-- em que fui citado" já seria vazamento.
drop policy if exists impedimentos_ler on public.denuncia_impedimentos;
create policy impedimentos_ler on public.denuncia_impedimentos for select to authenticated
  using (canal_pode_ver(denuncia_id));
drop policy if exists impedimentos_revogar on public.denuncia_impedimentos;
create policy impedimentos_revogar on public.denuncia_impedimentos for delete to authenticated
  using (canal_eh_admin() and canal_pode_ver(denuncia_id) and origem <> 'denunciante');
revoke insert, update on public.denuncia_impedimentos from authenticated;

-- histórico
drop policy if exists historico_ler on public.denuncia_historico;
create policy historico_ler on public.denuncia_historico for select to authenticated
  using (case when denuncia_id is null then canal_eh_admin() else canal_pode_ver(denuncia_id) end);

-- -----------------------------------------------------------------------------
-- Gatilhos
-- -----------------------------------------------------------------------------

-- Protege o relato e registra toda mudança de triagem na trilha.
create or replace function public.denuncias_antes_de_alterar()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_mudou jsonb := '{}'::jsonb;
  c text;
begin
  if (new.protocolo, new.categoria, new.unidade, new.local, new.quando, new.data_fato,
      new.acontecendo, new.frequencia, new.descricao, new.envolvidos, new.testemunhas,
      new.ja_relatou, new.vinculo, new.identificado, new.nome, new.contato,
      new.criada_em, new.prazo_triagem)
     is distinct from
     (old.protocolo, old.categoria, old.unidade, old.local, old.quando, old.data_fato,
      old.acontecendo, old.frequencia, old.descricao, old.envolvidos, old.testemunhas,
      old.ja_relatou, old.vinculo, old.identificado, old.nome, old.contato,
      old.criada_em, old.prazo_triagem)
     and coalesce(current_setting('canal.expurgo', true), '') <> 'sim' then
    raise exception 'O relato original da denúncia não pode ser alterado.';
  end if;

  foreach c in array array['status', 'gravidade', 'perigo', 'encaminhar_pgr', 'responsavel_id', 'resultado', 'resposta_final', 'prazo_conclusao', 'empresa_id'] loop
    if to_jsonb(new) -> c is distinct from to_jsonb(old) -> c then
      v_mudou := v_mudou || jsonb_build_object(c, jsonb_build_object('de', to_jsonb(old) -> c, 'para', to_jsonb(new) -> c));
    end if;
  end loop;

  if new.status <> 'recebida' and old.triada_em is null then
    new.triada_em := now();
  end if;
  if new.status in ('concluida', 'arquivada') and old.status not in ('concluida', 'arquivada') then
    new.concluida_em := now();
  elsif new.status not in ('concluida', 'arquivada') then
    new.concluida_em := null;
  end if;

  new.atualizada_em := now();
  if v_mudou <> '{}'::jsonb then
    perform canal_registrar(new.id, 'alterou', v_mudou);
  end if;
  return new;
end;
$$;
drop trigger if exists denuncias_antes_de_alterar on public.denuncias;
create trigger denuncias_antes_de_alterar before update on public.denuncias
  for each row execute function public.denuncias_antes_de_alterar();

create or replace function public.canal_registrar_insercao()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_table_name = 'denuncia_mensagens' then
    perform canal_registrar(new.denuncia_id,
      case when new.autor = 'comissao' then 'mensagem_comissao' else 'mensagem_denunciante' end, '{}'::jsonb);
    update denuncias set atualizada_em = now() where id = new.denuncia_id and new.autor = 'comissao';
  elsif tg_table_name = 'denuncia_notas' then
    perform canal_registrar(new.denuncia_id, 'nota_interna', '{}'::jsonb);
  elsif tg_table_name = 'denuncia_medidas' then
    perform canal_registrar(new.denuncia_id, 'medida_criada', jsonb_build_object('tipo', new.tipo, 'descricao', new.descricao));
  end if;
  return new;
end;
$$;
drop trigger if exists mensagens_registrar on public.denuncia_mensagens;
create trigger mensagens_registrar after insert on public.denuncia_mensagens
  for each row execute function public.canal_registrar_insercao();
drop trigger if exists notas_registrar on public.denuncia_notas;
create trigger notas_registrar after insert on public.denuncia_notas
  for each row execute function public.canal_registrar_insercao();
drop trigger if exists medidas_registrar on public.denuncia_medidas;
create trigger medidas_registrar after insert on public.denuncia_medidas
  for each row execute function public.canal_registrar_insercao();

create or replace function public.denuncia_medidas_antes_de_alterar()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.denuncia_id <> old.denuncia_id then
    raise exception 'Medida não pode mudar de denúncia.';
  end if;
  if new.situacao = 'concluida' and old.situacao <> 'concluida' then
    new.concluida_em := now();
  elsif new.situacao <> 'concluida' then
    new.concluida_em := null;
  end if;
  if new.situacao is distinct from old.situacao then
    perform canal_registrar(new.denuncia_id, 'medida_alterada',
      jsonb_build_object('descricao', new.descricao, 'de', old.situacao, 'para', new.situacao));
  end if;
  return new;
end;
$$;
drop trigger if exists medidas_antes_de_alterar on public.denuncia_medidas;
create trigger medidas_antes_de_alterar before update on public.denuncia_medidas
  for each row execute function public.denuncia_medidas_antes_de_alterar();

-- Encerrar ou reativar o vínculo com uma empresa só pelas funções
-- canal_encerrar_empresa / canal_reativar_empresa, que exigem o motivo — o
-- motivo chega aqui por `canal.motivo`. Um UPDATE direto em `ativa` é recusado,
-- para o histórico nunca ter encerramento sem explicação.
create or replace function public.empresas_antes_de_alterar()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.ativa is distinct from old.ativa then
    if coalesce(current_setting('canal.motivo', true), '') = '' then
      raise exception 'Use "Encerrar vínculo" ou "Reativar vínculo": o motivo é obrigatório.' using errcode = 'P0001';
    end if;
    new.encerrada_em := case when new.ativa then null else now() end;
  end if;
  return new;
end;
$$;
drop trigger if exists empresas_antes_de_alterar on public.empresas;
create trigger empresas_antes_de_alterar before update on public.empresas
  for each row execute function public.empresas_antes_de_alterar();

-- Registra na trilha geral o cadastro, o encerramento, a reativação e as
-- mudanças de dados das empresas (é o que a mini-aba "Histórico" mostra).
create or replace function public.empresas_registrar()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform canal_registrar(null, 'empresa_insert',
      jsonb_build_object('empresa_id', new.id, 'nome', new.nome, 'slug', new.slug, 'ativa', new.ativa));
    return new;
  end if;
  if new.ativa is distinct from old.ativa then
    perform canal_registrar(null, case when new.ativa then 'empresa_reativada' else 'empresa_encerrada' end,
      jsonb_build_object('empresa_id', new.id, 'nome', new.nome, 'slug', new.slug,
        'motivo', nullif(current_setting('canal.motivo', true), ''),
        'membros_desativados', nullif(current_setting('canal.membros_desativados', true), '')::int));
  end if;
  if (new.nome, new.slug, new.unidades) is distinct from (old.nome, old.slug, old.unidades) then
    perform canal_registrar(null, 'empresa_update',
      jsonb_build_object('empresa_id', new.id, 'nome', new.nome, 'slug', new.slug, 'ativa', new.ativa,
        'antes', jsonb_build_object('nome', old.nome, 'slug', old.slug)));
  end if;
  return new;
end;
$$;
drop trigger if exists empresas_registrar on public.empresas;
create trigger empresas_registrar after insert or update on public.empresas
  for each row execute function public.empresas_registrar();

-- Registra na trilha geral as mudanças na composição da comissão.
create or replace function public.comissao_membros_registrar()
returns trigger language plpgsql security definer set search_path = public as $$
declare r public.comissao_membros;
begin
  if tg_op = 'DELETE' then r := old; else r := new; end if;
  perform canal_registrar(null, 'membro_' || lower(tg_op),
    jsonb_build_object('nome', r.nome, 'papel', r.papel, 'ativo', r.ativo, 'empresa',
      (select e.nome from empresas e where e.id = r.empresa_id)));
  return r;
end;
$$;
drop trigger if exists comissao_membros_registrar on public.comissao_membros;
create trigger comissao_membros_registrar after insert or update or delete on public.comissao_membros
  for each row execute function public.comissao_membros_registrar();

