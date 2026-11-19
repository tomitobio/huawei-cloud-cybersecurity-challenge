import type { Scenario } from '../types';
import { standardCards, STANDARD_DECK } from './cards';

/**
 * Scenario F — Industrial operations (manufacturing/OT).
 * A fictional manufacturer whose plant operations depend on interconnected IT/OT
 * systems. Security decisions carry direct physical/availability consequences.
 * Deck-based with ambiguous signals (maintenance job vs. intrusion) and
 * investigation. Safety and uptime dominate the scoring.
 */
export const industrialScenario: Scenario = {
  key: 'industrial-operations',
  version: 1,
  name: {
    es: 'Escenario F — Operaciones industriales',
    en: 'Scenario F — Industrial operations',
  },
  summary: {
    es: 'Una planta industrial ficticia depende de sistemas IT/OT interconectados. Un incidente amenaza la producción y la seguridad física. Las señales son ambiguas: parte de la actividad es mantenimiento legítimo. Los equipos investigan, contienen y recuperan la operación de forma segura.',
    en: 'A fictional industrial plant relies on interconnected IT/OT systems. An incident threatens production and physical safety. Signals are ambiguous: some activity is legitimate maintenance. Teams investigate, contain and safely recover operations.',
  },
  organization: {
    name: 'AceroDelta Manufacturing',
    industry: { es: 'Fabricación industrial / IT-OT', en: 'Industrial manufacturing / IT-OT' },
    size: { es: 'Planta grande — ~1.500 empleados y operadores', en: 'Large plant — ~1,500 employees and operators' },
    description: {
      es: 'AceroDelta opera una planta de producción continua. Los sistemas de control (OT) están conectados a la red corporativa (IT). Una parada no planificada tiene coste elevado y puede afectar a la seguridad física de los operarios.',
      en: 'AceroDelta runs a continuous-production plant. Control systems (OT) are connected to the corporate network (IT). Unplanned downtime is costly and can affect workers\' physical safety.',
    },
    objectives: [
      { es: 'Mantener la producción y la seguridad física de los operarios.', en: 'Maintain production and workers\' physical safety.' },
      { es: 'Proteger los sistemas de control (OT) de accesos indebidos.', en: 'Protect control systems (OT) from improper access.' },
      { es: 'Distinguir mantenimiento legítimo de una intrusión.', en: 'Distinguish legitimate maintenance from an intrusion.' },
      { es: 'Recuperar la operación de forma segura y controlada.', en: 'Recover operations safely and in a controlled way.' },
    ],
    criticalAssets: [
      { name: { es: 'Sistemas de control de planta (OT/SCADA)', en: 'Plant control systems (OT/SCADA)' }, criticality: 'high', description: { es: 'Controlan la producción física.', en: 'Control physical production.' } },
      { name: { es: 'Red que conecta IT y OT', en: 'Network linking IT and OT' }, criticality: 'high', description: { es: 'Frontera entre oficina y planta.', en: 'Boundary between office and plant.' } },
      { name: { es: 'Servidores de supervisión y mantenimiento', en: 'Supervision & maintenance servers' }, criticality: 'high', description: { es: 'Gestión de ingeniería y producción.', en: 'Engineering and production management.' } },
      { name: { es: 'Planes y datos de producción', en: 'Production plans & data' }, criticality: 'medium', description: { es: 'Propiedad intelectual y planificación.', en: 'Intellectual property and planning.' } },
      { name: { es: 'Copias de configuración de control', en: 'Control configuration backups' }, criticality: 'high', description: { es: 'Necesarias para recuperar la planta.', en: 'Needed to recover the plant.' } },
    ],
  },
  architecture: [
    { id: 'internet', label: { es: 'Internet / proveedores', en: 'Internet / vendors' }, zone: 'internet' },
    { id: 'cfw', label: { es: 'Firewall y segmentación IT/OT', en: 'Firewall & IT/OT segmentation' }, zone: 'perimeter', control: 'CFW' },
    { id: 'it', label: { es: 'Red corporativa (IT)', en: 'Corporate network (IT)' }, zone: 'internal' },
    { id: 'hss', label: { es: 'Protección de host', en: 'Host protection' }, zone: 'internal', control: 'HSS' },
    { id: 'ot', label: { es: 'Red de control (OT)', en: 'Control network (OT)' }, zone: 'internal' },
    { id: 'dewm', label: { es: 'Cifrado y claves', en: 'Encryption & keys' }, zone: 'data', control: 'DEW' },
    { id: 'backup', label: { es: 'Copias de configuración', en: 'Configuration backups' }, zone: 'data' },
    { id: 'secmaster', label: { es: 'Operaciones de seguridad', en: 'Security operations' }, zone: 'security', control: 'SecMaster' },
  ],
  start: { budget: 60, maturity: 'medium' },
  weights: {
    continuity: 0.28,
    riskReduction: 0.2,
    customerTrust: 0.08,
    responseQuality: 0.14,
    financial: 0.12,
    governance: 0.1,
    efficiency: 0.08,
  },
  cards: standardCards(),
  deck: { ...STANDARD_DECK },
  economy: {
    incomePerRound: 20,
    effortPerRound: 6,
    focus: { costMultiplier: 1.4, scoreMultiplier: 1.6 },
    minPerFocusTag: 3,
  },
  events: [
    {
      id: 'i1-budget',
      round: 1,
      phase: { es: 'Preparación', en: 'Preparation' },
      title: { es: 'Preparar la planta', en: 'Preparing the plant' },
      narrative: {
        es: 'AceroDelta inicia un trimestre de alta producción. La dirección debe decidir cómo invertir un presupuesto limitado para proteger la planta y la frontera IT/OT antes de que ocurra un incidente.',
        en: 'AceroDelta starts a high-production quarter. Leadership must decide how to invest a limited budget to protect the plant and the IT/OT boundary before an incident occurs.',
      },
      intel: [
        { es: 'IT y OT están conectados por varios puntos.', en: 'IT and OT are connected at several points.' },
        { es: 'Presupuesto inicial: 60 créditos; cada ronda se suma financiamiento.', en: 'Starting budget: 60 credits; funding is added each round.' },
      ],
      businessImpact: { es: 'La cobertura condicionará la continuidad de la producción.', en: 'Coverage will shape production continuity.' },
      controlsInPlay: ['CFW', 'HSS', 'DEW', 'SecMaster'],
      focusTags: ['network', 'host', 'ops'],
      insightKey: 'cfw',
      next: 'i2-anomaly',
    },
    {
      id: 'i2-anomaly',
      round: 2,
      phase: { es: 'Incidente', en: 'Incident' },
      title: { es: 'Actividad inusual en la red de planta', en: 'Unusual activity on the plant network' },
      narrative: {
        es: 'Se detectan conexiones desde la red corporativa hacia la red de control. Podría ser un proveedor de mantenimiento legítimo o un movimiento del atacante hacia OT. La producción sigue funcionando.',
        en: 'Connections from the corporate network toward the control network are detected. It could be a legitimate maintenance vendor or an attacker moving toward OT. Production is still running.',
      },
      intel: [
        { es: 'Conexiones IT→OT fuera de la ventana de mantenimiento.', en: 'IT→OT connections outside the maintenance window.' },
        { es: 'Un proveedor tenía acceso remoto programado.', en: 'A vendor had scheduled remote access.' },
      ],
      businessImpact: { es: 'Un acceso indebido a OT podría detener la producción o afectar la seguridad.', en: 'Improper OT access could halt production or affect safety.' },
      controlsInPlay: ['CFW', 'HSS', 'SecMaster'],
      focusTags: ['network', 'host', 'privileged'],
      signals: [
        { id: 'sig-net', text: { es: 'Las conexiones usan credenciales de un proveedor de mantenimiento.', en: 'The connections use credentials of a maintenance vendor.' }, truth: 'partial' },
        { id: 'sig-host', text: { es: 'Un servidor de supervisión muestra un proceso de cifrado de archivos.', en: 'A supervision server shows a file-encryption process.' }, truth: 'true' },
      ],
      hypotheses: [
        { es: 'Proveedor legítimo realizando mantenimiento.', en: 'Legitimate vendor performing maintenance.' },
        { es: 'Atacante moviéndose desde IT hacia OT.', en: 'Attacker moving from IT toward OT.' },
      ],
      insightKey: 'cfw',
      next: 'i3-ot',
      instructorNotes: { es: 'Investigar red/host antes de cortar evita detener la producción por un mantenimiento legítimo.', en: 'Investigating network/host before cutting avoids halting production for legitimate maintenance.' },
    },
    {
      id: 'i3-ot',
      round: 3,
      phase: { es: 'Escalada', en: 'Escalation' },
      title: { es: 'Anomalías en los sistemas de control', en: 'Anomalies in the control systems' },
      narrative: {
        es: 'Los sistemas de control muestran comandos inusuales y cambios de configuración. Podría ser un ajuste de ingeniería no documentado o un ataque dirigido a OT. La seguridad física de los operarios es la prioridad.',
        en: 'Control systems show unusual commands and configuration changes. It could be an undocumented engineering adjustment or an attack targeting OT. Workers\' physical safety is the priority.',
      },
      intel: [
        { es: 'Cambios de configuración fuera del control de cambios.', en: 'Configuration changes outside change control.' },
        { es: 'Los operarios reportan comportamientos extraños de equipos.', en: 'Operators report odd equipment behavior.' },
      ],
      businessImpact: { es: 'Una manipulación de OT puede causar paradas y riesgos físicos.', en: 'OT tampering can cause outages and physical risks.' },
      controlsInPlay: ['CFW', 'HSS', 'SecMaster'],
      focusTags: ['host', 'network', 'ransomware'],
      signals: [
        { id: 'sig-host', text: { es: 'Los cambios coinciden con una actualización de firmware planificada.', en: 'The changes match a planned firmware update.' }, truth: 'partial' },
        { id: 'sig-net', text: { es: 'Hay tráfico de mando no autorizado desde una estación de ingeniería.', en: 'There is unauthorized command traffic from an engineering station.' }, truth: 'true' },
      ],
      insightKey: 'hss',
      next: 'i4-continuity',
    },
    {
      id: 'i4-continuity',
      round: 4,
      phase: { es: 'Impacto', en: 'Impact' },
      title: { es: 'Riesgo de parada de producción', en: 'Risk of production stoppage' },
      narrative: {
        es: 'Contener la amenaza puede implicar aislar segmentos y detener parte de la producción. Hay que equilibrar el daño del incidente con el coste de una parada no planificada.',
        en: 'Containing the threat may involve isolating segments and halting part of production. You must balance incident damage against the cost of unplanned downtime.',
      },
      intel: [
        { es: 'Algunos segmentos pueden aislarse sin detener toda la planta.', en: 'Some segments can be isolated without stopping the whole plant.' },
        { es: 'La parada total tiene coste elevado y riesgo de reinicio.', en: 'Total stoppage is costly and carries restart risk.' },
      ],
      businessImpact: { es: 'La decisión afecta a continuidad, coste y seguridad física.', en: 'The decision affects continuity, cost and physical safety.' },
      controlsInPlay: ['CFW', 'HSS', 'SecMaster'],
      focusTags: ['network', 'recovery', 'ops'],
      insightKey: 'cfw',
      next: 'i5-identity',
    },
    {
      id: 'i5-identity',
      round: 5,
      phase: { es: 'Escalada', en: 'Escalation' },
      title: { es: 'Accesos de proveedores y credenciales', en: 'Vendor access and credentials' },
      narrative: {
        es: 'La investigación confirma que las credenciales de un proveedor se usaron de forma indebida y que hay cuentas compartidas con acceso a OT. Sin corregir esto, la contención será temporal.',
        en: 'The investigation confirms that a vendor\'s credentials were misused and that shared accounts have access to OT. Without fixing this, containment will be temporary.',
      },
      intel: [
        { es: 'Cuentas de proveedor compartidas y sin MFA.', en: 'Shared vendor accounts without MFA.' },
        { es: 'Acceso remoto permanente no revisado.', en: 'Permanent, unreviewed remote access.' },
      ],
      businessImpact: { es: 'El acceso persistente permite reactivar el incidente.', en: 'Persistent access allows the incident to restart.' },
      controlsInPlay: ['CBH', 'CFW', 'SecMaster'],
      focusTags: ['privileged', 'identity', 'credential'],
      insightKey: 'cbh',
      next: 'i6-recover',
    },
    {
      id: 'i6-recover',
      round: 6,
      phase: { es: 'Cierre', en: 'Closing' },
      title: { es: 'Recuperación segura de la operación', en: 'Safe recovery of operations' },
      narrative: {
        es: 'Con el alcance claro, AceroDelta debe restaurar la operación desde configuraciones limpias y verificadas, validar la seguridad de los sistemas de control y extraer lecciones para el futuro.',
        en: 'With the scope clear, AceroDelta must restore operations from clean, verified configurations, validate the safety of the control systems and draw lessons for the future.',
      },
      intel: [
        { es: 'Las copias de configuración deben verificarse antes de restaurar.', en: 'Configuration backups must be verified before restoring.' },
        { es: 'El reinicio de OT requiere validación de seguridad física.', en: 'OT restart requires physical-safety validation.' },
      ],
      businessImpact: { es: 'Una recuperación mal verificada podría reintroducir el incidente.', en: 'A poorly verified recovery could reintroduce the incident.' },
      controlsInPlay: ['SecMaster', 'HSS', 'CBH'],
      focusTags: ['recovery', 'governance', 'ops'],
      insightKey: 'secmaster',
    },
  ],
  debrief: {
    learningObjectives: [
      { es: 'Entender la convergencia IT/OT y su impacto en la producción.', en: 'Understand IT/OT convergence and its impact on production.' },
      { es: 'Reconocer que segmentar la red protege los sistemas de control.', en: 'Recognize that network segmentation protects control systems.' },
      { es: 'Equilibrar la contención con el coste y la seguridad de una parada.', en: 'Balance containment with the cost and safety of a stoppage.' },
      { es: 'Distinguir mantenimiento legítimo de una intrusión investigando señales.', en: 'Distinguish legitimate maintenance from an intrusion by investigating signals.' },
      { es: 'Recuperar la operación desde copias verificadas.', en: 'Recover operations from verified backups.' },
    ],
    correctReasoning: [
      { es: 'Investigar antes de cortar la conexión IT/OT evita parar la planta por mantenimiento legítimo.', en: 'Investigating before cutting the IT/OT link avoids halting the plant for legitimate maintenance.' },
      { es: 'Segmentar y aislar selectivamente limita el daño sin parar toda la producción.', en: 'Segmenting and selectively isolating limits damage without stopping all production.' },
      { es: 'Sanear el acceso de proveedores elimina la persistencia.', en: 'Cleaning up vendor access removes persistence.' },
      { es: 'Restaurar desde configuraciones verificadas evita reintroducir la amenaza.', en: 'Restoring from verified configurations avoids reintroducing the threat.' },
    ],
  },
};
