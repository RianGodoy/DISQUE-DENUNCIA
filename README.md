# Canal de Denúncias

Canal anônimo para trabalhadores relatarem assédio, violência, discriminação,
fatores de risco psicossociais, riscos de acidente e acidentes não registrados,
com apuração por uma comissão e indicadores para a CIPA e o PGR.

Projeto independente: **não tem relação com o CCO** nem com o monorepo
`cco-itaquareia`. Tem repositório, banco e hospedagem próprios.

---

## O que o sistema faz

**Um canal só atende várias empresas.** Cada empresa cadastrada ganha um link
próprio (`site/#/e/nome-da-empresa`) e um cartaz com QR code; a denúncia nasce
presa à empresa do link, o e-mail de aviso diz de qual empresa ela é, e o painel
tem uma aba **Empresas** com uma mini-aba de dashboard por empresa.

**Quem denuncia** (sem login, sem cadastro):

- escolhe o assunto, conta o que houve, onde e quando, e pode anexar fotos ou PDF;
- pode marcar membros da comissão que **não** devem ter acesso (ex.: o próprio denunciado);
- escolhe ficar anônimo (padrão) ou se identificar;
- recebe **protocolo + senha**, e com eles acompanha a situação, conversa com a
  comissão e manda novas provas, sem revelar quem é;
- tem o botão **Sair rápido** (ou `Esc` duas vezes), que troca a tela por uma
  busca no Google e não deixa o canal no botão "voltar".

**A comissão** (login individual):

- lista com prazos em semáforo, mensagens não lidas e filtros;
- triagem: situação, gravidade, classificação do perigo para o PGR, responsável,
  prorrogação de prazo com justificativa;
- conversa com o denunciante, notas internas, medidas adotadas (na ordem de
  prioridade da NR-01) e conclusão com resposta ao denunciante;
- impedimento: o membro se declara impedido, ou o administrador o afasta, e ele
  perde o acesso na hora;
- trilha de auditoria permanente (quem abriu, quem mudou o quê);
- indicadores (por mês, assunto, unidade, mapa de riscos psicossociais × unidade,
  prazos cumpridos) e exportação CSV **anonimizada** para o PGR;
- aviso por e-mail a cada denúncia nova (sem o relato), para tiago.godoy@yahoo.com.br;
- cartaz de divulgação com QR code para imprimir;
- cadastro de membros e expurgo de dados antigos (LGPD).

---

## Como a NR-01 e a Lei 14.457/2022 são atendidas

A exigência de **canal de denúncia com anonimato** vem da **Lei 14.457/2022,
art. 23** (empresas com CIPA). A **NR-01** exige que o gerenciamento de riscos
inclua os fatores psicossociais e que existam mecanismos de consulta aos
trabalhadores. Este canal cumpre as duas coisas. Os itens abaixo foram
conferidos no texto da Portaria MTE 1.419/2024, exceto o 1.4.1 "g" e o 1.4.3,
que ficam no capítulo 1.4 e não foram alterados por ela.

| Exigência | Onde está no sistema |
|---|---|
| NR-01 1.5.3.1.4 e 1.5.3.2.1: fatores de risco psicossociais no GRO | Categorias de assédio, violência, discriminação e sobrecarga; classificação "Fator de risco psicossocial"; mapa psicossocial × unidade nos Indicadores |
| NR-01 1.5.3.3 "b": consulta aos trabalhadores sobre a percepção de riscos | O próprio canal, aberto a qualquer trabalhador e terceirizado, anônimo |
| NR-01 1.5.5.3.1: registrar as medidas de prevenção | Aba **Medidas** de cada denúncia, com responsável, prazo e situação |
| NR-01 1.4.1 "g": ordem de prioridade das medidas | Tipos de medida em ordem: eliminação, coletiva, administrativa, EPI |
| NR-01 1.5.5.5: analisar acidentes e eventos perigosos com as informações dos trabalhadores | Categoria "Acidente ou quase acidente não registrado" |
| NR-01 1.4.3: direito de recusa diante de risco grave e iminente | Aviso de emergência no início e na categoria; triagem em 24 h |
| Lei 14.457/2022 art. 23, II: receber, acompanhar e apurar denúncias, **garantido o anonimato** | Protocolo + senha, conversa anônima, apuração, conclusão, sanção registrada como medida disciplinar |
| Lei 14.457/2022 art. 23, III: tema nas atividades da CIPA | Indicadores e CSV para a reunião da CIPA |
| LGPD | Minimização (nada de IP/aparelho), acesso individual auditado, expurgo por prazo |

### O que continua sendo tarefa da empresa, fora do sistema

