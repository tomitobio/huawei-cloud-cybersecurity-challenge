import type { Scenario } from '../types';
import { standardCards, STANDARD_DECK } from './cards';

/**
 * Scenario A — Ransomware and business continuity.
 * Fictional organization "NovaRetail". All telemetry, alerts and actors are
 * fictional and simulated. Deck-based, with ambiguous signals and investigation.
 */
export const ransomwareScenario: Scenario = {
  key: 'ransomware-retail',
  version: 2,
  name: {
    es: 'Escenario A — Ransomware y continuidad de negocio',
    en: 'Scenario A — Ransomware and business continuity',
  },
  summary: {
    es: 'Una empresa ficticia de retail sufre actividad sospechosa en hosts, interrupción de servicios y posible propagación de ransomware. Las señales son ambiguas: parte de la telemetría es ruido. Los equipos investigan, contienen y protegen la recuperación.',
    en: 'A fictional retail company experiences suspicious host activity, service disruption and possible ransomware propagation. Signals are ambiguous: some telemetry is noise. Teams investigate, contain and protect recovery.',
  },
  organization: {
    name: 'NovaRetail',
    industry: { es: 'Retail omnicanal / comercio electrónico', en: 'Omnichannel retail / e-commerce' },
    size: { es: 'Mediana empresa — ~1.200 empleados', en: 'Mid-size company — ~1,200 employees' },
    description: {
      es: 'NovaRetail opera una tienda online, una red de tiendas físicas y un centro logístico. Su negocio depende de la disponibilidad de su plataforma de pedidos y de la confianza de sus clientes.',
      en: 'NovaRetail runs an online store, a physical store network and a logistics hub. Its business depends on the availability of its ordering platform and on customer trust.',
    },
    objectives: [
      { es: 'Mantener la plataforma de pedidos disponible durante la campaña de ventas.', en: 'Keep the ordering platform available during the sales campaign.' },
      { es: 'Proteger los datos de clientes y la información financiera.', en: 'Protect customer data and financial information.' },
      { es: 'Distinguir señales reales de ruido antes de actuar.', en: 'Separate real signals from noise before acting.' },
      { es: 'Cumplir con las obligaciones de notificación y gobernanza de datos.', en: 'Meet data notification and governance obligations.' },
    ],
    criticalAssets: [
      { name: { es: 'Plataforma de pedidos (web pública)', en: 'Ordering platform (public web)' }, criticality: 'high', description: { es: 'Aplicación web pública que genera ingresos directos.', en: 'Public web application generating direct revenue.' } },
      { name: { es: 'Servidores de aplicación', en: 'Application servers' }, criticality: 'high', description: { es: 'Hosts que ejecutan la lógica de negocio y las integraciones.', en: 'Hosts running business logic and integrations.' } },
      { name: { es: 'Recurso compartido de archivos', en: 'Shared file resource' }, criticality: 'high', description: { es: 'Documentos financieros y de RR. HH., y datos operativos.', en: 'Finance and HR documents, and operational data.' } },
      { name: { es: 'Base de datos de clientes (PII)', en: 'Customer database (PII)' }, criticality: 'high', description: { es: 'Datos personales de clientes sujetos a obligaciones de protección.', en: 'Customer personal data subject to protection obligations.' } },
      { name: { es: 'Bóveda de copias de seguridad', en: 'Backup vault' }, criticality: 'medium', description: { es: 'Copias de recuperación de sistemas críticos.', en: 'Recovery copies of critical systems.' } },
    ],
  },
  architecture: [
    { id: 'internet', label: { es: 'Internet', en: 'Internet' }, zone: 'internet' },
    { id: 'waf', label: { es: 'Protección de aplicación web', en: 'Web application protection' }, zone: 'perimeter', control: 'WAF' },
    { id: 'cfw', label: { es: 'Firewall de red y segmentación', en: 'Network firewall & segmentation' }, zone: 'perimeter', control: 'CFW' },
    { id: 'app', label: { es: 'Servidores de aplicación', en: 'Application servers' }, zone: 'internal' },
    { id: 'hss', label: { es: 'Protección de host y carga de trabajo', en: 'Host & workload protection' }, zone: 'internal', control: 'HSS' },
    { id: 'fileshare', label: { es: 'Recurso compartido de archivos', en: 'Shared file resource' }, zone: 'internal' },
    { id: 'db', label: { es: 'Base de datos de clientes', en: 'Customer database' }, zone: 'data' },
    { id: 'dew', label: { es: 'Claves y secretos', en: 'Keys & secrets' }, zone: 'data', control: 'DEW' },
    { id: 'backup', label: { es: 'Bóveda de copias', en: 'Backup vault' }, zone: 'data' },
    { id: 'jump', label: { es: 'Acceso administrativo', en: 'Administrative access' }, zone: 'admin', control: 'CBH' },
    { id: 'secmaster', label: { es: 'Operaciones y respuesta', en: 'Operations & response' }, zone: 'security', control: 'SecMaster' },
  ],
  start: { budget: 60, maturity: 'medium' },
  weights: {
    continuity: 0.24,
    riskReduction: 0.2,
    customerTrust: 0.13,
    responseQuality: 0.15,
    financial: 0.1,
    governance: 0.1,
    efficiency: 0.08,
  },
  cards: standardCards(),
  deck: { ...STANDARD_DECK },
  economy: {
    incomePerRound: 20,
    focus: { costMultiplier: 1.4, scoreMultiplier: 1.6 },
    minPerFocusTag: 3,
  },
  events: [
    {
      id: 'e1-investment',
      round: 1,
      phase: { es: 'Preparación', en: 'Preparation' },
      title: { es: 'Distribución inicial de recursos', en: 'Initial resource allocation' },
      narrative: {
        es: 'Comienza la campaña de ventas. NovaRetail tiene un presupuesto limitado y debe decidir en qué priorizar antes de que aparezcan incidentes. Aún no hay señales claras: hay que prepararse con criterio.',
        en: 'The sales campaign begins. NovaRetail has a limited budget and must decide what to prioritize before incidents appear. There are no clear signals yet: prepare wisely.',
      },
      intel: [
        { es: 'Arquitectura actual: perímetro básico, hosts poco monitorizados y accesos administrativos compartidos.', en: 'Current architecture: basic perimeter, poorly monitored hosts and shared administrative access.' },
        { es: 'Presupuesto inicial: 60 créditos; cada ronda se suma financiamiento.', en: 'Starting budget: 60 credits; funding is added each round.' },
      ],
      businessImpact: { es: 'Lo que dejes sin cubrir condicionará los incidentes siguientes.', en: 'What you leave uncovered will shape later incidents.' },
      controlsInPlay: ['HSS', 'CFW', 'WAF', 'DEW', 'CBH', 'SecMaster'],
      focusTags: ['web', 'network', 'ops'],
      insightKey: 'waf',
      next: 'e2-host-alert',
      instructorNotes: { es: 'Ronda de preparación: observe si el equipo prioriza cobertura amplia o profundidad en un dominio.', en: 'Preparation round: note whether the team prioritizes breadth or depth.' },
    },
    {
      id: 'e2-host-alert',
      round: 2,
      phase: { es: 'Incidente', en: 'Incident' },
      title: { es: 'Actividad sospechosa en un servidor', en: 'Suspicious activity on a server' },
      narrative: {
        es: 'Operaciones reporta un proceso desconocido en APP-SRV-02 que consume CPU y abre conexiones salientes intermitentes. No está claro si es un compromiso real, una tarea administrativa olvidada o un fallo de software.',
        en: 'Operations reports an unknown process on APP-SRV-02 consuming CPU and opening intermittent outbound connections. It is unclear whether this is a real compromise, a forgotten admin task or a software bug.',
      },
      intel: [
        { es: 'Alerta de host: proceso no inventariado escribiendo en directorios del sistema.', en: 'Host alert: un-inventoried process writing to system directories.' },
        { es: 'Flujo de red: conexiones salientes periódicas hacia una IP externa desconocida.', en: 'Network flow: periodic outbound connections to an unknown external IP.' },
      ],
      businessImpact: { es: 'Si es real, podría propagarse al recurso compartido de archivos.', en: 'If real, it could spread to the shared file resource.' },
      controlsInPlay: ['HSS', 'CFW', 'SecMaster'],
      focusTags: ['host', 'ransomware', 'network'],
      signals: [
        { id: 'sig-host', text: { es: 'El proceso coincide con una herramienta de administración remota legítima, pero fuera de horario.', en: 'The process matches a legitimate remote-admin tool, but outside business hours.' }, truth: 'true' },
        { id: 'sig-net', text: { es: 'Las conexiones salientes coinciden con la ventana de copias de seguridad.', en: 'The outbound connections coincide with the backup window.' }, truth: 'false' },
      ],
      hypotheses: [
        { es: 'Compromiso activo con persistencia.', en: 'Active compromise with persistence.' },
        { es: 'Tarea administrativa legítima mal documentada.', en: 'Legitimate but poorly documented admin task.' },
        { es: 'Fallo de software benigno.', en: 'Benign software bug.' },
      ],
      insightKey: 'hss',
      next: 'e3-spread',
      instructorNotes: { es: 'Ambigüedad: una señal es real y otra es ruido. Investigar con host/red reduce la incertidumbre.', en: 'Ambiguity: one signal is real, one is noise. Host/network investigation reduces uncertainty.' },
    },
    {
      id: 'e3-spread',
      round: 3,
      phase: { es: 'Escalada', en: 'Escalation' },
      title: { es: 'El cifrado empieza a extenderse', en: 'Encryption starts to spread' },
      narrative: {
        es: 'Aparecen notas de rescate en el recurso compartido y el cifrado intenta moverse lateralmente. La bóveda de copias parece intacta por ahora.',
        en: 'Ransom notes appear on the shared resource and encryption tries to move laterally. The backup vault appears intact for now.',
      },
      intel: [
        { es: 'Intentos de conexión entre segmentos internos.', en: 'Connection attempts between internal segments.' },
        { es: 'La bóveda de copias parece intacta.', en: 'The backup vault appears intact.' },
      ],
      businessImpact: { es: 'La plataforma de pedidos puede volverse inestable en minutos.', en: 'The ordering platform may become unstable within minutes.' },
      controlsInPlay: ['CFW', 'HSS', 'SecMaster'],
      focusTags: ['network', 'ransomware', 'host'],
      signals: [
        { id: 'sig-net', text: { es: 'El patrón de conexiones internas se parece a un escaneo periódico.', en: 'The internal connection pattern looks like a periodic scan.' }, truth: 'partial' },
      ],
      insightKey: 'cfw',
      next: 'e4-admin',
    },
    {
      id: 'e4-admin',
      round: 4,
      phase: { es: 'Escalada', en: 'Escalation' },
      title: { es: 'Acceso administrativo bajo sospecha', en: 'Administrative access under suspicion' },
      narrative: {
        es: 'Una sesión administrativa desde una ubicación inusual usa credenciales compartidas del equipo de operaciones. Podría ser un operador remoto legítimo o un atacante con credenciales robadas.',
        en: 'An administrative session from an unusual location uses shared operations credentials. It could be a legitimate remote operator or an attacker with stolen credentials.',
      },
      intel: [
        { es: 'Sesión administrativa a las 02:00 desde una IP no habitual.', en: 'Administrative session at 02:00 from an unusual IP.' },
        { es: 'Credenciales administrativas compartidas entre varios operadores.', en: 'Administrative credentials shared among several operators.' },
      ],
      businessImpact: { es: 'El atacante podría mantener el acceso incluso tras la contención.', en: 'The attacker could retain access even after containment.' },
      controlsInPlay: ['CBH', 'DEW', 'SecMaster'],
      focusTags: ['privileged', 'identity', 'credential'],
      signals: [
        { id: 'sig-id', text: { es: 'No hay ticket de cambio asociado a la sesión.', en: 'There is no change ticket linked to the session.' }, truth: 'true' },
      ],
      hypotheses: [
        { es: 'Credenciales robadas usadas por un atacante.', en: 'Stolen credentials used by an attacker.' },
        { es: 'Operador legítimo fuera de horario.', en: 'Legitimate off-hours operator.' },
      ],
      insightKey: 'cbh',
      next: 'e5-data',
    },
    {
      id: 'e5-data',
      round: 5,
      phase: { es: 'Impacto', en: 'Impact' },
      title: { es: 'Posible exfiltración y presión externa', en: 'Possible exfiltration and external pressure' },
      narrative: {
        es: 'Se detecta un volumen de salida anómalo desde la base de datos de clientes. Los atacantes amenazan con publicar datos y exigen un pago, pero parte del volumen podría ser un proceso de negocio.',
        en: 'An anomalous outbound volume from the customer database is detected. Attackers threaten to publish data and demand payment, but some volume could be a business process.',
      },
      intel: [
        { es: 'Volumen de salida anómalo desde la base de datos.', en: 'Anomalous outbound volume from the database.' },
        { es: 'Los atacantes fijan un plazo para el pago.', en: 'The attackers set a payment deadline.' },
      ],
      businessImpact: { es: 'Riesgo de exposición de PII, sanciones y pérdida de confianza.', en: 'Risk of PII exposure, penalties and loss of trust.' },
      controlsInPlay: ['DEW', 'SecMaster', 'HSS', 'CFW'],
      focusTags: ['data', 'recovery', 'encryption'],
      signals: [
        { id: 'sig-data', text: { es: 'El volumen coincide con un proceso nocturno de informes.', en: 'The volume coincides with a nightly reporting job.' }, truth: 'partial' },
      ],
      insightKey: 'dew',
      next: 'e6-recovery',
    },
    {
      id: 'e6-recovery',
      round: 6,
      phase: { es: 'Cierre', en: 'Closing' },
      title: { es: 'Recuperación, comunicación y lecciones', en: 'Recovery, communication and lessons' },
      narrative: {
        es: 'Con el incidente contenido, NovaRetail planifica la recuperación, endurece controles y comunica lo ocurrido a clientes, dirección y reguladores.',
        en: 'With the incident contained, NovaRetail plans recovery, hardens controls and communicates what happened to customers, leadership and regulators.',
      },
      intel: [
        { es: 'La campaña de ventas sigue en curso.', en: 'The sales campaign is still running.' },
        { es: 'Auditoría interna solicitará evidencias de las decisiones.', en: 'Internal audit will request evidence of the decisions.' },
      ],
      businessImpact: { es: 'La forma de recuperar y comunicar afecta continuidad, coste y confianza.', en: 'How you recover and communicate affects continuity, cost and trust.' },
      controlsInPlay: ['SecMaster', 'CBH', 'HSS'],
      focusTags: ['recovery', 'comms', 'governance'],
      insightKey: 'secmaster',
      instructorNotes: { es: 'Cierre: premie la recuperación verificada y la comunicación transparente por encima del pago.', en: 'Closing: reward verified recovery and transparent communication over payment.' },
    },
  ],
  debrief: {
    learningObjectives: [
      { es: 'Comprender el valor de la detección temprana en hosts y su relación con la contención de ransomware.', en: 'Understand the value of early host detection and its relationship with ransomware containment.' },
      { es: 'Reconocer que el control de red (CFW) es clave para frenar la propagación lateral, con coste de disponibilidad.', en: 'Recognize that network control (CFW) is key to stopping lateral spread, at a cost to availability.' },
      { es: 'Distinguir proteger datos (cifrado), gestionar claves/secretos y controlar accesos.', en: 'Distinguish protecting data (encryption), managing keys/secrets and controlling access.' },
      { es: 'Trabajar con información ambigua: investigar antes de actuar a ciegas.', en: 'Work with ambiguous information: investigate before acting blindly.' },
      { es: 'Priorizar por impacto de negocio, no por número de productos.', en: 'Prioritize by business impact, not by number of products.' },
    ],
    correctReasoning: [
      { es: 'Investigar con visibilidad de host antes de aislar mejora la respuesta y reduce la propagación.', en: 'Investigating with host visibility before isolating improves response and reduces spread.' },
      { es: 'Contener la red rápidamente acota el daño, aunque afecte temporalmente la disponibilidad.', en: 'Containing the network quickly limits damage, even if it temporarily affects availability.' },
      { es: 'Restaurar desde copias limpias y verificadas supera a pagar el rescate.', en: 'Restoring from clean, verified backups beats paying the ransom.' },
      { es: 'El acceso privilegiado mal gestionado permite la persistencia del atacante.', en: 'Poorly managed privileged access enables attacker persistence.' },
    ],
  },
};
