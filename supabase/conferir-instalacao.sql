-- =============================================================================
--  Confere a instalação do canal. Rode no SQL Editor DEPOIS do schema.sql.
--  Não altera nada: só lê e mostra, item por item, o que está pronto e o que
--  falta. Onde aparecer "✗", a coluna ao lado diz como resolver.
-- =============================================================================
select item,
       case when ok then '✔' else '✗' end as situacao,
       case when ok then '' else como_resolver end as como_resolver
from (values
  (1, 'Tabelas do canal (12)',
      (select count(*) = 12 from information_schema.tables
        where table_schema = 'public'
          and table_name in ('empresas', 'comissao_membros', 'denuncias', 'denuncia_credenciais', 'denuncia_mensagens',
                             'denuncia_notas', 'denuncia_medidas', 'denuncia_anexos', 'denuncia_impedimentos',
                             'denuncia_historico', 'canal_avisos', 'canal_config')),
      'Rode supabase/schema.sql inteiro.'),
  (2, 'Proteção por linha (RLS) ligada em todas',
      (select coalesce(bool_and(relrowsecurity), false) from pg_class
        where relnamespace = 'public'::regnamespace
          and relname in ('empresas', 'comissao_membros', 'denuncias', 'denuncia_credenciais', 'denuncia_mensagens',
                          'denuncia_notas', 'denuncia_medidas', 'denuncia_anexos', 'denuncia_impedimentos',
                          'denuncia_historico', 'canal_avisos', 'canal_config')),
      'Rode supabase/schema.sql inteiro de novo.'),
  (3, 'Função de aviso por e-mail',
      exists (select 1 from pg_proc where proname = 'canal_avisar_nova'),
      'O schema rodado é anterior ao aviso por e-mail. Rode a versão atual do schema.sql.'),
  (4, 'Extensão pg_net (envio do e-mail)',
      exists (select 1 from pg_extension where extname = 'pg_net'),
      'Database > Extensions > pg_net > ligar, e rode o schema.sql de novo.'),
  (5, 'Bucket privado de anexos',
      exists (select 1 from storage.buckets where id = 'denuncia-anexos' and not public),
      'Rode supabase/schema.sql inteiro.'),
  (6, 'Várias empresas (cada denúncia presa a uma)',
      exists (select 1 from information_schema.columns
               where table_schema = 'public' and table_name = 'denuncias'
                 and column_name = 'empresa_id' and is_nullable = 'NO'),
      'O schema rodado é anterior às várias empresas. Rode as partes 1 e 2 atuais.'),
  (12, 'Encerramento de vínculo com empresa (com histórico)',
      exists (select 1 from pg_proc where proname = 'canal_encerrar_empresa'),
      'O schema rodado é anterior ao encerramento de vínculo. Rode as partes 1 e 2 atuais.'),
  (7, 'Empresa ativa cadastrada',
      exists (select 1 from public.empresas where ativa),
      'Painel > Empresas > Nova empresa. Sem empresa ativa, ninguém consegue denunciar.'),
  (8, 'E-mail que recebe o aviso',
      exists (select 1 from public.canal_avisos where ativo),
      'insert into public.canal_avisos (email) values (''tiago.godoy@yahoo.com.br'');'),
  (9, 'Administrador ativo na comissão',
      exists (select 1 from public.comissao_membros where papel = 'admin' and ativo),
      'README, "Banco de dados", passos 3 e 4: criar o usuário em Authentication e promovê-lo a admin.'),
  (10, 'Chave do Resend guardada no Vault',
      exists (select 1 from vault.secrets where name = 'canal_resend_api_key'),
      'README, "Aviso por e-mail", passos 1 a 3.'),
  (11, 'Endereço do site (botão do e-mail)',
      exists (select 1 from public.canal_config where chave = 'site_url' and valor <> ''),
      'Depois de publicar: painel > Membros > Aviso de denúncia nova por e-mail > Endereço do site.')
) as t(ordem, item, ok, como_resolver)
order by ordem;