1. **Nomear a comissão** por escrito, com gente de áreas diferentes (RH, CIPA,
   SESMT, jurídico), para sempre sobrar alguém sem conflito de interesse.
2. **Aprovar a política** (a página "Como funciona" é um ponto de partida) e
   incluir as regras de conduta sobre assédio e violência nas normas internas
   (Lei 14.457/2022, art. 23, I).
3. **Divulgar o canal** a todos, com o cartaz (painel → Cartaz), no treinamento
   e na integração de novos empregados e terceiros.
4. **Capacitar** os empregados ao menos a cada 12 meses (art. 23, IV).
5. **Levar os indicadores ao PGR**: o CSV "Relatório para o PGR" alimenta o
   inventário de riscos e o plano de ação.
6. **Definir o prazo de guarda** com o jurídico (`retencaoAnos` em `src/config.js`)
   e rodar o expurgo uma vez por ano.

---

## Várias empresas

- **Cadastrar:** painel → **Empresas** → **+ Nova empresa**. Informe o nome; o
  link é sugerido a partir dele (`Pedreira São João & Filhos` →
  `pedreira-sao-joao-filhos`) e as unidades aparecem no formulário daquela
  empresa. Só o administrador cria e edita empresas.
- **Divulgar:** na mini-aba da empresa, copie o link ou abra **Cartaz com QR
  code** e imprima. O endereço raiz do site, sem empresa, só orienta a usar o
  link da empresa e oferece o acompanhamento — a lista de empresas atendidas
  não é pública.
- **Dashboard por empresa:** cada mini-aba mostra relatos, % do total do canal,
  abertos, respondidos no prazo, procedentes e os percentuais por assunto, tipo
  de risco, situação e unidade. A "Visão geral" compara as empresas entre si.
- **Quem vê o quê:** em **Membros**, cada membro pode ficar ligado a uma empresa
  ("Só Construtora X") — aí ele vê só as denúncias, indicadores e o dashboard
  dela, e não recebe aviso das outras. Sem empresa, vê todas (é o caso do
  administrador, que é sempre da administração do canal).
- **Desativar:** desmarcar "Recebendo denúncias" faz o link parar de abrir; as
  denúncias já recebidas continuam no painel. Empresa não se apaga.
- **E-mail:** o título traz a empresa (`Nova denúncia — Construtora X —
  protocolo ABCD-EFGH`), para separar os avisos na caixa de entrada.

---

## Por onde a denúncia é respondida

Toda a tratativa acontece no **painel da comissão** (`seusite/#/comissao`), com
login. O e-mail só avisa que chegou algo, e **responder o e-mail não chega a
ninguém**: a comissão não sabe quem denunciou, então não existe endereço para
onde responder. A conversa com o denunciante é sempre pelo canal.

1. **Entrar** no painel com e-mail e senha pessoais. Para isso a pessoa precisa
   ser membro da comissão (ver "Banco de dados", passos 3 e 4).
2. **Abrir a denúncia** pelo protocolo que veio no e-mail (a lista mostra primeiro
   as que vencem antes e as que têm mensagem nova).
3. **Triagem:** situação, gravidade, classificação do perigo, se vai para o PGR,
   responsável, prorrogação de prazo.
4. **Conversa com o denunciante:** a mensagem escrita ali aparece para ele em
   *Acompanhar* (com protocolo e senha). Marcando "é um pedido de informação", a
   situação vira "Aguardando denunciante". Quando ele responde, volta sozinha
   para "Em apuração" e a mensagem aparece como nova.
5. **Notas internas** (só a comissão vê) e **Medidas** adotadas, com responsável
   e prazo.
6. **Conclusão:** resultado (procedente, improcedente…) e a **resposta final**,
   que o denunciante lê no acompanhamento. Ou **Arquivar**, explicando o motivo.

O denunciante não recebe aviso quando a comissão responde, porque não há como
avisar alguém anônimo. Por isso a tela de confirmação orienta a voltar de vez
em quando em *Acompanhar*.

---

## Rodar na sua máquina

```bash
npm install
```

```bash
npm run dev
```

Abre em `http://localhost:5190`.

**Sem banco configurado o site roda em MODO DEMONSTRAÇÃO**: tudo funciona, mas
as denúncias ficam só no navegador (localStorage) e uma faixa amarela avisa isso
em todas as telas. No painel (`#/comissao`), escolha qual membro fictício ser;
a senha é `comissao`. Como administrador, use "Gerar 40 denúncias de exemplo"
para ver a lista e os indicadores com volume.

---

## Banco de dados (Supabase)

Recomendado: um **projeto Supabase novo, só para o canal**. Não reaproveite o
banco de outro sistema, porque quem administra o banco lê tudo o que está nele.
O plano gratuito aguenta com folga o volume de um canal de denúncias.

