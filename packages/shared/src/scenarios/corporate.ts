import type { Scenario } from '../types';
import { standardCards, STANDARD_DECK } from './cards';

/**
 * Scenario D — Corporate multi-sector group.
 * A generic holding company (several business units) facing a blended incident:
 * identity abuse, a spreading intrusion and data exposure. Deliberately
 * sector-agnostic so it works for any audience. Deck-based with ambiguous
 * signals across identity, network and data.
 */
export const corporateScenario: Scenario = {
  key: 'corporate-multisector',
  version: 1,
  name: {
    es: 'Escenario D — Grupo corporativo multisector',
    en: 'Scenario D — Corporate multi-sector group',
  },
  summary: {
    es: 'Un grupo empresarial ficticio con varias unidades de negocio sufre un incidente combinado: abuso de identidad, una intrusión que se propaga y posible exposición de datos. Las señales son ambiguas y los equipos deben investigar, contener y coordinar la respuesta sin detener la operación.',
    en: 'A fictional business group with several units suffers a blended incident: identity abuse, a spreading intrusion and possible data exposure. Signals are ambiguous and teams must investigate, contain and coordinate response without stopping operations.',
  },
  organization: {
    name: 'Meridian Group',
    industry: { es: 'Holding corporativo multisector', en: 'Multi-sector corporate holding' },
    size: { es: 'Grande — ~6.000 empleados en 4 unidades', en: 'Large — ~6,000 employees across 4 units' },
    description: {
      es: 'Meridian Group agrupa unidades de servicios, logística y distribución. Comparten identidad, red y datos centrales, por lo que un incidente en una unidad puede afectar a todas. La dirección prioriza continuidad y reputación.',
      en: 'Meridian Group combines services, logistics and distribution units. They share central identity, network and data, so an incident in one unit can affect all. Leadership prioritizes continuity and reputation.',
    },
    objectives: [
      { es: 'Mantener la operación de todas las unidades de negocio.', en: 'Keep every business unit operating.' },
      { es: 'Proteger identidades, datos corporativos y sistemas compartidos.', en: 'Protect identities, corporate data and shared systems.' },
      { es: 'Distinguir un incidente real de ruido operativo normal.', en: 'Distinguish a real incident from normal operational noise.' },
      { es: 'Coordinar una respuesta única entre unidades y dirección.', en: 'Coordinate a single response across units and leadership.' },
    ],
    criticalAssets: [
      { name: { es: 'Directorio e identidad corporativa', en: 'Corporate directory & identity' }, criticality: 'high', description: { es: 'Cuentas y permisos de todo el grupo.', en: 'Accounts and permissions across the group.' } },
      { name: { es: 'Red corporativa compartida', en: 'Shared corporate network' }, criticality: 'high', description: { es: 'Conecta las cuatro unidades.', en: 'Connects the four business units.' } },
      { name: { es: 'Plataformas de negocio (web/API)', en: 'Business platforms (web/API)' }, criticality: 'high', description: { es: 'Servicios digitales de cara a clientes.', en: 'Customer-facing digital services.' } },
      { name: { es: 'Almacén de datos corporativo', en: 'Corporate data warehouse' }, criticality: 'high', description: { es: 'Datos financieros y de clientes.', en: 'Financial and customer data.' } },
      { name: { es: 'Sistemas de soporte y correo', en: 'Support & email systems' }, criticality: 'medium', description: { es: 'Punto habitual de entrada de ataques.', en: 'Common attack entry point.' } },
    ],
  },
  architecture: [
    { id: 'internet', label: { es: 'Internet', en: 'Internet' }, zone: 'internet' },
    { id: 'waf', label: { es: 'Protección de aplicación web', en: 'Web application protection' }, zone: 'perimeter', control: 'WAF' },
    { id: 'cfw', label: { es: 'Firewall de red y segmentación', en: 'Network firewall & segmentation' }, zone: 'perimeter', control: 'CFW' },
    { id: 'hss', label: { es: 'Protección de host', en: 'Host protection' }, zone: 'internal', control: 'HSS' },
    { id: 'cbh', label: { es: 'Acceso privilegiado', en: 'Privileged access' }, zone: 'admin', control: 'CBH' },
    { id: 'dew', label: { es: 'Cifrado y claves', en: 'Encryption & keys' }, zone: 'data', control: 'DEW' },
    { id: 'db', label: { es: 'Almacén de datos', en: 'Data warehouse' }, zone: 'data' },
    { id: 'secmaster', label: { es: 'Operaciones de seguridad', en: 'Security operations' }, zone: 'security', control: 'SecMaster' },
  ],
  start: { budget: 60, maturity: 'medium' },
  weights: {
    continuity: 0.22,
    riskReduction: 0.2,
    customerTrust: 0.13,
    responseQuality: 0.15,
    financial: 0.1,
    governance: 0.12,
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
      id: 'd1-budget',
      round: 1,
      phase: { es: 'Preparación', en: 'Preparation' },
      title: { es: 'Prioridades del grupo', en: 'Group priorities' },
      narrative: {
        es: 'Meridian Group reparte un presupuesto limitado entre sus unidades. Antes de que aparezca un incidente, la dirección debe decidir si prioriza una cobertura amplia o profundizar en los dominios más críticos (identidad, red y datos).',
        en: 'Meridian Group splits a limited budget across its units. Before an incident appears, leadership must decide whether to prioritize broad coverage or go deep on the most critical domains (identity, network and data).',
      },
      intel: [
        { es: 'Cuatro unidades comparten identidad, red y datos.', en: 'Four units share identity, network and data.' },
        { es: 'Presupuesto inicial: 60 créditos; cada ronda se suma financiamiento.', en: 'Starting budget: 60 credits; funding is added each round.' },
      ],
      businessImpact: { es: 'La cobertura elegida condicionará la propagación del incidente.', en: 'Coverage choices will shape how far the incident spreads.' },
      controlsInPlay: ['WAF', 'CFW', 'HSS', 'CBH', 'DEW', 'SecMaster'],
      focusTags: ['identity', 'network', 'ops'],
      insightKey: 'secmaster',
      next: 'd2-phish',
    },
    {
      id: 'd2-phish',
      round: 2,
      phase: { es: 'Incidente', en: 'Incident' },
      title: { es: 'Correos sospechosos y un inicio de sesión raro', en: 'Suspicious emails and an odd login' },
      narrative: {
        es: 'Varios empleados reportan correos sospechosos. Horas después aparece un inicio de sesión con credenciales válidas desde un país donde el grupo no opera. Podría ser phishing exitoso o un viajero legítimo.',
        en: 'Several employees report suspicious emails. Hours later a login appears with valid credentials from a country where the group does not operate. It could be successful phishing or a legitimate traveller.',
      },
      intel: [
        { es: 'Correos con enlaces a una página de inicio de sesión casi idéntica.', en: 'Emails linking to a near-identical login page.' },
        { es: 'Inicio de sesión con MFA ausente en una cuenta de negocio.', en: 'Login without MFA on a business account.' },
      ],
      businessImpact: { es: 'Si la cuenta está comprometida, puede abrir acceso a sistemas compartidos.', en: 'If the account is compromised, it can open access to shared systems.' },
      controlsInPlay: ['CBH', 'HSS', 'SecMaster', 'CFW'],
      focusTags: ['identity', 'credential', 'privileged'],
      signals: [
        { id: 'sig-id', text: { es: 'La IP del inicio de sesión pertenece a un proveedor VPN corporativo.', en: 'The login IP belongs to a corporate VPN provider.' }, truth: 'partial' },
        { id: 'sig-host', text: { es: 'El equipo del empleado muestra un agente de seguridad desactualizado.', en: 'The employee machine shows an outdated security agent.' }, truth: 'false' },
      ],
      hypotheses: [
        { es: 'Phishing exitoso con credenciales robadas.', en: 'Successful phishing with stolen credentials.' },
        { es: 'Empleado legítimo conectando por VPN desde el extranjero.', en: 'Legitimate employee connecting via VPN from abroad.' },
      ],
      insightKey: 'cbh',
      next: 'd3-spread',
      instructorNotes: { es: 'Investigar identidad (quién y desde dónde) aclara la ambigüedad antes de revocar accesos.', en: 'Investigating identity (who and from where) clarifies the ambiguity before revoking access.' },
    },
    {
      id: 'd3-spread',
      round: 3,
      phase: { es: 'Escalada', en: 'Escalation' },
      title: { es: 'Movimiento entre unidades', en: 'Movement across units' },
      narrative: {
        es: 'Desde la cuenta comprometida se detectan intentos de conexión hacia otras unidades. El patrón se parece a reconocimiento interno, pero también podría ser una sincronización de negocio mal configurada.',
        en: 'From the compromised account, connection attempts to other units are detected. The pattern resembles internal reconnaissance, but could also be a misconfigured business sync.',
      },
      intel: [
        { es: 'Conexiones internas entre segmentos de distintas unidades.', en: 'Internal connections between segments of different units.' },
        { es: 'Un proceso de sincronización nocturno estaba previsto.', en: 'A nightly synchronization job was scheduled.' },
      ],
      businessImpact: { es: 'La propagación entre unidades multiplica el impacto.', en: 'Spread across units multiplies the impact.' },
      controlsInPlay: ['CFW', 'HSS', 'SecMaster'],
      focusTags: ['network', 'host', 'ransomware'],
      signals: [
        { id: 'sig-net', text: { es: 'El patrón de conexiones coincide con el proceso de sincronización.', en: 'The connection pattern matches the sync job.' }, truth: 'partial' },
        { id: 'sig-host', text: { es: 'Un servidor muestra un proceso de cifrado de archivos en curso.', en: 'A server shows an in-progress file-encryption process.' }, truth: 'true' },
      ],
      insightKey: 'cfw',
      next: 'd4-data',
    },
    {
      id: 'd4-data',
      round: 4,
      phase: { es: 'Impacto', en: 'Impact' },
      title: { es: 'Exposición de datos corporativos', en: 'Corporate data exposure' },
      narrative: {
        es: 'Se detecta un volumen de salida anómalo desde el almacén de datos hacia un destino externo. Parte del volumen podría ser un proceso de informes legítimo, pero parte apunta a exfiltración.',
        en: 'An anomalous outbound volume from the data warehouse to an external destination is detected. Some volume could be legitimate reporting, but some points to exfiltration.',
      },
      intel: [
        { es: 'Volumen de salida anómalo desde el almacén de datos.', en: 'Anomalous outbound volume from the data warehouse.' },
        { es: 'Los datos sensibles no están cifrados en reposo.', en: 'Sensitive data is not encrypted at rest.' },
      ],
      businessImpact: { es: 'Riesgo de fuga de datos financieros y de clientes, con impacto regulatorio.', en: 'Risk of financial and customer data leakage, with regulatory impact.' },
      controlsInPlay: ['DEW', 'CFW', 'SecMaster', 'HSS'],
      focusTags: ['data', 'encryption', 'recovery'],
      signals: [
        { id: 'sig-data', text: { es: 'El proceso de salida usa credenciales de una cuenta de servicio.', en: 'The outbound process uses service-account credentials.' }, truth: 'true' },
      ],
      insightKey: 'dew',
      next: 'd5-cred',
    },
    {
      id: 'd5-cred',
      round: 5,
      phase: { es: 'Escalada', en: 'Escalation' },
      title: { es: 'Credenciales y accesos heredados', en: 'Credentials and inherited access' },
      narrative: {
        es: 'La investigación revela cuentas de servicio con permisos excesivos y secretos almacenados en lugares inadecuados. Esto explicaría tanto la propagación como la exfiltración.',
        en: 'The investigation reveals service accounts with excessive permissions and secrets stored in inappropriate places. This would explain both the spread and the exfiltration.',
      },
      intel: [
        { es: 'Cuentas de servicio con permisos de administrador.', en: 'Service accounts with administrator permissions.' },
        { es: 'Secretos y claves dispersos sin rotación.', en: 'Scattered secrets and keys without rotation.' },
      ],
      businessImpact: { es: 'Sin corregir las identidades, la contención será temporal.', en: 'Without fixing identities, containment will be temporary.' },
      controlsInPlay: ['CBH', 'DEW', 'SecMaster'],
      focusTags: ['credential', 'privileged', 'identity'],
      insightKey: 'cbh',
      next: 'd6-response',
    },
    {
      id: 'd6-response',
      round: 6,
      phase: { es: 'Cierre', en: 'Closing' },
      title: { es: 'Contención, recuperación y lecciones', en: 'Containment, recovery and lessons' },
      narrative: {
        es: 'Con el alcance identificado, Meridian Group contiene la amenaza, recupera servicios de forma controlada y comunica lo ocurrido a clientes, dirección y reguladores.',
        en: 'With the scope identified, Meridian Group contains the threat, recovers services in a controlled way and communicates what happened to customers, leadership and regulators.',
      },
      intel: [
        { es: 'La recuperación debe hacerse sin reintroducir el acceso comprometido.', en: 'Recovery must avoid reintroducing the compromised access.' },
        { es: 'La dirección pedirá un informe de lecciones aprendidas.', en: 'Leadership will request a lessons-learned report.' },
      ],
      businessImpact: { es: 'La forma de recuperar y comunicar define el impacto final.', en: 'How you recover and communicate defines the final impact.' },
      controlsInPlay: ['SecMaster', 'CBH', 'HSS'],
      focusTags: ['recovery', 'comms', 'governance'],
      insightKey: 'secmaster',
    },
  ],
  debrief: {
    learningObjectives: [
      { es: 'Entender cómo el abuso de identidad habilita intrusiones en toda la organización.', en: 'Understand how identity abuse enables intrusions across the organization.' },
      { es: 'Reconocer que la segmentación de red limita la propagación entre unidades.', en: 'Recognize that network segmentation limits spread across units.' },
      { es: 'Distinguir cifrado de datos, gestión de claves y control de acceso.', en: 'Distinguish data encryption, key management and access control.' },
      { es: 'Investigar señales ambiguas antes de actuar.', en: 'Investigate ambiguous signals before acting.' },
      { es: 'Coordinar una respuesta transversal y comunicar con transparencia.', en: 'Coordinate a cross-cutting response and communicate transparently.' },
    ],
    correctReasoning: [
      { es: 'Investigar el inicio de sesión anómalo antes de revocar a ciegas.', en: 'Investigate the anomalous login before revoking blindly.' },
      { es: 'Segmentar y controlar la red contiene la propagación entre unidades.', en: 'Segmenting and controlling the network contains spread across units.' },
      { es: 'Cifrar datos y sanear identidades y secretos reduce el impacto real.', en: 'Encrypting data and cleaning up identities and secrets reduces real impact.' },
      { es: 'Una respuesta coordinada supera a acciones aisladas por unidad.', en: 'A coordinated response beats isolated per-unit actions.' },
    ],
  },
};
