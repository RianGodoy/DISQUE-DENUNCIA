import { Link } from 'react-router-dom'
import { empresa, prazos } from '../config'
import { Pagina } from '../componentes/Estrutura'
import { useTitulo } from '../lib/ganchos'
import { useBase, useEmpresa } from '../lib/contextoEmpresa'

/* Política do canal. É o texto que o trabalhador lê para decidir se confia —
   por isso diz também o que o sistema NÃO consegue garantir. */
export default function ComoFunciona() {
  useTitulo('Como funciona')
  const daEmpresa = useEmpresa()
  const base = useBase()
  return (
    <Pagina>
      <h1>Como funciona o canal</h1>
      <p className="suave">Política do Canal de Denúncias{daEmpresa ? ` — ${daEmpresa.nome}` : ''}.</p>

      <div className="cartao">
        <h2>Para que serve</h2>
        <p>
          Para qualquer pessoa que trabalha para a empresa — empregado, terceirizado, estagiário, ex-empregado ou
          visitante — relatar, com segurança e sem precisar se identificar:
        </p>
        <ul>
          <li>assédio moral, assédio sexual, violência, ameaça e discriminação;</li>
          <li>fatores de risco psicossociais: sobrecarga, jornada excessiva, metas abusivas, falta de apoio;</li>
          <li>riscos de acidente, condições inseguras, falta de EPI e descumprimento de normas de segurança;</li>
          <li>acidentes, quase acidentes e doenças do trabalho que não foram registrados;</li>
          <li>condutas antiéticas e irregularidades.</li>
        </ul>
        <p style={{ margin: 0 }}>
          As denúncias sobre riscos e condições de trabalho também alimentam o <strong>Programa de Gerenciamento de
          Riscos (PGR)</strong>: é uma das formas de a empresa ouvir a percepção dos trabalhadores sobre os riscos,
          como pede a NR-01.
        </p>
      </div>

      <div className="cartao">
        <h2>Quem recebe e o que acontece depois</h2>
        <p>
          As denúncias são lidas somente pela <strong>{empresa.comissao}</strong>. Cada membro entra com usuário e
          senha pessoais, e todo acesso fica registrado. Se alguém da comissão estiver envolvido, você pode marcá-lo
          no formulário e ele não terá acesso; os membros também se declaram impedidos quando há conflito de interesse.
        </p>
        <div className="tabela-rolagem">
          <table className="tabela">
            <thead><tr><th>Etapa</th><th>O que acontece</th><th>Prazo</th></tr></thead>
            <tbody>
              <tr><td>Recebimento</td><td>Você recebe protocolo e senha na hora.</td><td>Imediato</td></tr>
              <tr><td>Triagem</td><td>A comissão lê, classifica a gravidade e define quem apura.</td><td>até {prazos.triagem} dias · risco grave e violência: 24 horas</td></tr>
              <tr><td>Apuração</td><td>Ouve pessoas, verifica o local, pede informações a você pelo canal e adota medidas.</td><td>—</td></tr>
              <tr><td>Resposta</td><td>O resultado e as medidas aparecem no seu acompanhamento.</td><td>até {prazos.conclusao} dias · urgentes: {prazos.conclusaoUrgente} dias</td></tr>
            </tbody>
          </table>
        </div>
        <p className="fraco" style={{ margin: '10px 0 0' }}>Casos complexos podem ter o prazo prorrogado; a prorrogação fica registrada.</p>
      </div>

      <div className="cartao">
        <h2>Como o seu anonimato é protegido</h2>
        <ul>
          <li>Não pedimos nome, matrícula, CPF nem login. Identificar-se é opcional.</li>
          <li>O sistema <strong>não grava</strong> endereço IP, modelo do aparelho, navegador nem localização.</li>
          <li>Fotos anexadas têm os metadados apagados no seu aparelho, antes do envio (GPS, modelo do celular, data, nome do arquivo).</li>
          <li>A senha de acompanhamento é gerada na hora e só o “resumo” dela é guardado: ninguém — nem a comissão — consegue lê-la.</li>
          <li>O relato original não pode ser alterado por ninguém depois de enviado.</li>
          <li>A comissão recebe um aviso por e-mail de que chegou uma denúncia — sem o relato e sem nada que identifique você. Para ler, só pelo painel, com login.</li>
          <li>O site não usa cookies, rastreadores, anúncios nem fontes ou scripts de outras empresas.</li>
        </ul>
        <h3>O que o sistema não consegue garantir sozinho</h3>
        <ul style={{ marginBottom: 0 }}>
          <li>Os provedores de hospedagem e banco de dados mantêm, por poucos dias, registros técnicos de acesso que incluem IP. Eles não ficam ligados à denúncia e não são consultados pela comissão.</li>
          <li>A rede Wi-Fi da empresa pode registrar os sites visitados. Para mais segurança, use o 4G do seu celular pessoal.</li>
          <li>O conteúdo do relato pode revelar quem escreveu. Conte o essencial; a comissão pode perguntar mais pelo canal.</li>
        </ul>
      </div>

      <div className="cartao">
        <h2>Boa-fé e não retaliação</h2>
        <p>
          É proibida qualquer forma de retaliação contra quem denuncia de boa-fé ou colabora com a apuração —
          demissão, transferência, mudança de escala, perseguição ou exposição. Retaliação é, ela mesma, motivo de
          denúncia e de sanção.
        </p>
        <p style={{ margin: 0 }}>
          Denunciar de boa-fé é relatar o que você acredita ser verdade, mesmo que a apuração não confirme. O canal
          não deve ser usado para acusar alguém sabendo que a acusação é falsa.
        </p>
      </div>

      <div className="cartao">
        <h2>Tratamento dos seus dados (LGPD)</h2>
        <ul style={{ marginBottom: 0 }}>
          <li><strong>Finalidade:</strong> receber, apurar e responder denúncias e registrar as medidas adotadas.</li>
          <li><strong>Base legal:</strong> cumprimento de obrigação legal (Lei 13.709/2018, art. 7º, II, e art. 11, II, “a”), em especial a Lei 14.457/2022 e a NR-01.</li>
          <li><strong>Quem acessa:</strong> apenas os membros da {empresa.comissao}, com acesso individual e registrado.</li>
          <li><strong>Por quanto tempo:</strong> o relato completo é guardado por {empresa.retencaoAnos} anos após o encerramento. Depois disso o texto e a identificação são apagados e restam apenas números para estatística.</li>
          <li><strong>Relatórios:</strong> o que sai do canal para a CIPA e para o PGR são números agregados, sem relato e sem protocolo.</li>
        </ul>
      </div>

      <div className="cartao">
        <h2>Base legal do canal</h2>
        <ul style={{ marginBottom: 0 }}>
          <li>
            <strong>NR-01 (Portaria MTE 1.419/2024)</strong> — o gerenciamento de riscos ocupacionais deve abranger os
            fatores de risco psicossociais relacionados ao trabalho (itens 1.5.3.1.4 e 1.5.3.2.1); a organização deve
            ter mecanismos de consulta aos trabalhadores sobre a percepção de riscos (1.5.3.3), registrar as medidas
            de prevenção (1.5.5.3.1) e analisar acidentes e eventos perigosos considerando as informações prestadas
            pelos trabalhadores (1.5.5.5).
          </li>
          <li><strong>NR-01, item 1.4.3</strong> — direito de interromper a atividade diante de risco grave e iminente.</li>
          <li>
            <strong>Lei 14.457/2022, art. 23</strong> — empresas com CIPA devem ter procedimentos para receber e
            acompanhar denúncias, apurar os fatos e aplicar sanções, <strong>garantido o anonimato</strong> de quem
            denuncia, além de incluir o tema nas atividades da CIPA e capacitar os empregados ao menos a cada 12 meses.
          </li>
          <li><strong>Lei 13.709/2018 (LGPD)</strong> — tratamento dos dados pessoais.</li>
        </ul>
      </div>

      {empresa.contatoAlternativo && (
        <div className="cartao">
          <h2>Não consegue usar o site?</h2>
          <p style={{ margin: 0 }}>{empresa.contatoAlternativo}</p>
        </div>
      )}

      <div className="botoes" style={{ marginTop: 24 }}>
        {base && <Link to={`${base}/denunciar`} className="btn btn-primario">Fazer uma denúncia</Link>}
        <Link to={`${base}/acompanhar`} className="btn btn-secundario">Acompanhar</Link>
      </div>
    </Pagina>
  )
}
