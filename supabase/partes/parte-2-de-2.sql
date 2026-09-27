-- =============================================================================
--  Canal de Denúncias — banco de dados, PARTE 2 DE 2 (funções, aviso por e-mail, permissões e anexos)
--
--  Rode a PARTE 1 e depois a PARTE 2, cada uma inteira, no SQL Editor do
--  Supabase. Podem ser rodadas de novo sem perder dados.
--
--  Arquivo gerado a partir de supabase/schema.sql (npm run dividir-sql).
--  Não edite aqui: edite o schema.sql e gere de novo.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Funções PÚBLICAS (chave anon) — a única porta de quem denuncia
-- -----------------------------------------------------------------------------

-- Alfabeto sem caracteres que se confundem ao anotar à mão (0/O, 1/I/L).
create or replace function public.canal_codigo(p_tamanho int)
returns text language plpgsql volatile set search_path = public, extensions as $$
declare
  alfabeto constant text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  bytes bytea := gen_random_bytes(p_tamanho);
  saida text := '';
  i int;
begin
  for i in 0 .. p_tamanho - 1 loop
    -- 248 é o maior múltiplo de 31 abaixo de 256: descarta o viés do módulo
    while get_byte(bytes, i) >= 248 loop
      bytes := set_byte(bytes, i, get_byte(gen_random_bytes(1), 0));
    end loop;
    saida := saida || substr(alfabeto, get_byte(bytes, i) % 31 + 1, 1);
  end loop;
  return saida;
end;
$$;

-- "d7k3-m9 xp" → "D7K3M9XP": o que a pessoa digita vira o formato gravado.
create or replace function public.canal_normalizar(p text)
returns text language sql immutable as $$
  select upper(regexp_replace(coalesce(p, ''), '[^A-Za-z0-9]', '', 'g'));
$$;

