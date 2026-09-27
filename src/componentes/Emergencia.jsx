import { emergencias } from '../config'

/* Faixa de emergência. O canal não é plantão: quem está diante de um risco
   grave e iminente AGORA precisa parar e avisar, não esperar a triagem.
   NR-01 1.4.3 — o trabalhador pode interromper a atividade quando constatar
   risco grave e iminente, informando imediatamente o superior hierárquico. */
export default function Emergencia({ compacta = false }) {
  return (
    <div className="faixa-emergencia" role="note">
      <div style={{ flex: '1 1 320px' }}>
        <strong>Perigo agora?</strong>{' '}
        {compacta
          ? 'Este canal não é atendimento de emergência.'
          : 'Se existe risco grave e iminente, você tem o direito de interromper a atividade (NR-01, item 1.4.3). Pare, afaste-se e avise imediatamente o supervisor ou a segurança do trabalho. Este canal não substitui esse aviso.'}
      </div>
      <div className="numeros">
        {emergencias.map((e) => (
          <a key={e.numero} className="numero" href={`tel:${e.numero}`}>
            <b>{e.numero}</b> {e.nome}
          </a>
        ))}
      </div>
    </div>
  )
}
