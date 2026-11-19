import type { Scenario } from '../types';
import { standardCards, STANDARD_DECK } from './cards';

/**
 * Scenario B — Public web application under pressure.
 * Fictional organization "TuriStay" (travel booking platform). Deck-based, with
 * ambiguous web signals (real attacks mixed with legit bots) and investigation.
 */
export const webAppScenario: Scenario = {
  key: 'webapp-travel',
  version: 2,
  name: {
    es: 'Escenario B — Aplicación web pública bajo presión',
    en: 'Scenario B — Public web application under pressure',
  },
  summary: {
    es: 'Una plataforma ficticia de reservas recibe solicitudes anómalas y presión por disponibilidad. No todo el tráfico es ataque: hay bots, clientes y ruido. Los equipos investigan, equilibran seguridad y disponibilidad y coordinan la respuesta.',
    en: 'A fictional booking platform faces anomalous requests and availability pressure. Not all traffic is attack: there are bots, customers and noise. Teams investigate, balance security and availability, and coordinate response.',
  },
  organization: {
    name: 'TuriStay',
    industry: { es: 'Viajes y reservas online', en: 'Travel & online booking' },
    size: { es: 'Mediana empresa — ~800 empleados', en: 'Mid-size company — ~800 employees' },
    description: {
      es: 'TuriStay opera una plataforma de reservas de alta disponibilidad. Su negocio depende del tráfico web continuo y de la confianza de los viajeros.',
      en: 'TuriStay runs a high-availability booking platform. Its business depends on continuous web traffic and traveller trust.',
    },
    objectives: [
      { es: 'Mantener la disponibilidad del sitio durante la temporada alta.', en: 'Keep the site available during peak season.' },
      { es: 'Proteger las cuentas y los datos de pago de los clientes.', en: 'Protect customer accounts and payment data.' },
      { es: 'Distinguir tráfico legítimo de tráfico malicioso sin bloquear clientes reales.', en: 'Separate legitimate from malicious traffic without blocking real customers.' },
      { es: 'Reducir el riesgo de explotación de la aplicación web.', en: 'Reduce the risk of web application exploitation.' },
    ],
    criticalAssets: [
      { name: { es: 'Aplicación de reservas (web pública)', en: 'Booking application (public web)' }, criticality: 'high', description: { es: 'Interfaz web principal de ingresos.', en: 'Main revenue web interface.' } },
      { name: { es: 'API de reservas', en: 'Booking API' }, criticality: 'high', description: { es: 'Backend consumido por web y móvil.', en: 'Backend consumed by web and mobile.' } },
      { name: { es: 'Base de datos de clientes', en: 'Customer database' }, criticality: 'high', description: { es: 'Cuentas, reservas y datos de pago.', en: 'Accounts, bookings and payment data.' } },
      { name: { es: 'Servidores de aplicación', en: 'Application servers' }, criticality: 'high', description: { es: 'Hosts que ejecutan la lógica de reservas.', en: 'Hosts running booking logic.' } },
    ],
  },
  architecture: [
    { id: 'internet', label: { es: 'Internet y clientes', en: 'Internet & customers' }, zone: 'internet' },
    { id: 'waf', label: { es: 'Protección de aplicación web', en: 'Web application protection' }, zone: 'perimeter', control: 'WAF' },
    { id: 'cfw', label: { es: 'Firewall de red y control de tráfico', en: 'Network firewall & traffic control' }, zone: 'perimeter', control: 'CFW' },
    { id: 'app', label: { es: 'Servidores de aplicación', en: 'Application servers' }, zone: 'internal' },
    { id: 'hss', label: { es: 'Protección de host', en: 'Host protection' }, zone: 'internal', control: 'HSS' },
    { id: 'db', label: { es: 'Base de datos de clientes', en: 'Customer database' }, zone: 'data' },
    { id: 'secmaster', label: { es: 'Operaciones y respuesta', en: 'Operations & response' }, zone: 'security', control: 'SecMaster' },
  ],
  start: { budget: 60, maturity: 'medium' },
  weights: {
    continuity: 0.24,
    riskReduction: 0.2,
    customerTrust: 0.15,
    responseQuality: 0.15,
    financial: 0.1,
    governance: 0.08,
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
      id: 'b1-investment',
      round: 1,
      phase: { es: 'Preparación', en: 'Preparation' },
      title: { es: 'Preparación de la temporada alta', en: 'Peak-season preparation' },
      narrative: {
        es: 'Comienza la temporada alta. TuriStay debe decidir cómo proteger su plataforma web con presupuesto limitado antes de que aumente el tráfico.',
        en: 'Peak season begins. TuriStay must decide how to protect its web platform on a limited budget before traffic grows.',
      },
      intel: [
        { es: 'La aplicación web es el principal punto de entrada de clientes.', en: 'The web application is the main customer entry point.' },
        { es: 'Presupuesto inicial: 60 créditos; cada ronda se suma financiamiento.', en: 'Starting budget: 60 credits; funding is added each round.' },
      ],
      businessImpact: { es: 'La cobertura elegida condicionará los eventos siguientes.', en: 'The coverage chosen will shape later events.' },
      controlsInPlay: ['WAF', 'CFW', 'HSS', 'SecMaster'],
      focusTags: ['web', 'network', 'ops'],
      insightKey: 'waf',
      next: 'b2-web-alert',
    },
    {
      id: 'b2-web-alert',
      round: 2,
      phase: { es: 'Incidente', en: 'Incident' },
      title: { es: 'Solicitudes web anómalas', en: 'Anomalous web requests' },
      narrative: {
        es: 'Aumentan las solicitudes anómalas: patrones de inyección, sondeos de rutas y tráfico automatizado desde múltiples orígenes. Parte del tráfico parece provenir de clientes reales y bots mezclados.',
        en: 'Anomalous requests increase: injection patterns, path probing and automated traffic from many origins. Some traffic looks like a mix of real customers and bots.',
      },
      intel: [
        { es: 'Patrones de ataque web detectados en el tráfico entrante.', en: 'Web attack patterns detected in inbound traffic.' },
        { es: 'Parte del tráfico parece legítimo y parte automatizado.', en: 'Some traffic looks legitimate and some automated.' },
      ],
      businessImpact: { es: 'Bloquear de más puede afectar a clientes legítimos; bloquear de menos deja pasar ataques.', en: 'Over-blocking can hurt real customers; under-blocking lets attacks through.' },
      controlsInPlay: ['WAF', 'CFW', 'SecMaster'],
      focusTags: ['web', 'web_tampering', 'network'],
      signals: [
        { id: 'sig-web', text: { es: 'Parte de las peticiones proviene de rangos de nube conocidos por scraping.', en: 'Some requests come from cloud ranges known for scraping.' }, truth: 'partial' },
        { id: 'sig-net', text: { es: 'El pico de peticiones coincide con una campaña de marketing.', en: 'The request spike coincides with a marketing campaign.' }, truth: 'false' },
      ],
      hypotheses: [
        { es: 'Ataque de inyección dirigido.', en: 'Targeted injection attack.' },
        { es: 'Scraping de precios con bots.', en: 'Price scraping with bots.' },
        { es: 'Pico legítimo por marketing.', en: 'Legitimate marketing spike.' },
      ],
      insightKey: 'waf',
      next: 'b3-exploit',
      instructorNotes: { es: 'Ajustar reglas (no bloquear a ciegas) es la respuesta madura. Investigar separa bots de clientes.', en: 'Tuning rules (not blind blocking) is the mature response. Investigation separates bots from customers.' },
    },
    {
      id: 'b3-exploit',
      round: 3,
      phase: { es: 'Escalada', en: 'Escalation' },
      title: { es: 'Intento de explotación de la aplicación', en: 'Application exploitation attempt' },
      narrative: {
        es: 'Un atacante intenta explotar un endpoint de la aplicación. Hay indicios de toma de control de cuentas y de acceso al backend, aunque parte de la evidencia podría ser un escáner interno.',
        en: 'An attacker attempts to exploit an application endpoint. There are signs of account takeover and backend access, though some evidence could be an internal scanner.',
      },
      intel: [
        { es: 'Solicitudes dirigidas a un endpoint vulnerable.', en: 'Requests targeting a vulnerable endpoint.' },
        { es: 'Posibles intentos de acceso al servidor de aplicación.', en: 'Possible access attempts against the application server.' },
      ],
      businessImpact: { es: 'Si tiene éxito, podría comprometer cuentas y datos de pago.', en: 'If successful, it could compromise accounts and payment data.' },
      controlsInPlay: ['WAF', 'HSS', 'CFW', 'SecMaster'],
      focusTags: ['web', 'web_tampering', 'host'],
      signals: [
        { id: 'sig-web', text: { es: 'El endpoint vulnerable ya estaba marcado para parchear en el próximo sprint.', en: 'The vulnerable endpoint was already scheduled to be patched next sprint.' }, truth: 'true' },
        { id: 'sig-host', text: { es: 'Aparecen ficheros nuevos en el servidor web fuera de un despliegue.', en: 'New files appear on the web server outside a deployment.' }, truth: 'true' },
      ],
      insightKey: 'hss',
      next: 'b4-load',
    },
    {
      id: 'b4-load',
      round: 4,
      phase: { es: 'Escalada', en: 'Escalation' },
      title: { es: 'Pico de tráfico y presión de disponibilidad', en: 'Traffic spike and availability pressure' },
      narrative: {
        es: 'Un pico masivo amenaza con saturar la plataforma en plena temporada. Parte del tráfico parece hostil; parte podría ser una prueba de carga o clientes legítimos.',
        en: 'A massive spike threatens to overwhelm the platform during peak season. Some traffic looks hostile; some could be a load test or legitimate customers.',
      },
      intel: [
        { es: 'Volumen anómalo concentrado en pocos minutos.', en: 'Anomalous volume concentrated in a few minutes.' },
        { es: 'El equipo de negocio exige no perder reservas.', en: 'The business team demands no lost bookings.' },
      ],
      businessImpact: { es: 'La caída del sitio tiene coste financiero y de reputación.', en: 'Site downtime has financial and reputational cost.' },
      controlsInPlay: ['CFW', 'SecMaster', 'WAF'],
      focusTags: ['network', 'web', 'recovery'],
      signals: [
        { id: 'sig-net', text: { es: 'El patrón de tráfico se parece a una prueba de carga programada.', en: 'The traffic pattern looks like a scheduled load test.' }, truth: 'false' },
      ],
      insightKey: 'cfw',
      next: 'b5-host-hunt',
    },
    {
      id: 'b5-host-hunt',
      round: 5,
      phase: { es: 'Escalada', en: 'Escalation' },
      title: { es: 'Indicadores a nivel de host', en: 'Host-level indicators' },
      narrative: {
        es: 'Si el atacante llegó al servidor, podría haber dejado acceso persistente. El servidor muestra actividad inusual en ficheros web, aunque podría ser una automatización de mantenimiento.',
        en: 'If the attacker reached the server, persistent access may exist. The server shows unusual activity in web files, though it could be a maintenance automation.',
      },
      intel: [
        { es: 'Ficheros modificados fuera de los despliegues habituales.', en: 'Files modified outside normal deployments.' },
        { es: 'Procesos que abren conexiones salientes inesperadas.', en: 'Processes opening unexpected outbound connections.' },
      ],
      businessImpact: { es: 'Un acceso persistente podría reactivar el incidente.', en: 'Persistent access could restart the incident.' },
      controlsInPlay: ['HSS', 'CFW', 'SecMaster'],
      focusTags: ['host', 'forensics', 'ransomware'],
      signals: [
        { id: 'sig-host', text: { es: 'Uno de los ficheros nuevos es un webshell conocido.', en: 'One of the new files is a known webshell.' }, truth: 'true' },
        { id: 'sig-net', text: { es: 'Las conexiones salientes van a un servicio de monitoreo legítimo.', en: 'The outbound connections go to a legitimate monitoring service.' }, truth: 'false' },
      ],
      insightKey: 'hss',
      next: 'b6-coord',
    },
    {
      id: 'b6-coord',
      round: 6,
      phase: { es: 'Recuperación', en: 'Recovery' },
      title: { es: 'Coordinación y comunicación de la respuesta', en: 'Response coordination and communication' },
      narrative: {
        es: 'El incidente generó alertas en varios controles. Coordinar la investigación y la respuesta, y comunicar con transparencia, es ahora tan importante como cada control por separado.',
        en: 'The incident generated alerts across several controls. Coordinating investigation and response, and communicating transparently, is now as important as each control alone.',
      },
      intel: [
        { es: 'Alertas de web, red y host sin correlacionar.', en: 'Uncorrelated web, network and host alerts.' },
        { es: 'Varios equipos (seguridad, TI, negocio) necesitan una vista común.', en: 'Multiple teams (security, IT, business) need a shared view.' },
      ],
      businessImpact: { es: 'La falta de coordinación retrasa la contención y la recuperación.', en: 'Lack of coordination delays containment and recovery.' },
      controlsInPlay: ['SecMaster', 'HSS', 'CFW', 'WAF'],
      focusTags: ['ops', 'comms', 'governance'],
      insightKey: 'secmaster',
    },
  ],
  debrief: {
    learningObjectives: [
      { es: 'Entender que WAF protege la capa web y requiere ajuste para evitar falsos positivos.', en: 'Understand that WAF protects the web layer and needs tuning to avoid false positives.' },
      { es: 'Equilibrar seguridad y disponibilidad al controlar tráfico (CFW).', en: 'Balance security and availability when controlling traffic (CFW).' },
      { es: 'Reconocer que la aplicación puede comprometerse a nivel de host (HSS).', en: 'Recognize that the application can be compromised at the host level (HSS).' },
      { es: 'Trabajar con señales ambiguas: no todo el tráfico es ataque.', en: 'Work with ambiguous signals: not all traffic is an attack.' },
      { es: 'Comprender que ninguna capa resuelve el problema por sí sola.', en: 'Understand that no single layer solves the problem alone.' },
    ],
    correctReasoning: [
      { es: 'Analizar y ajustar la protección web antes de bloquear en bloque.', en: 'Analyze and tune web protection before blocking wholesale.' },
      { es: 'Controlar el tráfico malicioso sin sacrificar clientes legítimos.', en: 'Control malicious traffic without sacrificing legitimate customers.' },
      { es: 'Investigar el host para detectar persistencia tras la explotación.', en: 'Investigate the host to detect persistence after exploitation.' },
      { es: 'Correlacionar alertas para priorizar por impacto de negocio.', en: 'Correlate alerts to prioritize by business impact.' },
    ],
  },
};