-- A empresa do link. Nula se o link não existe ou a empresa foi desativada.
create or replace function public.canal_empresa_publica(p_slug text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', id, 'nome', nome, 'slug', slug, 'unidades', to_jsonb(unidades))
    from empresas where slug = lower(trim(p_slug)) and ativa;
$$;

-- Membros ativos que o denunciante pode excluir da apuração: os que enxergam
-- a empresa dele (os dela e os da administração do canal).
drop function if exists public.canal_membros_publicos();
create or replace function public.canal_membros_publicos(p_empresa uuid)
returns table (id uuid, nome text)
language sql stable security definer set search_path = public as $$
  select user_id, nome from comissao_membros
   where ativo and (empresa_id is null or empresa_id = p_empresa)
   order by nome;
$$;

-- Confere protocolo + senha. Devolve o id da denúncia OU o texto do erro.
--
-- Não levanta exceção de propósito: exceção desfaz a transação inteira, e o
-- contador de tentativas erradas voltaria a zero a cada erro — o bloqueio
-- nunca aconteceria. Por isso as funções públicas devolvem {"erro": "..."}.
--
-- Cinco erros seguidos travam aquele protocolo por 15 minutos. A mensagem é a
-- mesma para protocolo inexistente e senha errada, para que ninguém descubra
-- por tentativa quais protocolos existem.
create or replace function public.canal_autenticar(p_protocolo text, p_senha text,
  out id_denuncia uuid, out erro text)
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_id uuid;
  v_cred denuncia_credenciais%rowtype;
begin
  select d.id into v_id from denuncias d where d.protocolo = canal_normalizar(p_protocolo);
  if v_id is null then
    perform pg_sleep(0.3);   -- mesmo tempo de resposta de uma senha errada
    erro := 'Protocolo ou senha incorretos.';
    return;
  end if;

  select * into v_cred from denuncia_credenciais c where c.denuncia_id = v_id for update;
  if v_cred.bloqueada_ate is not null and v_cred.bloqueada_ate > now() then
    erro := 'Muitas tentativas erradas. Aguarde 15 minutos e tente de novo.';
    return;
  end if;

  if v_cred.senha_hash is distinct from crypt(canal_normalizar(p_senha), v_cred.senha_hash) then
    update denuncia_credenciais c
       set tentativas = c.tentativas + 1,
           bloqueada_ate = case when c.tentativas + 1 >= 5 then now() + interval '15 minutes' end
     where c.denuncia_id = v_id;
    erro := 'Protocolo ou senha incorretos.';
    return;
  end if;

  update denuncia_credenciais c set tentativas = 0, bloqueada_ate = null where c.denuncia_id = v_id;
  id_denuncia := v_id;
end;
$$;

create or replace function public.canal_registrar_denuncia(p jsonb)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  v_id uuid;
  v_protocolo text;
  v_senha text;
  v_identificado boolean := coalesce((p ->> 'identificado')::boolean, false);
  v_impedidos uuid[];
  v_ativos int;
  v_prazos record;
  v_empresa uuid;
begin
  select id into v_empresa from empresas where slug = lower(trim(coalesce(p ->> 'empresa', ''))) and ativa;
  if v_empresa is null then
    raise exception 'Link de empresa inválido ou desativado. Use o link ou QR code divulgado pela sua empresa.' using errcode = 'P0001';
  end if;

  -- Freio contra robô/enxurrada sem guardar IP: um teto global por janela.
  -- Um canal de uma empresa não recebe 30 denúncias em 10 minutos.
  if (select count(*) from denuncias where criada_em > now() - interval '10 minutes') >= 30 then
    raise exception 'O canal está recebendo muitos envios agora. Tente de novo em alguns minutos.' using errcode = 'P0001';
  end if;

  if nullif(p ->> 'data_fato', '')::date > current_date then
    raise exception 'A data do fato não pode estar no futuro.' using errcode = 'P0001';
  end if;

  if length(trim(coalesce(p ->> 'descricao', ''))) < 20 then
    raise exception 'Descreva o que aconteceu com pelo menos 20 caracteres.' using errcode = 'P0001';
  end if;

  select coalesce(array_agg(distinct x::uuid), '{}') into v_impedidos
    from jsonb_array_elements_text(coalesce(p -> 'impedidos', '[]'::jsonb)) x;
  -- só conta quem enxerga esta empresa
  select count(*) into v_ativos from comissao_membros
   where ativo and (empresa_id is null or empresa_id = v_empresa);
  if cardinality(v_impedidos) > 0 and v_ativos > 0
     and (select count(*) from comissao_membros
           where ativo and (empresa_id is null or empresa_id = v_empresa)
             and not (user_id = any (v_impedidos))) = 0 then
    raise exception 'Deixe pelo menos um membro da comissão com acesso à denúncia.' using errcode = 'P0001';
  end if;

  loop
    v_protocolo := canal_codigo(8);
    exit when not exists (select 1 from denuncias where protocolo = v_protocolo);
  end loop;
  v_senha := canal_codigo(10);
  select * into v_prazos from canal_prazos(p ->> 'categoria', now());

  insert into denuncias (
    protocolo, empresa_id, categoria, unidade, local, quando, data_fato, acontecendo, frequencia,
    descricao, envolvidos, testemunhas, ja_relatou, vinculo, identificado, nome, contato,
    prazo_triagem, prazo_conclusao
  ) values (
    v_protocolo,
    v_empresa,
    p ->> 'categoria',
    nullif(trim(p ->> 'unidade'), ''),
    nullif(trim(p ->> 'local'), ''),
    nullif(trim(p ->> 'quando'), ''),
    nullif(p ->> 'data_fato', '')::date,
    nullif(p ->> 'acontecendo', ''),
    nullif(p ->> 'frequencia', ''),
    trim(p ->> 'descricao'),
    nullif(trim(p ->> 'envolvidos'), ''),
    nullif(trim(p ->> 'testemunhas'), ''),
    nullif(trim(p ->> 'ja_relatou'), ''),
    coalesce(nullif(p ->> 'vinculo', ''), 'nao_informado'),
    v_identificado,
    case when v_identificado then nullif(trim(p ->> 'nome'), '') end,
    case when v_identificado then nullif(trim(p ->> 'contato'), '') end,
    v_prazos.prazo_triagem,
    v_prazos.prazo_conclusao
  ) returning id into v_id;

  insert into denuncia_credenciais (denuncia_id, senha_hash)
  values (v_id, crypt(v_senha, gen_salt('bf', 10)));

  insert into denuncia_impedimentos (denuncia_id, user_id, origem)
  select v_id, m.user_id, 'denunciante'
    from comissao_membros m
   where m.user_id = any (v_impedidos) and (m.empresa_id is null or m.empresa_id = v_empresa);

  insert into denuncia_historico (denuncia_id, usuario_id, acao, detalhe)
  values (v_id, null, 'recebida', jsonb_build_object('impedidos', cardinality(v_impedidos)));

  perform canal_avisar_nova(v_id);

  return jsonb_build_object('protocolo', v_protocolo, 'senha', v_senha);
end;
$$;

-- O que o denunciante vê: situação, datas, conversa e a resposta final.
-- Nada de notas internas, responsável, gravidade ou histórico.
create or replace function public.canal_consultar(p_protocolo text, p_senha text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  a record;
  v jsonb;
begin
  select * into a from canal_autenticar(p_protocolo, p_senha);
  if a.erro is not null then
    return jsonb_build_object('erro', a.erro);
  end if;

  select jsonb_build_object(
    'protocolo', d.protocolo,
    'empresa', (select e.nome from empresas e where e.id = d.empresa_id),
    'empresa_slug', (select e.slug from empresas e where e.id = d.empresa_id),
    'categoria', d.categoria,
    'unidade', d.unidade,
    'status', d.status,
    'resultado', case when d.status in ('concluida', 'arquivada') then d.resultado end,
    'resposta_final', case when d.status in ('concluida', 'arquivada') then d.resposta_final end,
    'criada_em', d.criada_em,
    'triada_em', d.triada_em,
    'concluida_em', d.concluida_em,
    'prazo_conclusao', d.prazo_conclusao,
    'descricao', d.descricao,
    'mensagens', coalesce((
      select jsonb_agg(jsonb_build_object('autor', m.autor, 'texto', m.texto, 'criada_em', m.criada_em) order by m.criada_em)
        from denuncia_mensagens m where m.denuncia_id = d.id), '[]'::jsonb),
    'anexos', coalesce((
      select jsonb_agg(jsonb_build_object('nome', x.nome, 'criado_em', x.criado_em) order by x.criado_em)
        from denuncia_anexos x where x.denuncia_id = d.id and x.enviado_por = 'denunciante'), '[]'::jsonb)
  ) into v
  from denuncias d where d.id = a.id_denuncia;
  return v;
end;
$$;

create or replace function public.canal_complementar(p_protocolo text, p_senha text, p_texto text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare a record;
begin
  select * into a from canal_autenticar(p_protocolo, p_senha);
  if a.erro is not null then
    return jsonb_build_object('erro', a.erro);
  end if;
  if length(trim(coalesce(p_texto, ''))) = 0 then
    return jsonb_build_object('erro', 'Escreva a mensagem.');
  end if;
  if length(p_texto) > 10000 then
    return jsonb_build_object('erro', 'Mensagem longa demais (máximo 10.000 caracteres).');
  end if;
  insert into denuncia_mensagens (denuncia_id, autor, texto) values (a.id_denuncia, 'denunciante', trim(p_texto));
  -- a comissão pediu informação e ela chegou: a apuração continua
  update denuncias set status = 'em_apuracao' where id = a.id_denuncia and status = 'aguardando_info';
  return jsonb_build_object('ok', true);
end;
$$;

-- Registra um arquivo que o navegador acabou de subir para o bucket, na pasta
-- do protocolo. O nome gravado é sempre "anexo-N": o nome original do arquivo
-- ("IMG_joao_2026...") pode identificar quem denunciou e não sai do aparelho.
create or replace function public.canal_registrar_anexo(
  p_protocolo text, p_senha text, p_caminho text, p_tipo text, p_tamanho int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  a record;
  v_qtd int;
  v_nome text;
begin
  select * into a from canal_autenticar(p_protocolo, p_senha);
  if a.erro is not null then
    return jsonb_build_object('erro', a.erro);
  end if;
  if split_part(p_caminho, '/', 1) <> canal_normalizar(p_protocolo)
     or p_caminho !~ '^[A-Z0-9]+/[a-z0-9-]+\.(jpg|pdf)$' then
    return jsonb_build_object('erro', 'Arquivo fora da pasta da denúncia.');
  end if;
  if p_tipo not in ('image/jpeg', 'application/pdf') then
    return jsonb_build_object('erro', 'Tipo de arquivo não aceito.');
  end if;
  select count(*) into v_qtd from denuncia_anexos where denuncia_id = a.id_denuncia;
  if v_qtd >= 20 then
    return jsonb_build_object('erro', 'Limite de anexos desta denúncia atingido.');
  end if;
  v_nome := 'anexo-' || (v_qtd + 1) || case when p_tipo = 'application/pdf' then '.pdf' else '.jpg' end;
  insert into denuncia_anexos (denuncia_id, caminho, nome, tipo, tamanho, enviado_por)
  values (a.id_denuncia, p_caminho, v_nome, p_tipo, p_tamanho, 'denunciante');
  perform canal_registrar(a.id_denuncia, 'anexo_denunciante', jsonb_build_object('nome', v_nome));
  return jsonb_build_object('ok', true, 'nome', v_nome);
end;
$$;

-- Usada pela política do bucket: só aceita upload anônimo na pasta de um
-- protocolo que existe e não está encerrado há mais de 30 dias.
create or replace function public.canal_pasta_aceita_upload(p_pasta text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from denuncias
     where protocolo = p_pasta
       and (concluida_em is null or concluida_em > now() - interval '30 days'));
$$;

-- -----------------------------------------------------------------------------
-- Funções da COMISSÃO
-- -----------------------------------------------------------------------------

-- Chamada quando um membro abre a denúncia: fica na trilha quem leu e quando,
-- e as mensagens do denunciante passam a contar como lidas.
create or replace function public.canal_abrir(p_denuncia uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not canal_pode_ver(p_denuncia) then
    raise exception 'Sem acesso a esta denúncia.' using errcode = '42501';
  end if;
  perform canal_registrar(p_denuncia, 'visualizou', '{}'::jsonb);
  update denuncia_mensagens set lida = true
   where denuncia_id = p_denuncia and autor = 'denunciante' and not lida;
end;
$$;

-- Conflito de interesse: o membro se declara impedido e perde o acesso na hora.
create or replace function public.canal_declarar_impedimento(p_denuncia uuid, p_motivo text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not canal_pode_ver(p_denuncia) then
    raise exception 'Sem acesso a esta denúncia.' using errcode = '42501';
  end if;
  perform canal_registrar(p_denuncia, 'declarou_impedimento', jsonb_build_object('motivo', p_motivo));
  insert into denuncia_impedimentos (denuncia_id, user_id, origem, motivo)
  values (p_denuncia, auth.uid(), 'declarado', nullif(trim(p_motivo), ''))
  on conflict do nothing;
end;
$$;

-- O admin afasta outro membro de uma denúncia (ex.: o membro foi citado).
create or replace function public.canal_afastar_membro(p_denuncia uuid, p_membro uuid, p_motivo text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not (canal_eh_admin() and canal_pode_ver(p_denuncia)) then
    raise exception 'Só o administrador com acesso à denúncia afasta membros.' using errcode = '42501';
  end if;
  if p_membro = auth.uid() then
    raise exception 'Para se afastar, use "Declarar impedimento".' using errcode = 'P0001';
  end if;
  insert into denuncia_impedimentos (denuncia_id, user_id, origem, motivo)
  values (p_denuncia, p_membro, 'admin', nullif(trim(p_motivo), ''))
  on conflict do nothing;
  perform canal_registrar(p_denuncia, 'afastou_membro',
    jsonb_build_object('membro', (select nome from comissao_membros where user_id = p_membro), 'motivo', p_motivo));
end;
$$;

-- O admin cadastra um membro que já tem conta criada em Authentication.
-- `p_empresa` vazio = administração do canal (vê todas as empresas).
drop function if exists public.canal_adicionar_membro(text, text, text);
create or replace function public.canal_adicionar_membro(p_email text, p_nome text, p_papel text, p_empresa uuid default null)
returns void language plpgsql security definer set search_path = public, auth as $$
declare v_user uuid;
begin
  if not canal_eh_admin() then
    raise exception 'Só o administrador cadastra membros.' using errcode = '42501';
  end if;
  if coalesce(p_papel, 'membro') = 'admin' and p_empresa is not null then
    raise exception 'Administrador é da administração do canal: deixe a empresa em branco.' using errcode = 'P0001';
  end if;
  select id into v_user from auth.users where lower(email) = lower(trim(p_email));
  if v_user is null then
    raise exception 'Não existe conta com esse e-mail. Crie o usuário em Authentication > Users no Supabase primeiro.' using errcode = 'P0001';
  end if;
  insert into comissao_membros (user_id, nome, email, papel, empresa_id)
  values (v_user, trim(p_nome), lower(trim(p_email)), coalesce(p_papel, 'membro'), p_empresa)
  on conflict (user_id) do update
    set nome = excluded.nome, papel = excluded.papel, empresa_id = excluded.empresa_id, ativo = true;
end;
$$;

-- Encerra o vínculo com uma empresa: o link para de abrir e ninguém mais
-- consegue denunciar por ele. As denúncias já recebidas continuam no painel
-- (o prazo de guarda vale mesmo depois do fim do contrato). Por padrão também
-- desativa os membros da comissão ligados só a ela.
create or replace function public.canal_encerrar_empresa(p_empresa uuid, p_motivo text, p_desativar_membros boolean default true)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_membros int := 0;
begin
  if not canal_eh_admin() then
    raise exception 'Só o administrador encerra o vínculo com uma empresa.' using errcode = '42501';
  end if;
  if length(trim(coalesce(p_motivo, ''))) < 3 then
    raise exception 'Informe o motivo do encerramento.' using errcode = 'P0001';
  end if;
  if not exists (select 1 from empresas where id = p_empresa and ativa) then
    raise exception 'Empresa não encontrada ou com vínculo já encerrado.' using errcode = 'P0001';
  end if;
  if coalesce(p_desativar_membros, true) then
    update comissao_membros set ativo = false where empresa_id = p_empresa and ativo;
    get diagnostics v_membros = row_count;
  end if;
  perform set_config('canal.motivo', trim(p_motivo), true);
  perform set_config('canal.membros_desativados', v_membros::text, true);
  update empresas set ativa = false where id = p_empresa;
  return jsonb_build_object('membros_desativados', v_membros);
end;
$$;

-- Reativa o vínculo: o link volta a abrir. Os membros desativados no
-- encerramento NÃO voltam sozinhos — o administrador reativa em Membros.
create or replace function public.canal_reativar_empresa(p_empresa uuid, p_motivo text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not canal_eh_admin() then
    raise exception 'Só o administrador reativa o vínculo com uma empresa.' using errcode = '42501';
  end if;
  if length(trim(coalesce(p_motivo, ''))) < 3 then
    raise exception 'Informe o motivo da reativação.' using errcode = 'P0001';
  end if;
  if not exists (select 1 from empresas where id = p_empresa and not ativa) then
    raise exception 'Empresa não encontrada ou com vínculo já ativo.' using errcode = 'P0001';
  end if;
  perform set_config('canal.motivo', trim(p_motivo), true);
  perform set_config('canal.membros_desativados', '', true);
  update empresas set ativa = true where id = p_empresa;
end;
$$;

-- LGPD — minimização: apaga a identificação e os nomes citados das denúncias
-- encerradas há mais de N anos, mantendo o que serve de estatística
-- (categoria, unidade, datas, resultado). Os arquivos anexos precisam ser
-- apagados à parte, pelo painel Storage do Supabase (ver README).
create or replace function public.canal_expurgar(p_anos int)
returns int language plpgsql security definer set search_path = public as $$
declare v_qtd int;
begin
  if not canal_eh_admin() then
    raise exception 'Só o administrador executa o expurgo.' using errcode = '42501';
  end if;
  if p_anos < 1 then
    raise exception 'Informe pelo menos 1 ano.' using errcode = 'P0001';
  end if;
  perform set_config('canal.expurgo', 'sim', true);
  update denuncias
     set nome = null, contato = null, identificado = false,
         envolvidos = null, testemunhas = null,
         descricao = '[relato removido no expurgo de ' || to_char(now(), 'DD/MM/YYYY') || ']'
   where status in ('concluida', 'arquivada')
     and concluida_em < now() - make_interval(years => p_anos)
     and descricao not like '[relato removido%';
  get diagnostics v_qtd = row_count;
  delete from denuncia_mensagens m using denuncias d
   where m.denuncia_id = d.id and d.descricao like '[relato removido%';
  delete from denuncia_notas n using denuncias d
   where n.denuncia_id = d.id and d.descricao like '[relato removido%';
  perform canal_registrar(null, 'expurgo', jsonb_build_object('anos', p_anos, 'denuncias', v_qtd));
  return v_qtd;
end;
$$;

-- -----------------------------------------------------------------------------
-- Aviso por e-mail de denúncia nova
--
-- Quando uma denúncia chega, o próprio banco manda um e-mail curto para os
-- endereços ativos de `canal_avisos`, pelo Resend (https://resend.com). O
-- e-mail diz que chegou uma denúncia, o protocolo, o assunto e o prazo da
-- triagem — NUNCA o relato nem quem denunciou: e-mail é encaminhado, fica em
-- celular desbloqueado e aparece na tela de bloqueio. Para ler e responder,
-- só pelo painel, com login.
--
-- Endereço de membro afastado da denúncia não recebe o aviso: ele não pode
-- nem saber que ela existe.
--
-- A chave do Resend NÃO fica neste arquivo, nem no site, nem no repositório:
-- fica no Vault do Supabase, cadastrada à mão (README, "Aviso por e-mail").
-- Sem a chave, a denúncia é registrada normalmente e a trilha anota que o
-- aviso falhou. O aviso nunca impede o registro de uma denúncia.
--
-- O envio é assíncrono (pg_net): sai logo depois que a denúncia é gravada, e
-- a resposta do Resend fica por algumas horas em net._http_response.
-- -----------------------------------------------------------------------------
do $$
begin
  create extension if not exists pg_net with schema extensions;
exception when others then
  raise notice 'pg_net indisponível — o aviso por e-mail fica desligado: %', sqlerrm;
end $$;

create table if not exists public.canal_avisos (
  email      text primary key check (email = lower(email) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  ativo      boolean not null default true,
  criado_em  timestamptz not null default now()
);

create table if not exists public.canal_config (
  chave  text primary key check (chave in ('site_url', 'aviso_remetente')),
  valor  text not null default ''
);

insert into public.canal_avisos (email) values ('tiago.godoy@yahoo.com.br') on conflict do nothing;
insert into public.canal_config (chave, valor) values
  ('site_url', ''),                                            -- ex.: https://denuncia.suaempresa.com.br
  ('aviso_remetente', 'Canal de Denúncias <onboarding@resend.dev>')
on conflict do nothing;

alter table public.canal_avisos enable row level security;
alter table public.canal_config enable row level security;
revoke all on public.canal_avisos, public.canal_config from anon;

-- Só o administrador vê e muda quem é avisado: pôr o próprio e-mail na lista
-- seria um jeito de saber de toda denúncia nova, inclusive das que o citam.
drop policy if exists avisos_admin on public.canal_avisos;
create policy avisos_admin on public.canal_avisos for all to authenticated
  using (canal_eh_admin()) with check (canal_eh_admin());
drop policy if exists config_admin on public.canal_config;
create policy config_admin on public.canal_config for all to authenticated
  using (canal_eh_admin()) with check (canal_eh_admin());

create or replace function public.canal_avisos_registrar()
returns trigger language plpgsql security definer set search_path = public as $$
declare r public.canal_avisos;
begin
  if tg_op = 'DELETE' then r := old; else r := new; end if;
  perform canal_registrar(null, 'aviso_' || lower(tg_op), jsonb_build_object('email', r.email, 'ativo', r.ativo));
  return r;
end;
$$;
drop trigger if exists canal_avisos_registrar on public.canal_avisos;
create trigger canal_avisos_registrar after insert or update or delete on public.canal_avisos
  for each row execute function public.canal_avisos_registrar();

-- Título das categorias para o e-mail. Espelha `titulo` em src/config.js
-- (scripts/conferir-categorias.mjs confere).
create or replace function public.canal_categoria_titulo(p text)
returns text language sql immutable as $$
  select case p
    when 'assedio_moral'     then 'Assédio moral'
    when 'assedio_sexual'    then 'Assédio sexual'
    when 'violencia'         then 'Violência ou ameaça'
    when 'discriminacao'     then 'Discriminação'
    when 'sobrecarga'        then 'Sobrecarga e pressão no trabalho'
    when 'risco_grave'       then 'Risco grave e iminente'
    when 'condicao_insegura' then 'Condição ou prática insegura'
    when 'acidente_oculto'   then 'Acidente ou quase acidente não registrado'
    when 'conduta'           then 'Conduta antiética ou irregularidade'
    when 'outro'             then 'Outro assunto'
    else p
  end;
$$;

create or replace function public.canal_avisar_nova(p_denuncia uuid)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare
  d denuncias%rowtype;
  v_destinos text[];
  v_chave text;
  v_remetente text;
  v_site text;
  v_urgente boolean;
  v_protocolo text;
  v_assunto text;
  v_linhas text;
  v_texto text;
  v_html text;
  v_fuso constant text := 'America/Sao_Paulo';
  v_empresa text;
begin
  select * into d from denuncias where id = p_denuncia;
  select nome into v_empresa from empresas where id = d.empresa_id;

  -- Não avisa: membro afastado desta denúncia, nem membro de OUTRA empresa
  -- (saber que a empresa vizinha recebeu denúncia já é vazamento).
  select coalesce(array_agg(a.email order by a.email), '{}') into v_destinos
    from canal_avisos a
   where a.ativo
     and not exists (
       select 1 from comissao_membros m
        where lower(m.email) = a.email
          and ((m.empresa_id is not null and m.empresa_id <> d.empresa_id)
               or exists (select 1 from denuncia_impedimentos i
                           where i.denuncia_id = p_denuncia and i.user_id = m.user_id)));
  if cardinality(v_destinos) = 0 then
    return;
  end if;

  select decrypted_secret into v_chave from vault.decrypted_secrets where name = 'canal_resend_api_key';
  if coalesce(v_chave, '') = '' then
    perform canal_registrar(p_denuncia, 'aviso_email_falhou',
      jsonb_build_object('motivo', 'chave do Resend não cadastrada no Vault (canal_resend_api_key)'));
    return;
  end if;

  select valor into v_remetente from canal_config where chave = 'aviso_remetente';
  select rtrim(valor, '/') into v_site from canal_config where chave = 'site_url';
  v_urgente := d.categoria in ('risco_grave', 'violencia');
  v_protocolo := substr(d.protocolo, 1, 4) || '-' || substr(d.protocolo, 5);

  -- O título diz a EMPRESA (para separar os e-mails na caixa de entrada), mas
  -- não o tema: o título aparece na tela de bloqueio do celular.
  v_assunto := case when v_urgente then '[URGENTE] ' else '' end
            || 'Nova denúncia — ' || v_empresa || ' — protocolo ' || v_protocolo;

  v_linhas := format(
    E'Empresa: %s\nProtocolo: %s\nRecebida em: %s\nAssunto: %s\nTriagem até: %s',
    v_empresa,
    v_protocolo,
    to_char(d.criada_em at time zone v_fuso, 'DD/MM/YYYY HH24:MI'),
    canal_categoria_titulo(d.categoria),
    to_char(d.prazo_triagem at time zone v_fuso, 'DD/MM/YYYY HH24:MI'));

  -- A abertura é genérica de propósito: é ela que aparece na prévia do
  -- celular. O assunto da denúncia só vem depois.
  v_texto := 'Uma nova denúncia chegou ao Canal de Denúncias. Por sigilo, o relato não vem por e-mail: '
    || 'leia e responda ao denunciante pelo painel da comissão'
    || case when coalesce(v_site, '') <> '' then ' (' || v_site || '/#/comissao)' else '' end
    || E'.\n\n'
    || case when v_urgente then E'ATENÇÃO: categoria urgente — triagem em até 24 horas.\n\n' else '' end
    || v_linhas
    || E'\n\nResponder a este e-mail NÃO chega ao denunciante.\nAviso automático do Canal de Denúncias.';

  v_html := '<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;color:#1a2632;max-width:540px">'
    || '<p style="margin:0 0 12px">Uma nova denúncia chegou ao Canal de Denúncias. Por sigilo, o relato não vem por e-mail: leia e <strong>responda ao denunciante</strong> pelo painel da comissão.</p>'
    || case when v_urgente then '<p style="margin:0 0 12px;padding:8px 12px;background:#fdecea;color:#b42318;border-radius:6px"><strong>URGENTE</strong> — triagem em até 24 horas.</p>' else '' end
    || '<table style="border-collapse:collapse;margin:0 0 16px">'
    || format('<tr><td style="padding:3px 16px 3px 0;color:#5d6d7b">Empresa</td><td><strong>%s</strong></td></tr>',
              replace(replace(replace(v_empresa, '&', '&amp;'), '<', '&lt;'), '>', '&gt;'))
    || format('<tr><td style="padding:3px 16px 3px 0;color:#5d6d7b">Protocolo</td><td style="font-family:monospace;font-size:16px"><strong>%s</strong></td></tr>', v_protocolo)
    || format('<tr><td style="padding:3px 16px 3px 0;color:#5d6d7b">Recebida em</td><td>%s</td></tr>', to_char(d.criada_em at time zone v_fuso, 'DD/MM/YYYY HH24:MI'))
    || format('<tr><td style="padding:3px 16px 3px 0;color:#5d6d7b">Assunto</td><td>%s</td></tr>', canal_categoria_titulo(d.categoria))
    || format('<tr><td style="padding:3px 16px 3px 0;color:#5d6d7b">Triagem até</td><td>%s</td></tr>', to_char(d.prazo_triagem at time zone v_fuso, 'DD/MM/YYYY HH24:MI'))
    || '</table>'
    || case when coalesce(v_site, '') <> ''
         then format('<p style="margin:0 0 16px"><a href="%s/#/comissao" style="display:inline-block;background:#1d4f73;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:bold">Abrir o painel da comissão</a></p>', v_site)
         else '' end
    || '<p style="margin:0;color:#5d6d7b;font-size:13px">Responder a este e-mail não chega ao denunciante. Aviso automático do Canal de Denúncias.</p>'
    || '</div>';

  perform net.http_post(
    url := 'https://api.resend.com/emails',
    headers := jsonb_build_object('Authorization', 'Bearer ' || v_chave, 'Content-Type', 'application/json'),
    body := jsonb_build_object(
      'from', v_remetente,
      'to', to_jsonb(v_destinos),
      'subject', v_assunto,
      'text', v_texto,
      'html', v_html));

  perform canal_registrar(p_denuncia, 'aviso_email', jsonb_build_object('destinos', cardinality(v_destinos)));
exception when others then
  -- nada aqui pode impedir a denúncia de ser registrada
  perform canal_registrar(p_denuncia, 'aviso_email_falhou', jsonb_build_object('motivo', sqlerrm));
end;
$$;

-- -----------------------------------------------------------------------------
-- Quem pode chamar o quê
-- -----------------------------------------------------------------------------
-- Tira de todo mundo (o Supabase dá execute em tudo por padrão) e devolve só
-- o que cada papel precisa. Funções internas como canal_registrar e
-- canal_autenticar ficam de fora: chamadas direto pela API, deixariam um
-- membro forjar linha de auditoria ou testar senhas sem passar pelo resto.
revoke execute on all functions in schema public from public, anon, authenticated;

grant execute on function public.canal_empresa_publica(text)                           to anon, authenticated;
grant execute on function public.canal_membros_publicos(uuid)                          to anon, authenticated;
grant execute on function public.canal_registrar_denuncia(jsonb)                       to anon, authenticated;
grant execute on function public.canal_consultar(text, text)                           to anon, authenticated;
grant execute on function public.canal_complementar(text, text, text)                  to anon, authenticated;
grant execute on function public.canal_registrar_anexo(text, text, text, text, int)    to anon, authenticated;
grant execute on function public.canal_pasta_aceita_upload(text)                       to anon, authenticated;

grant execute on function public.canal_eh_membro()                                     to authenticated;
grant execute on function public.canal_eh_admin()                                      to authenticated;
grant execute on function public.canal_pode_ver(uuid)                                  to authenticated;
grant execute on function public.canal_ve_empresa(uuid)                                to authenticated;
grant execute on function public.canal_abrir(uuid)                                     to authenticated;
grant execute on function public.canal_declarar_impedimento(uuid, text)                to authenticated;
grant execute on function public.canal_afastar_membro(uuid, uuid, text)                to authenticated;
grant execute on function public.canal_adicionar_membro(text, text, text, uuid)        to authenticated;
grant execute on function public.canal_expurgar(int)                                   to authenticated;
grant execute on function public.canal_encerrar_empresa(uuid, text, boolean)            to authenticated;
grant execute on function public.canal_reativar_empresa(uuid, text)                     to authenticated;

-- -----------------------------------------------------------------------------
-- Armazenamento dos anexos
-- -----------------------------------------------------------------------------
-- Bucket privado. Os limites repetem os do navegador (src/config.js), porque
-- quem quiser burlar o site fala direto com a API.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('denuncia-anexos', 'denuncia-anexos', false, 10485760,
        array['image/jpeg', 'application/pdf'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- Quem denuncia só ENVIA, e só para a pasta do próprio protocolo. Não lista,
-- não baixa, não sobrescreve (upload sempre com upsert desligado).
drop policy if exists "denuncia-anexos: envio anonimo" on storage.objects;
create policy "denuncia-anexos: envio anonimo" on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'denuncia-anexos'
              and public.canal_pasta_aceita_upload((storage.foldername(name))[1]));

-- A comissão baixa (link assinado) os anexos das denúncias que pode ver.
drop policy if exists "denuncia-anexos: leitura da comissao" on storage.objects;
create policy "denuncia-anexos: leitura da comissao" on storage.objects for select to authenticated
  using (bucket_id = 'denuncia-anexos'
         and exists (select 1 from public.denuncia_anexos a
                      where a.caminho = storage.objects.name and public.canal_pode_ver(a.denuncia_id)));

-- =============================================================================
--  PRIMEIRO ADMINISTRADOR
--  1. No Supabase: Authentication > Users > Add user (e-mail + senha, marque
--     "Auto Confirm User").
--  2. Rode, trocando o e-mail e o nome:
--
--     insert into public.comissao_membros (user_id, nome, email, papel)
--     select id, 'Nome da Pessoa', email, 'admin' from auth.users
--      where email = 'pessoa@empresa.com.br';
--
--  Os demais membros o próprio administrador cadastra pelo painel.
-- =============================================================================
