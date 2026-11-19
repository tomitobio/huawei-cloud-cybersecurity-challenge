import type { Scenario } from '../types';
import { standardCards, STANDARD_DECK } from './cards';

/**
 * Scenario C — Protecting privileged access in healthcare.
 * Fictional organization "MediCare Plus". Deck-based, with ambiguous identity
 * signals (insider vs. stolen credential vs. legitimate access) and investigation.
 */
export const privilegedScenario: Scenario = {
  key: 'privileged-access-health',
  version: 2,
  name: {
    es: 'Escenario C — Protección del acceso privilegiado en salud',
    en: 'Scenario C — Protecting privileged access in healthcare',
  },
  summary: {
    es: 'Una red hospitalaria ficticia con datos de pacientes sensibles debe proteger cuentas administrativas y acceso remoto, cifrar información y demostrar trazabilidad. Debe distinguir abuso interno de credenciales robadas sin detener la atención.',
    en: 'A fictional hospital network holding sensitive patient data must protect administrative accounts and remote access, encrypt information and prove traceability. It must distinguish insider abuse from stolen credentials without stopping care.',
  },
  organization: {
    name: 'MediCare Plus',
    industry: { es: 'Salud y servicios hospitalarios', en: 'Healthcare & hospital services' },
    size: { es: 'Red regional — 4 hospitales, ~3.500 empleados', en: 'Regional network — 4 hospitals, ~3,500 employees' },
    description: {
      es: 'MediCare Plus opera varios hospitales y clínicas conectados. La disponibilidad de los sistemas clínicos es crítica y los datos de pacientes son altamente sensibles.',
      en: 'MediCare Plus runs several connected hospitals and clinics. Availability of clinical systems is critical and patient data is highly sensitive.',
    },
    objectives: [
      { es: 'Mantener la atención clínica sin interrupciones.', en: 'Keep clinical care running without interruption.' },
      { es: 'Proteger las cuentas administrativas y el acceso remoto.', en: 'Protect administrative accounts and remote access.' },
      { es: 'Garantizar la confidencialidad e integridad de los datos de pacientes.', en: 'Guarantee confidentiality and integrity of patient data.' },
      { es: 'Demostrar trazabilidad y cumplimiento ante auditorías.', en: 'Demonstrate traceability and compliance for audits.' },
    ],
    criticalAssets: [
      { name: { es: 'Historia clínica electrónica (HCE)', en: 'Electronic health records (EHR)' }, criticality: 'high', description: { es: 'Datos clínicos de pacientes.', en: 'Patient clinical data.' } },
      { name: { es: 'Sistemas clínicos (monitorización, farmacia)', en: 'Clinical systems (monitoring, pharmacy)' }, criticality: 'high', description: { es: 'Sistemas que sostienen la atención.', en: 'Systems that sustain care.' } },
      { name: { es: 'Cuentas administrativas y de dominio', en: 'Administrative & domain accounts' }, criticality: 'high', description: { es: 'Privilegios sobre toda la red.', en: 'Privileges across the whole network.' } },
      { name: { es: 'Bases de datos clínicas', en: 'Clinical databases' }, criticality: 'high', description: { es: 'Repositorios de datos sensibles.', en: 'Repositories of sensitive data.' } },
    ],
  },
  architecture: [
    { id: 'internet', label: { es: 'Usuarios y proveedores externos', en: 'Users & external vendors' }, zone: 'internet' },
    { id: 'cfw', label: { es: 'Firewall de red y segmentación', en: 'Network firewall & segmentation' }, zone: 'perimeter', control: 'CFW' },
    { id: 'cbh', label: { es: 'Bastión de acceso privilegiado', en: 'Privileged access bastion' }, zone: 'admin', control: 'CBH' },
    { id: 'hss', label: { es: 'Protección de host', en: 'Host protection' }, zone: 'internal', control: 'HSS' },
    { id: 'dew', label: { es: 'Cifrado y gestión de claves', en: 'Encryption & key management' }, zone: 'data', control: 'DEW' },
    { id: 'db', label: { es: 'Bases de datos clínicas', en: 'Clinical databases' }, zone: 'data' },
    { id: 'secmaster', label: { es: 'Operaciones y cumplimiento', en: 'Operations & compliance' }, zone: 'security', control: 'SecMaster' },
  ],
  start: { budget: 60, maturity: 'medium' },
  weights: {
    continuity: 0.22,
    riskReduction: 0.2,
    customerTrust: 0.14,
    governance: 0.16,
    responseQuality: 0.12,
    financial: 0.08,
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
      id: 'c1-investment',
      round: 1,
      phase: { es: 'Preparación', en: 'Preparation' },
      title: { es: 'Gobierno del acceso privilegiado', en: 'Governing privileged access' },
      narrative: {
        es: 'MediCare Plus afronta una auditoría de protección de datos. Debe decidir cómo controlar el acceso administrativo, el acceso remoto y la protección de los datos clínicos con presupuesto limitado.',
        en: 'MediCare Plus faces a data-protection audit. It must decide how to control administrative access, remote access and protection of clinical data on a limited budget.',
      },
      intel: [
        { es: 'Cada hospital tiene administradores locales con privilegios amplios.', en: 'Each hospital has local administrators with broad privileges.' },
        { es: 'Proveedores externos acceden por mantenimiento.', en: 'External vendors connect for maintenance.' },
      ],
      businessImpact: { es: 'La cobertura elegida condicionará los eventos siguientes y la auditoría.', en: 'The coverage chosen will shape later events and the audit.' },
      controlsInPlay: ['CBH', 'DEW', 'CFW', 'SecMaster'],
      focusTags: ['privileged', 'data', 'ops'],
      insightKey: 'cbh',
      next: 'c2-anomaly',
    },
    {
      id: 'c2-anomaly',
      round: 2,
      phase: { es: 'Incidente', en: 'Incident' },
      title: { es: 'Acceso administrativo fuera de horario', en: 'After-hours administrative access' },
      narrative: {
        es: 'Se detecta un inicio de sesión administrativo a las 3:00 desde una ubicación inusual. La cuenta tiene privilegios amplios. Podría ser un proveedor de soporte o credenciales comprometidas.',
        en: 'An administrative login at 3:00 a.m. from an unusual location is detected. The account has broad privileges. It could be a support vendor or compromised credentials.',
      },
      intel: [
        { es: 'La actividad coincide con una cuenta de soporte compartida.', en: 'The activity matches a shared support account.' },
        { es: 'No hay ticket de cambio asociado.', en: 'There is no associated change ticket.' },
      ],
      businessImpact: { es: 'Ignorarlo puede permitir un abuso de privilegios sostenido.', en: 'Ignoring it can allow sustained privilege abuse.' },
      controlsInPlay: ['CBH', 'HSS', 'SecMaster'],
      focusTags: ['privileged', 'identity', 'credential'],
      signals: [
        { id: 'sig-id', text: { es: 'Un proveedor reportó mantenimiento nocturno no planificado.', en: 'A vendor reported unplanned overnight maintenance.' }, truth: 'partial' },
        { id: 'sig-host', text: { es: 'El equipo de origen tiene un agente de seguridad desactualizado.', en: 'The source machine has an outdated security agent.' }, truth: 'false' },
      ],
      hypotheses: [
        { es: 'Credenciales comprometidas usadas por un atacante.', en: 'Compromised credentials used by an attacker.' },
        { es: 'Proveedor legítimo sin ticket.', en: 'Legitimate vendor without a ticket.' },
      ],
      insightKey: 'cbh',
      next: 'c3-credentials',
      instructorNotes: { es: 'La auditoría de sesiones de CBH resuelve la ambigüedad: quién, qué y cuándo.', en: 'CBH session auditing resolves the ambiguity: who, what and when.' },
    },
    {
      id: 'c3-credentials',
      round: 3,
      phase: { es: 'Escalada', en: 'Escalation' },
      title: { es: 'Credenciales compartidas y cuentas genéricas', en: 'Shared credentials and generic accounts' },
      narrative: {
        es: 'La revisión confirma que varias cuentas administrativas se comparten entre turnos y proveedores. Nadie puede atribuir con certeza las acciones a una persona, lo que debilita la auditoría.',
        en: 'The review confirms that several administrative accounts are shared across shifts and vendors. No one can reliably attribute actions to a person, which weakens the audit.',
      },
      intel: [
        { es: 'Contraseñas reutilizadas en varios sistemas.', en: 'Passwords reused across several systems.' },
        { es: 'La auditoría exige atribución por usuario.', en: 'The audit requires per-user attribution.' },
      ],
      businessImpact: { es: 'La falta de atribución debilita el cumplimiento y la respuesta.', en: 'Lack of attribution weakens compliance and response.' },
      controlsInPlay: ['CBH', 'SecMaster', 'DEW'],
      focusTags: ['privileged', 'identity', 'credential'],
      insightKey: 'cbh',
      next: 'c4-data',
    },
    {
      id: 'c4-data',
      round: 4,
      phase: { es: 'Impacto', en: 'Impact' },
      title: { es: 'Datos clínicos sensibles en riesgo', en: 'Sensitive clinical data at risk' },
      narrative: {
        es: 'Parte de los datos clínicos se almacena sin cifrado en reposo y las claves se gestionan manualmente. Un pico de acceso a datos podría ser exfiltración o un proceso de negocio.',
        en: 'Part of the clinical data is stored unencrypted at rest and keys are managed manually. A spike in data access could be exfiltration or a business process.',
      },
      intel: [
        { es: 'Bases de datos sin cifrado en reposo.', en: 'Databases without encryption at rest.' },
        { es: 'Claves y secretos guardados en lugares inadecuados.', en: 'Keys and secrets stored in inappropriate places.' },
      ],
      businessImpact: { es: 'Riesgo regulatorio directo y pérdida de confianza de pacientes.', en: 'Direct regulatory risk and loss of patient trust.' },
      controlsInPlay: ['DEW', 'SecMaster', 'HSS'],
      focusTags: ['data', 'encryption', 'recovery'],
      signals: [
        { id: 'sig-data', text: { es: 'El pico coincide con la generación nocturna de informes clínicos.', en: 'The spike coincides with nightly clinical reporting.' }, truth: 'false' },
        { id: 'sig-id', text: { es: 'Una cuenta de servicio accedió a tablas fuera de su alcance habitual.', en: 'A service account accessed tables outside its usual scope.' }, truth: 'true' },
      ],
      insightKey: 'dew',
      next: 'c5-insider',
    },
    {
      id: 'c5-insider',
      round: 5,
      phase: { es: 'Escalada', en: 'Escalation' },
      title: { es: 'Posible abuso interno de privilegios', en: 'Possible insider privilege abuse' },
      narrative: {
        es: 'Un usuario con acceso legítimo consultó un volumen inusual de historias clínicas ajenas a su servicio. No hay señales de malware: el uso es con credenciales válidas.',
        en: 'A user with legitimate access viewed an unusual volume of clinical records outside their department. There are no malware signs: the activity uses valid credentials.',
      },
      intel: [
        { es: 'El acceso es técnicamente válido, pero inapropiado.', en: 'The access is technically valid but inappropriate.' },
        { es: 'Los registros de auditoría son incompletos.', en: 'Audit records are incomplete.' },
      ],
      businessImpact: { es: 'El mal uso autorizado puede ser tan dañino como una intrusión.', en: 'Authorized misuse can be as harmful as an intrusion.' },
      controlsInPlay: ['CBH', 'SecMaster', 'DEW'],
      focusTags: ['identity', 'data', 'ops'],
      signals: [
        { id: 'sig-id', text: { es: 'El usuario tiene un rol clínico que podría justificar parte del acceso.', en: 'The user has a clinical role that could justify part of the access.' }, truth: 'partial' },
      ],
      insightKey: 'secmaster',
      next: 'c6-response',
    },
    {
      id: 'c6-response',
      round: 6,
      phase: { es: 'Respuesta', en: 'Response' },
      title: { es: 'Contención, restauración e informe de auditoría', en: 'Containment, restoration and audit report' },
      narrative: {
        es: 'Con el alcance identificado, MediCare Plus debe contener la amenaza, restaurar la confianza en sus sistemas clínicos y presentar un informe a la auditoría, sin interrumpir la atención.',
        en: 'With the scope identified, MediCare Plus must contain the threat, restore confidence in its clinical systems and submit an audit report, without interrupting care.',
      },
      intel: [
        { es: 'Cuentas y accesos comprometidos deben revocarse de forma controlada.', en: 'Compromised accounts and accesses must be revoked in a controlled way.' },
        { es: 'La evidencia debe preservarse para la auditoría.', en: 'Evidence must be preserved for the audit.' },
      ],
      businessImpact: { es: 'Una contención desordenada puede afectar la atención clínica y el cumplimiento.', en: 'Disorderly containment can affect clinical care and compliance.' },
      controlsInPlay: ['CBH', 'HSS', 'SecMaster'],
      focusTags: ['ops', 'recovery', 'governance'],
      insightKey: 'secmaster',
    },
  ],
  debrief: {
    learningObjectives: [
      { es: 'Comprender que CBH centraliza y audita el acceso privilegiado.', en: 'Understand that CBH centralizes and audits privileged access.' },
      { es: 'Distinguir cifrado, gestión de claves y control de acceso (DEW).', en: 'Distinguish encryption, key management and access control (DEW).' },
      { es: 'Reconocer que el abuso de credenciales válidas no se detiene solo con cifrado.', en: 'Recognize that abuse of valid credentials is not stopped by encryption alone.' },
      { es: 'Distinguir abuso interno de credenciales robadas investigando señales.', en: 'Distinguish insider abuse from stolen credentials by investigating signals.' },
      { es: 'Valorar la trazabilidad como parte del cumplimiento, no solo de la seguridad.', en: 'Value traceability as part of compliance, not only security.' },
    ],
    correctReasoning: [
      { es: 'Investigar el acceso anómalo antes de actuar a ciegas.', en: 'Investigate anomalous access before acting blindly.' },
      { es: 'Eliminar cuentas compartidas y habilitar atribución por usuario.', en: 'Remove shared accounts and enable per-user attribution.' },
      { es: 'Cifrar datos sensibles y gestionar claves de forma centralizada.', en: 'Encrypt sensitive data and manage keys centrally.' },
      { es: 'Contener de forma controlada preservando evidencia para la auditoría.', en: 'Contain in a controlled way while preserving evidence for the audit.' },
    ],
  },
};
