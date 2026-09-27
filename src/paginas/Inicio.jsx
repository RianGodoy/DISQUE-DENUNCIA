import { Link } from 'react-router-dom'
import { categorias, empresa, grupos, prazos } from '../config'
import { Pagina } from '../componentes/Estrutura'
import Emergencia from '../componentes/Emergencia'
import { useTitulo } from '../lib/ganchos'
import { useBase, useEmpresa } from '../lib/contextoEmpresa'

const Icone = {
  anonimo: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>
  ),
  sigilo: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 3l18 18" /><path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" /><path d="M9.9 5.1A9.8 9.8 0 0 1 12 5c6 0 9.5 7 9.5 7a17 17 0 0 1-3.2 4.1M6.1 6.1A17 17 0 0 0 2.5 12S6 19 12 19a9.6 9.6 0 0 0 4-.9" /></svg>
  ),
  escudo: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3 4 6v6c0 5 3.4 8.3 8 9 4.6-.7 8-4 8-9V6l-8-3Z" /></svg>
  ),
  relogio: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
  ),
}

export default function Inicio() {
  const daEmpresa = useEmpresa()
  const base = useBase()
  useTitulo(daEmpresa.nome)
  return (
    <Pagina>
      <section className="heroi">
        <p className="fraco" style={{ margin: 0, fontWeight: 600 }}>{daEmpresa.nome}</p>
        <h1>Relate com segurança. Você não precisa se identificar.</h1>
        <p className="lead">
          Assédio, violência, discriminação, sobrecarga, riscos e acidentes escondidos: a {empresa.comissao} recebe,
          apura e responde. Você acompanha tudo pelo protocolo, sem revelar quem é.
        </p>
        <div className="botoes">
          <Link to={`${base}/denunciar`} className="btn btn-primario btn-grande">Fazer uma denúncia</Link>
          <Link to={`${base}/acompanhar`} className="btn btn-secundario btn-grande">Já tenho protocolo</Link>
        </div>
      </section>

      <Emergencia />

      <section className="secao">
        <h2>Suas garantias</h2>
        <div className="grade-2">
          <div className="garantia">
            <div className="icone">{Icone.anonimo}</div>
            <div>
              <h3>Anonimato de verdade</h3>
              <p>Não pedimos nome, matrícula nem login. O sistema não grava seu IP, seu aparelho nem de onde você acessou.</p>
            </div>
          </div>
          <div className="garantia">
            <div className="icone">{Icone.sigilo}</div>
            <div>
              <h3>Sigilo</h3>
              <p>Só a comissão lê. Se alguém da comissão estiver envolvido, você marca e essa pessoa não tem acesso.</p>
            </div>
          </div>
          <div className="garantia">
            <div className="icone">{Icone.escudo}</div>
            <div>
              <h3>Sem retaliação</h3>
              <p>É proibido punir, perseguir ou prejudicar quem denuncia de boa-fé ou quem colabora com a apuração.</p>
            </div>
          </div>
          <div className="garantia">
            <div className="icone">{Icone.relogio}</div>
            <div>
              <h3>Resposta com prazo</h3>
              <p>Primeira análise em até {prazos.triagem} dias (24 horas para risco grave ou violência) e resposta final em até {prazos.conclusao} dias.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="secao">
        <h2>Como funciona</h2>
        <div className="passos">
          <div className="passo"><h3>Você relata</h3><p>Conta o que aconteceu, onde e quando. Pode anexar fotos ou documentos.</p></div>
          <div className="passo"><h3>Recebe protocolo e senha</h3><p>Anote os dois. É com eles que você acompanha, sem se identificar.</p></div>
          <div className="passo"><h3>A comissão apura</h3><p>Analisa, ouve as pessoas, adota medidas e pode te fazer perguntas pelo canal.</p></div>
          <div className="passo"><h3>Você recebe a resposta</h3><p>O resultado e as medidas adotadas aparecem no acompanhamento.</p></div>
        </div>
      </section>

      <section className="secao">
        <h2>O que você pode relatar</h2>
        {Object.entries(grupos).map(([id, titulo]) => (
          <div key={id}>
            <p className="grupo-titulo">{titulo}</p>
            <div className="grade-auto">
              {categorias.filter((c) => c.grupo === id).map((c) => (
                <div className="categoria-cartao" key={c.id}>
                  <strong>{c.titulo}</strong>
                  <span>{c.resumo}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>

      <section className="secao">
        <h2>Para ficar ainda mais anônimo</h2>
        <details className="dobra">
          <summary>Use seu celular pessoal, fora do Wi-Fi da empresa</summary>
          <div>O canal não registra de onde você acessa, mas a rede da empresa pode registrar os sites visitados. No 4G do seu celular, isso não acontece.</div>
        </details>
        <details className="dobra">
          <summary>Cuidado com detalhes que só você sabe</summary>
          <div>Se o relato contém algo que só você presenciou ou disse, quem lê pode deduzir quem escreveu. Conte o essencial para a apuração; a comissão pode perguntar mais pelo canal, sem saber quem você é.</div>
        </details>
        <details className="dobra">
          <summary>Guarde o protocolo e a senha em lugar seguro</summary>
          <div>Anote em papel ou guarde num lugar que só você acesse. A senha não pode ser recuperada — nem pela comissão, que nunca a vê.</div>
        </details>
        <details className="dobra">
          <summary>Precisa sair da tela de repente?</summary>
          <div>Use o botão <strong>Sair rápido</strong> no alto da página, ou aperte <kbd>Esc</kbd> duas vezes: o canal é trocado por uma página de busca e não fica no botão “voltar”.</div>
        </details>
      </section>
    </Pagina>
  )
}
