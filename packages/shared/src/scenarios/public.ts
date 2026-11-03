import type { Scenario } from '../types';
import { standardCards, STANDARD_DECK } from './cards';

/**
 * Scenario E — Public services (citizen-facing).
 * A fictional municipality facing attacks on citizen-facing digital services,
 * with strong availability and transparency constraints. Deck-based with
 * ambiguous traffic signals (attack vs. civic event vs. scan) and investigation.
 */
export const publicServicesScenario: Scenario = {
  key: 'public-services',
  version: 1,
  name: {
    es: 'Escenario E — Servicios públicos digitales',
    en: 'Scenario E — Digital public services',
  },
  summary: {
    es: 'Un municipio ficticio presta servicios digitales a la ciudadanía y sufre ataques contra portales y trámites. La disponibilidad y la confianza pública son críticas, y el tráfico anómalo puede ser un ataque o un pico de uso ciudadano. Los equipos investigan, protegen y comunican con transparencia.',
    en: 'A fictional municipality provides digital services to citizens and faces attacks on portals and procedures. Availability and public trust are critical, and anomalous traffic may be an attack or a citizen usage spike. Teams investigate, protect and communicate transparently.',
  },
  organization: {
    name: 'Ayuntamiento de Valleclaro',
    industry: { es: 'Administración pública / servicios ciudadanos', en: 'Public administration / citizen services' },
    size: { es: 'Municipio grande — ~2.000 empleados públicos', en: 'Large municipality — ~2,000 public employees' },
    description: {
      es: 'El Ayuntamiento de Valleclaro ofrece portales de trámites, pago de impuestos y servicios de emergencia. Un fallo afecta directamente a la ciudadanía y a la confianza en la institución.',
      en: 'Valleclaro City Council offers procedure portals, tax payment and emergency services. An outage directly affects citizens and trust in the institution.',
    },
    objectives: [
      { es: 'Mantener disponibles los servicios digitales críticos para la ciudadanía.', en: 'Keep critical digital services available to citizens.' },
      { es: 'Proteger los datos personales de la ciudadanía.', en: 'Protect citizens\' personal data.' },
      { es: 'Distinguir un ataque de un pico legítimo de uso.', en: 'Distinguish an attack from a legitimate usage spike.' },
      { es: 'Comunicar con transparencia y cumplir las obligaciones legales.', en: 'Communicate transparently and meet legal obligations.' },
    ],
    criticalAssets: [
      { name: { es: 'Portal de trámites ciudadanos', en: 'Citizen procedures portal' }, criticality: 'high', description: { es: 'Servicio web principal para la ciudadanía.', en: 'Main web service for citizens.' } },
      { name: { es: 'Plataforma de pago de impuestos', en: 'Tax payment platform' }, criticality: 'high', description: { es: 'Cobros y datos fiscales.', en: 'Payments and tax data.' } },
      { name: { es: 'Datos personales de la ciudadanía', en: 'Citizens\' personal data' }, criticality: 'high', description: { es: 'Información sujeta a protección legal.', en: 'Information subject to legal protection.' } },
      { name: { es: 'Servicios de emergencia', en: 'Emergency services' }, criticality: 'high', description: { es: 'Coordinación de emergencias y avisos.', en: 'Emergency coordination and alerts.' } },
      { name: { es: 'Infraestructura interna municipal', en: 'Municipal internal infrastructure' }, criticality: 'medium', description: { es: 'Sistemas de oficinas y back office.', en: 'Office and back-office systems.' } },
    ],
  },
  architecture: [
    { id: 'internet', label: { es: 'Internet y ciudadanía', en: 'Internet & citizens' }, zone: 'internet' },
    { id: 'waf', label: { es: 'Protección de aplicación web', en: 'Web application protection' }, zone: 'perimeter', control: 'WAF' },
    { id: 'cfw', label: { es: 'Firewall de red', en: 'Network firewall' }, zone: 'perimeter', control: 'CFW' },
    { id: 'app', label: { es: 'Servidores de portales', en: 'Portal servers' }, zone: 'internal' },
    { id: 'hss', label: { es: 'Protección de host', en: 'Host protection' }, zone: 'internal', control: 'HSS' },
    { id: 'db', label: { es: 'Datos de la ciudadanía', en: 'Citizen data' }, zone: 'data' },
    { id: 'dew', label: { es: 'Cifrado y claves', en: 'Encryption & keys' }, zone: 'data', control: 'DEW' },
    { id: 'secmaster', label: { es: 'Operaciones de seguridad', en: 'Security operations' }, zone: 'security', control: 'SecMaster' },
  ],
  start: { budget: 60, maturity: 'medium' },
  weights: {
    continuity: 0.26,
    riskReduction: 0.18,
    customerTrust: 0.16,
    responseQuality: 0.14,
    financial: 0.08,
    governance: 0.12,
    efficiency: 0.06,
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
      id: 'p1-budget',
      round: 1,
      phase: { es: 'Preparación', en: 'Preparation' },
      title: { es: 'Preparar los servicios de cara a la ciudadanía', en: 'Preparing citizen-facing services' },
      narrative: {
        es: 'El Ayuntamiento afronta una campaña de trámites con presupuesto limitado. La dirección debe decidir cómo proteger los portales y los datos de la ciudadanía antes de que aparezcan problemas.',
        en: 'The City Council faces a procedures campaign on a limited budget. Leadership must decide how to protect the portals and citizen data before problems appear.',
      },
      intel: [
        { es: 'Los portales son el principal canal de relación con la ciudadanía.', en: 'The portals are the main channel with citizens.' },
        { es: 'Presupuesto inicial: 60 créditos; cada ronda se suma financiamiento.', en: 'Starting budget: 60 credits; funding is added each round.' },
      ],
      businessImpact: { es: 'La cobertura condicionará la gravedad de los incidentes.', en: 'Coverage will shape the severity of incidents.' },
      controlsInPlay: ['WAF', 'CFW', 'HSS', 'DEW', 'SecMaster'],
      focusTags: ['web', 'data', 'ops'],
      insightKey: 'waf',
      next: 'p2-traffic',
    },
    {
      id: 'p2-traffic',
      round: 2,
      phase: { es: 'Incidente', en: 'Incident' },
      title: { es: 'Tráfico anómalo en el portal de trámites', en: 'Anomalous traffic on the procedures portal' },
      narrative: {
        es: 'El portal de trámites recibe un volumen inusual de solicitudes. Podría ser un ataque automatizado, un pico por la campaña de trámites o un escáner de una auditoría. La ciudadanía empieza a notar lentitud.',
        en: 'The procedures portal receives an unusual volume of requests. It could be an automated attack, a spike from the procedures campaign or an auditor\'s scanner. Citizens begin to notice slowness.',
      },
      intel: [
        { es: 'Patrones de solicitud anómalos contra un endpoint del portal.', en: 'Anomalous request patterns against a portal endpoint.' },
        { es: 'Coincide con el inicio de la campaña de trámites.', en: 'Coincides with the start of the procedures campaign.' },
      ],
      businessImpact: { es: 'La lentitud o caída afecta a la ciudadanía y a la reputación.', en: 'Slowness or outage affects citizens and reputation.' },
      controlsInPlay: ['WAF', 'CFW', 'SecMaster'],
      focusTags: ['web', 'web_tampering', 'network'],
      signals: [
        { id: 'sig-web', text: { es: 'Las peticiones provienen de muchos orígenes distintos y cambian de patrón.', en: 'Requests come from many different origins and change pattern.' }, truth: 'true' },
        { id: 'sig-net', text: { es: 'El pico coincide exactamente con el anuncio de la campaña.', en: 'The spike coincides exactly with the campaign announcement.' }, truth: 'partial' },
      ],
      hypotheses: [
        { es: 'Ataque automatizado contra el portal.', en: 'Automated attack against the portal.' },
        { es: 'Pico masivo de ciudadanía legítima.', en: 'Massive legitimate citizen spike.' },
        { es: 'Escáner de una auditoría de seguridad.', en: 'Security audit scanner.' },
      ],
      insightKey: 'waf',
      next: 'p3-tamper',
      instructorNotes: { es: 'Ajustar la protección web y observar antes de bloquear evita dejar fuera a ciudadanos reales.', en: 'Tuning web protection and observing before blocking avoids locking out real citizens.' },
    },
    {
      id: 'p3-tamper',
      round: 3,
      phase: { es: 'Escalada', en: 'Escalation' },
      title: { es: 'Posible manipulación de contenido web', en: 'Possible web content tampering' },
      narrative: {
        es: 'Aparecen indicios de manipulación en páginas del portal: contenido alterado y enlaces sospechosos. Podría ser un ataque de manipulación web o una actualización de contenido mal desplegada.',
        en: 'Signs of tampering appear on portal pages: altered content and suspicious links. It could be a web-tampering attack or a poorly deployed content update.',
      },
      intel: [
        { es: 'Contenido modificado fuera de la ventana de publicación.', en: 'Content modified outside the publishing window.' },
        { es: 'Enlaces añadidos que no están en el repositorio de contenido.', en: 'Added links that are not in the content repository.' },
      ],
      businessImpact: { es: 'La manipulación puede erosionar la confianza y difundir desinformación.', en: 'Tampering can erode trust and spread misinformation.' },
      controlsInPlay: ['WAF', 'HSS', 'SecMaster'],
      focusTags: ['web', 'web_tampering', 'host'],
      signals: [
        { id: 'sig-web', text: { es: 'Uno de los enlaces apunta a un dominio recién registrado.', en: 'One of the links points to a newly registered domain.' }, truth: 'true' },
        { id: 'sig-host', text: { es: 'El servidor muestra una tarea de sincronización de contenido reciente.', en: 'The server shows a recent content-sync task.' }, truth: 'false' },
      ],
      insightKey: 'waf',
      next: 'p4-data',
    },
    {
      id: 'p4-data',
      round: 4,
      phase: { es: 'Impacto', en: 'Impact' },
      title: { es: 'Datos de la ciudadanía en riesgo', en: 'Citizen data at risk' },
      narrative: {
        es: 'Se detecta un acceso inusual a datos personales desde un servicio interno. Parte del acceso podría deberse a un proceso legítimo de gestión, pero parte parece fuera de lo esperado.',
        en: 'Unusual access to personal data from an internal service is detected. Some access could be a legitimate management process, but some looks out of the ordinary.',
      },
      intel: [
        { es: 'Consultas a datos personales fuera del horario habitual.', en: 'Queries of personal data outside usual hours.' },
        { es: 'Datos sensibles almacenados sin cifrado en reposo.', en: 'Sensitive data stored without encryption at rest.' },
      ],
      businessImpact: { es: 'Riesgo de incumplimiento legal y pérdida de confianza pública.', en: 'Risk of legal non-compliance and loss of public trust.' },
      controlsInPlay: ['DEW', 'SecMaster', 'HSS'],
      focusTags: ['data', 'encryption', 'governance'],
      signals: [
        { id: 'sig-data', text: { es: 'El acceso lo realiza una cuenta de servicio usada por un proceso de gestión.', en: 'The access is made by a service account used by a management process.' }, truth: 'partial' },
      ],
      insightKey: 'dew',
      next: 'p5-host',
    },
    {
      id: 'p5-host',
      round: 5,
      phase: { es: 'Escalada', en: 'Escalation' },
      title: { es: 'Actividad en los servidores del portal', en: 'Activity on the portal servers' },
      narrative: {
        es: 'Los servidores del portal muestran procesos y ficheros inesperados. Podría tratarse de persistencia del atacante o de una herramienta de mantenimiento implantada por TI.',
        en: 'The portal servers show unexpected processes and files. It could be attacker persistence or a maintenance tool deployed by IT.',
      },
      intel: [
        { es: 'Ficheros nuevos en el servidor web fuera de un despliegue.', en: 'New files on the web server outside a deployment.' },
        { es: 'Un proceso abre conexiones salientes intermitentes.', en: 'A process opens intermittent outbound connections.' },
      ],
      businessImpact: { es: 'La persistencia permitiría reactivar el incidente más tarde.', en: 'Persistence would allow the incident to restart later.' },
      controlsInPlay: ['HSS', 'CFW', 'SecMaster'],
      focusTags: ['host', 'forensics', 'ransomware'],
      signals: [
        { id: 'sig-host', text: { es: 'Uno de los ficheros nuevos coincide con una firma de webshell.', en: 'One of the new files matches a webshell signature.' }, truth: 'true' },
        { id: 'sig-net', text: { es: 'Las conexiones salientes van a un servicio de actualizaciones conocido.', en: 'The outbound connections go to a known update service.' }, truth: 'false' },
      ],
      insightKey: 'hss',
      next: 'p6-comms',
    },
    {
      id: 'p6-comms',
      round: 6,
      phase: { es: 'Cierre', en: 'Closing' },
      title: { es: 'Recuperación y comunicación pública', en: 'Recovery and public communication' },
      narrative: {
        es: 'Con los servicios estabilizados, el Ayuntamiento debe restaurar la normalidad y comunicar a la ciudadanía con honestidad, además de cumplir las obligaciones legales de notificación.',
        en: 'With services stabilized, the City Council must restore normal operations and communicate honestly with citizens, as well as meet legal notification obligations.',
      },
      intel: [
        { es: 'La ciudadanía espera información clara y un plan de acción.', en: 'Citizens expect clear information and an action plan.' },
        { es: 'Deben preservarse evidencias para la auditoría.', en: 'Evidence must be preserved for audit.' },
      ],
      businessImpact: { es: 'La transparencia protege la confianza en la institución.', en: 'Transparency protects trust in the institution.' },
      controlsInPlay: ['SecMaster', 'CBH', 'HSS'],
      focusTags: ['comms', 'governance', 'recovery'],
      insightKey: 'secmaster',
    },
  ],
  debrief: {
    learningObjectives: [
      { es: 'Equilibrar disponibilidad ciudadana y seguridad web.', en: 'Balance citizen availability and web security.' },
      { es: 'Reconocer la protección contra manipulación web como defensa ante desinformación.', en: 'Recognize web-tampering protection as a defense against misinformation.' },
      { es: 'Proteger datos personales conforme a obligaciones legales.', en: 'Protect personal data in line with legal obligations.' },
      { es: 'Investigar si el tráfico es ataque o uso legítimo.', en: 'Investigate whether traffic is attack or legitimate use.' },
      { es: 'Comunicar con transparencia para preservar la confianza pública.', en: 'Communicate transparently to preserve public trust.' },
    ],
    correctReasoning: [
      { es: 'Observar y ajustar la protección web antes de bloquear en bloque.', en: 'Observe and tune web protection before blocking wholesale.' },
      { es: 'Verificar la manipulación de contenido e investigar el host.', en: 'Verify content tampering and investigate the host.' },
      { es: 'Cifrar los datos personales y controlar su acceso.', en: 'Encrypt personal data and control access to it.' },
      { es: 'Una comunicación honesta y un plan claro protegen la confianza pública.', en: 'Honest communication and a clear plan protect public trust.' },
    ],
  },
};