1. Crie o projeto em https://supabase.com (região São Paulo).
2. **SQL Editor** → rode `supabase/partes/parte-1-de-2.sql` e depois
   `parte-2-de-2.sql` (cada um num "Run"). As duas partes são o
   `supabase/schema.sql` cortado em pedaços de até 50 mil caracteres, para
   caberem numa mensagem de WhatsApp; `npm run dividir-sql` (ou `npm run
   testar`) gera de novo. Rodar outra vez por cima não perde dados — é assim
   que se atualiza o banco. Confira com `supabase/conferir-instalacao.sql`.
3. **Authentication → Users → Add user**: crie o primeiro administrador (marque
   "Auto Confirm User").
4. Ainda no SQL Editor, promova essa conta a administrador:

   ```sql
   insert into public.comissao_membros (user_id, nome, email, papel)
   select id, 'Nome da Pessoa', email, 'admin' from auth.users
    where email = 'pessoa@empresa.com.br';
   ```

5. **Authentication → Sign In / Providers**: desligue "Allow new users to sign
   up". Contas novas só são criadas pelo administrador. Mesmo que alguém crie
   uma conta, ela não enxerga nada sem estar ativa em `comissao_membros`, mas
   não há motivo para deixar a porta aberta.
6. **Project Settings → API**: copie a *Project URL* e a chave pública
   (*publishable*, `sb_publishable_…`) para o arquivo `.env.local` (modelo em
   `.env.example`):

   ```
   VITE_SUPABASE_URL=https://xxxx.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
   ```

   A chave *publishable* é pública por definição e pode ir no site. **Nunca**
   coloque a chave *secret* / *service_role* no site nem no repositório.

7. `npm run dev` de novo: a faixa de demonstração some e o painel passa a pedir
   e-mail e senha. Os demais membros o administrador cadastra pelo painel
   (aba **Membros**), depois de criar a conta deles no passo 3.

### Aviso por e-mail de denúncia nova

Toda denúncia que chega gera um e-mail para **tiago.godoy@yahoo.com.br**. Quem
envia é o próprio banco, pelo [Resend](https://resend.com), logo depois de
gravar a denúncia. O e-mail leva só protocolo, assunto, data e prazo de triagem,
com um botão para o painel. **O relato e a identificação nunca vão por e-mail.**
O título do e-mail não diz o tema (ele aparece na tela de bloqueio do celular),
e membro afastado da denúncia não recebe o aviso dela.

Para ligar:

1. Crie a conta no Resend **com o próprio e-mail tiago.godoy@yahoo.com.br**. Sem
   domínio próprio verificado, o Resend só entrega no e-mail do dono da conta,
   usando o remetente `onboarding@resend.dev`. Isso basta para um destinatário.
2. No Resend: **API Keys → Create API Key** (permissão *Sending access*). Copie
   a chave (`re_…`). Ela é secreta: não mande por WhatsApp nem cole no código.
3. No Supabase, **SQL Editor**, guarde a chave no Vault (troque o `re_...`):

   ```sql
   select vault.create_secret('re_...', 'canal_resend_api_key', 'Chave do Resend do canal de denúncias');
   ```

   Para trocar a chave depois: `select vault.update_secret((select id from vault.secrets where name = 'canal_resend_api_key'), 're_nova');`
4. Depois de publicar o site, informe o endereço dele no painel → **Membros →
   Aviso de denúncia nova por e-mail** (é o link do botão do e-mail).
5. Faça uma denúncia de teste. Na trilha dela deve aparecer "Aviso de denúncia
   nova enviado por e-mail". Se não chegar, olhe a caixa de **spam** do Yahoo
   (marque como "não é spam") e a resposta do Resend:

   ```sql
   select status_code, content, created from net._http_response order by created desc limit 5;
   ```

Outros destinatários são cadastrados na mesma tela. Para eles receberem, o
Resend exige um **domínio verificado** (Resend → Domains); depois troque o
remetente:

```sql
update public.canal_config set valor = 'Canal de Denúncias <canal@suaempresa.com.br>' where chave = 'aviso_remetente';
```

Sem a chave no Vault, ou se o Resend estiver fora do ar, a denúncia é
registrada do mesmo jeito e a trilha anota "Aviso por e-mail falhou" com o
motivo. O aviso nunca impede o registro.

### Como o banco protege o anonimato

- Quem denuncia não tem conta: o site fala com o banco só pelas funções `canal_*`,
  e nenhuma tabela aceita leitura ou escrita direta da chave pública.
- Nada que identifique o aparelho é gravado (IP, navegador, conta logada).
- A senha de acompanhamento só existe como hash bcrypt, numa tabela que nenhuma
  chave lê. Cinco erros travam o protocolo por 15 minutos, e protocolo
  inexistente dá o mesmo erro que senha errada.
- O relato original é imutável; a trilha de auditoria só recebe linhas.
- Membro impedido não vê a denúncia, a conversa, os anexos, a trilha nem o
  próprio impedimento.
- Fotos têm os metadados (GPS, modelo do celular, data) apagados no aparelho,
  antes do envio, e o nome do arquivo vira `anexo-N`.

O que o sistema **não** controla: a Vercel e o Supabase guardam IP nos logs de
acesso por alguns dias (isso é dito ao trabalhador na política), e a rede Wi-Fi
da empresa pode registrar os sites visitados. Por isso o canal recomenda usar o
4G do celular pessoal.

### Testes do banco

```bash
npm run testar
```

Roda `supabase/schema.sql` num PostgreSQL embutido (PGlite), imitando os papéis
do Supabase, e confere 85 garantias: quem vê o quê, bloqueio de senha, relato
imutável, impedimento, trilha, expurgo, limite de envios, o que o e-mail de
aviso leva (e o que não leva) e a separação entre empresas. Também confere se as
categorias e os prazos de `src/config.js` batem com os do SQL. Rode sempre que
mexer em qualquer um dos dois.

---

## Hospedagem (Vercel)

**Sem Git (pendrive):** copie a pasta para o computador que vai publicar e dê
dois cliques em `publicar.bat` — o passo a passo, com as respostas das
perguntas da primeira vez, está em `LEIA-ME-PUBLICAR.txt`. O banco vai junto no
`.env.production` (URL e chave pública; nada secreto), e o build na Vercel
**falha de propósito** se ele não chegar, para nunca publicar um canal em modo
demonstração.

**Com Git:**

1. Suba esta pasta num repositório próprio no GitHub.
2. Na Vercel: **Add New → Project**, importe o repositório. O `vercel.json` já
   diz como buildar (`npm run build`, pasta `dist`).
3. Em **Settings → Environment Variables**, cadastre `VITE_SUPABASE_URL` e
   `VITE_SUPABASE_ANON_KEY` (os mesmos do `.env.local`) e faça um novo deploy.
   Build sem essas variáveis sai em modo demonstração, e o build avisa.
4. Se tiver domínio, algo como `denuncia.suaempresa.com.br` passa mais confiança
   que um `*.vercel.app`.

O `vercel.json` já traz cabeçalhos de segurança (CSP restrita ao próprio site e
ao Supabase, sem iframe, sem referrer, sem indexação em buscadores).

---

## Personalizar

Tudo que muda de empresa para empresa está em **`src/config.js`**: nome da
empresa, nome da comissão, unidades, prazos, categorias, contatos de emergência,
prazo de guarda e limites de anexo.

As **categorias e os prazos também estão em `supabase/schema.sql`** (restrição
`denuncias_categoria_valida` e função `canal_prazos`). Mudou num lugar, mude no
outro e rode `npm run testar`.

---

## Próximos passos sugeridos

- **Aviso por e-mail quando o denunciante responde** uma pergunta da comissão.
  Hoje só a denúncia nova avisa; as respostas aparecem como "mensagem nova" no
  painel. É o mesmo mecanismo, chamado de `canal_complementar`.
- **Teste de ponta a ponta com o Supabase real** assim que o projeto existir:
  enviar uma denúncia com foto, responder pelo painel, acompanhar pelo protocolo.
  O SQL foi testado no PGlite, mas o upload de anexos para o Storage só dá para
  testar no Supabase de verdade. Se o upload anônimo der erro de "row-level
  security", confira se a política `denuncia-anexos: envio anonimo` foi criada.
- **Apagar os arquivos anexos no expurgo**: a função `canal_expurgar` limpa o
  texto e a identificação, mas os arquivos no Storage precisam ser apagados à
  mão (Storage → denuncia-anexos).

---

## Estrutura

```
src/
  config.js              empresa, unidades, categorias, prazos
  lib/api.js             escolhe entre banco-supabase.js e banco-local.js (demonstração)
  lib/anexos.js          limpeza de metadados das fotos
  paginas/               Início, Denunciar, Acompanhar, Como funciona, Cartaz
  paginas/comissao/      Entrar, Painel, Lista, Detalhe, Indicadores, Membros, Auditoria
supabase/schema.sql      banco inteiro: tabelas, RLS, funções, bucket
scripts/testar-schema.mjs     testes do banco (PGlite)
scripts/conferir-categorias.mjs  config.js × schema.sql
```
