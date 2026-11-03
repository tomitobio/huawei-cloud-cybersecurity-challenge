import type { ControlId, LocalizedText } from './types';

/**
 * Product capability catalog. All claims are deliberately conservative and
 * anchored to official Huawei Cloud documentation. Capabilities that depend on
 * edition, region or integration are labelled as such.
 *
 * Docs verified to resolve (HTTP 200) on 2026-10-28.
 */
export interface ProductCard {
  key: string;
  service: ControlId;
  displayName: string;
  domain: LocalizedText;
  businessProblem: LocalizedText;
  capabilities: LocalizedText[];
  deploymentContext: LocalizedText;
  limitations: LocalizedText[];
  dependencies: LocalizedText[];
  docs: { label: string; url: string }[];
  demoFollowUp: LocalizedText;
  /** Scenario events where this service is most relevant. */
  scenarioEvents: string[];
  regionalNotes?: LocalizedText;
}

export const PRODUCT_CATALOG: ProductCard[] = [
  {
    key: 'hss',
    service: 'HSS',
    displayName: 'HSS — Host Security Service',
    domain: { es: 'Protección de hosts y cargas de trabajo', en: 'Host & workload protection' },
    businessProblem: {
      es: 'Falta de visibilidad de activos, software sin parchear y procesos sospechosos en servidores que sostienen servicios críticos.',
      en: 'Poor asset visibility, unpatched software and suspicious processes on servers that run critical services.',
    },
    capabilities: [
      { es: 'Inventario de activos y visibilidad de hosts y cargas de trabajo.', en: 'Asset inventory and visibility of hosts and workloads.' },
      { es: 'Detección de software vulnerable y recomendaciones de remediación.', en: 'Detection of vulnerable software and remediation guidance.' },
      { es: 'Detección de malware, ransomware y procesos/ficheros sospechosos.', en: 'Malware, ransomware and suspicious process/file detection.' },
      { es: 'Revisión de líneas base de configuración y cobertura de protección.', en: 'Baseline configuration review and protection coverage.' },
      { es: 'Soporte a la investigación y aislamiento de una carga de trabajo comprometida.', en: 'Support for investigating and isolating a compromised workload.' },
    ],
    deploymentContext: {
      es: 'Se despliega sobre hosts cloud (ECS/BMS) y cargas de trabajo; su eficacia depende de la cobertura de agentes y de la configuración de políticas.',
      en: 'Deployed on cloud hosts (ECS/BMS) and workloads; effectiveness depends on agent coverage and policy configuration.',
    },
    limitations: [
      { es: 'No impide por sí solo todas las intrusiones ni sustituye backups, controles de red o respuestas de incidentes.', en: 'Does not by itself prevent every intrusion, nor replace backups, network controls or incident response.' },
      { es: 'Requiere cobertura de agentes y configuración adecuada para aportar telemetría útil.', en: 'Requires agent coverage and correct configuration to provide useful telemetry.' },
    ],
    dependencies: [
      { es: 'A menudo se combina con CFW (red) y SecMaster (correlación) para una respuesta coordinada.', en: 'Often combined with CFW (network) and SecMaster (correlation) for coordinated response.' },
    ],
    docs: [{ label: 'Huawei Cloud HSS documentation', url: 'https://support.huaweicloud.com/intl/en-us/hss2.0/index.html' }],
    demoFollowUp: {
      es: 'Demostrar el panel de activos y el flujo de investigación de una alerta de host en un entorno de demostración.',
      en: 'Demonstrate the asset dashboard and the host-alert investigation flow in a demonstration environment.',
    },
    scenarioEvents: ['e2-host-alert', 'e3-spread'],
  },
  {
    key: 'cfw',
    service: 'CFW',
    displayName: 'CFW — Cloud Firewall',
    domain: { es: 'Seguridad de red y control de tráfico', en: 'Network security & traffic control' },
    businessProblem: {
      es: 'Exposición entrante innecesaria, conectividad saliente arriesgada y comunicación excesiva entre segmentos de red.',
      en: 'Unnecessary inbound exposure, risky outbound connectivity and excessive east-west communication between segments.',
    },
    capabilities: [
      { es: 'Control de políticas de acceso entrante y saliente.', en: 'Inbound and outbound access control policies.' },
      { es: 'Segmentación y reducción de comunicación innecesaria entre segmentos.', en: 'Segmentation and reduction of unnecessary inter-segment communication.' },
      { es: 'Visibilidad y registro de flujos de red para investigar comunicaciones sospechosas.', en: 'Network flow visibility and logging to investigate suspicious communications.' },
    ],
    deploymentContext: {
      es: 'Protege perímetros y segmentos en la nube; el equilibrio entre restricción y disponibilidad del negocio debe gestionarse con cuidado.',
      en: 'Protects cloud perimeters and segments; the balance between restriction and business availability must be managed carefully.',
    },
    limitations: [
      { es: 'No sustituye a WAF, HSS, controles de identidad o seguridad de aplicaciones.', en: 'Not a replacement for WAF, HSS, identity controls or application security.' },
      { es: 'Reglas demasiado estrictas pueden afectar la disponibilidad del negocio.', en: 'Overly strict rules can affect business availability.' },
    ],
    dependencies: [{ es: 'Se apoya en una topología de red y etiquetado correctos para aplicar políticas precisas.', en: 'Relies on a correct network topology and tagging to apply precise policies.' }],
    docs: [{ label: 'Huawei Cloud CFW documentation', url: 'https://support.huaweicloud.com/intl/en-us/cfw/index.html' }],
    demoFollowUp: { es: 'Mostrar la vista de flujos y la creación de una política de bloqueo saliente.', en: 'Show the flow view and the creation of an outbound blocking policy.' },
    scenarioEvents: ['e2-host-alert', 'e3-spread', 'e4-admin'],
  },
  {
    key: 'waf',
    service: 'WAF',
    displayName: 'WAF — Web Application Firewall',
    domain: { es: 'Protección de aplicaciones web', en: 'Web application protection' },
    businessProblem: {
      es: 'Solicitudes HTTP/HTTPS maliciosas, intentos de explotación web y tráfico automatizado contra aplicaciones públicas.',
      en: 'Malicious HTTP/HTTPS requests, web exploitation attempts and automated traffic against public applications.',
    },
    capabilities: [
      { es: 'Inspección de tráfico web y protección frente a ataques web comunes.', en: 'Web traffic inspection and protection against common web attacks.' },
      { es: 'Reglas y modos de protección configurables, con ajuste ante falsos positivos.', en: 'Configurable protection rules and modes, tunable against false positives.' },
    ],
    deploymentContext: {
      es: 'Se sitúa delante de aplicaciones web soportadas; requiere configuración de modo y reglas según la aplicación.',
      en: 'Sits in front of supported web applications; requires mode and rule configuration per application.',
    },
    limitations: [
      { es: 'No es una solución universal para compromiso de host, toda denegación de servicio o toda forma de robo de datos.', en: 'Not a universal solution for host compromise, all denial-of-service situations or all forms of data theft.' },
      { es: 'Puede generar falsos positivos que afecten la disponibilidad si no se ajusta.', en: 'Can produce false positives that affect availability if not tuned.' },
    ],
    dependencies: [{ es: 'Complementa a CFW (red) y HSS (host) para una cobertura completa de aplicación.', en: 'Complementary to CFW (network) and HSS (host) for full application coverage.' }],
    docs: [{ label: 'Huawei Cloud WAF documentation', url: 'https://support.huaweicloud.com/intl/en-us/waf/index.html' }],
    demoFollowUp: { es: 'Mostrar eventos de ataque web y el ajuste de reglas en modo simulación.', en: 'Show web attack events and rule tuning in simulation mode.' },
    scenarioEvents: ['e1-investment'],
  },
  {
    key: 'dew',
    service: 'DEW',
    displayName: 'DEW — Data Encryption Workshop',
    domain: { es: 'Cifrado, gestión de claves y secretos', en: 'Encryption, key & secrets management' },
    businessProblem: {
      es: 'Datos sensibles mal protegidos, claves criptográficas mal gestionadas y secretos almacenados de forma insegura.',
      en: 'Poorly protected sensitive data, poorly managed cryptographic keys and insecurely stored secrets.',
    },
    capabilities: [
      { es: 'KMS: gestión del ciclo de vida de claves y rotación.', en: 'KMS: key lifecycle management and rotation.' },
      { es: 'CSMS (Cloud Secret Management Service): gestión centralizada de secretos.', en: 'CSMS (Cloud Secret Management Service): centralized secret management.' },
      { es: 'KPS (Key Pair Service) para gestión de pares de claves.', en: 'KPS (Key Pair Service) for key pair management.' },
      { es: 'Dedicated HSM para requisitos dedicados, según disponibilidad.', en: 'Dedicated HSM for dedicated requirements, subject to availability.' },
    ],
    deploymentContext: {
      es: 'Se integra con servicios de datos y aplicaciones; distinguir cifrado, gestión de claves, protección de credenciales y control de acceso.',
      en: 'Integrates with data services and applications; distinguish encryption, key management, credential protection and access control.',
    },
    limitations: [
      { es: 'El cifrado por sí solo no evita identidades comprometidas ni el uso indebido autorizado.', en: 'Encryption alone does not prevent compromised identities or authorized misuse.' },
      { es: 'Dedicated HSM y algunas funciones dependen de región y edición.', en: 'Dedicated HSM and some features depend on region and edition.' },
    ],
    dependencies: [{ es: 'El control de acceso a claves y secretos depende de la gestión de identidades y permisos.', en: 'Access control to keys and secrets depends on identity and permission management.' }],
    docs: [{ label: 'Huawei Cloud DEW documentation', url: 'https://support.huaweicloud.com/intl/en-us/dew/index.html' }],
    demoFollowUp: { es: 'Mostrar la creación de una clave KMS y el consumo de un secreto desde CSMS.', en: 'Show creating a KMS key and consuming a secret from CSMS.' },
    scenarioEvents: ['e1-investment', 'e5-data'],
    regionalNotes: { es: 'La disponibilidad de Dedicated HSM y algunos servicios DEW varía por región.', en: 'Dedicated HSM and some DEW services availability varies by region.' },
  },
  {
    key: 'cbh',
    service: 'CBH',
    displayName: 'CBH — Cloud Bastion Host',
    domain: { es: 'Acceso privilegiado y auditoría de operaciones', en: 'Privileged access & operations auditing' },
    businessProblem: {
      es: 'Privilegios administrativos excesivos, acceso remoto sin control, credenciales compartidas y falta de trazabilidad.',
      en: 'Excessive administrative privileges, uncontrolled remote access, shared credentials and missing accountability.',
    },
    capabilities: [
      { es: 'Punto de acceso controlado para la administración de servidores.', en: 'Controlled access point for server administration.' },
      { es: 'Autorización basada en roles y revisión de políticas de acceso.', en: 'Role-based authorization and access policy review.' },
      { es: 'Auditoría y grabación de sesiones privilegiadas.', en: 'Auditing and recording of privileged sessions.' },
    ],
    deploymentContext: {
      es: 'Centraliza el acceso administrativo; mejora el gobierno y la trazabilidad de operaciones.',
      en: 'Centralizes administrative access; improves governance and traceability of operations.',
    },
    limitations: [
      { es: 'No evita automáticamente el abuso de toda credencial robada ni sustituye la protección de endpoints o de red.', en: 'Does not automatically prevent abuse of every stolen credential, nor replace endpoint or network protection.' },
    ],
    dependencies: [{ es: 'Se apoya en la gestión de identidades para definir roles y permisos.', en: 'Relies on identity management to define roles and permissions.' }],
    docs: [{ label: 'Huawei Cloud CBH documentation', url: 'https://support.huaweicloud.com/intl/en-us/cbh/index.html' }],
    demoFollowUp: { es: 'Mostrar la grabación y reproducción de una sesión administrativa auditada.', en: 'Show recording and replay of an audited administrative session.' },
    scenarioEvents: ['e4-admin', 'e6-recovery'],
  },
  {
    key: 'secmaster',
    service: 'SecMaster',
    displayName: 'SecMaster',
    domain: { es: 'Operaciones de seguridad y respuesta coordinada', en: 'Security operations & coordinated response' },
    businessProblem: {
      es: 'Múltiples alertas de distintos controles, sobrecarga del SOC, eventos relacionados que parecen aislados y escalada tardía.',
      en: 'Multiple alerts from different controls, SOC overload, related events that appear isolated and delayed escalation.',
    },
    capabilities: [
      { es: 'Correlación de alertas y eventos de seguridad.', en: 'Correlation of security alerts and events.' },
      { es: 'Priorización de incidentes según impacto de negocio.', en: 'Incident prioritization based on business impact.' },
      { es: 'Coordinación de respuesta y generación de una vista consolidada de seguridad.', en: 'Response coordination and a consolidated security overview.' },
    ],
    deploymentContext: {
      es: 'Consolida información de seguridad y coordina la operación; depende de integraciones y configuración.',
      en: 'Consolidates security information and coordinates operations; depends on integrations and configuration.',
    },
    limitations: [
      { es: 'No recibe automáticamente todos los eventos de todos los servicios sin integración o configuración.', en: 'Does not automatically receive every event from every service without integration or configuration.' },
    ],
    dependencies: [{ es: 'Su valor depende de que las fuentes (HSS, CFW, WAF, etc.) envíen datos y estén integradas.', en: 'Its value depends on sources (HSS, CFW, WAF, etc.) sending data and being integrated.' }],
    docs: [{ label: 'Huawei Cloud SecMaster documentation', url: 'https://support.huaweicloud.com/intl/en-us/secmaster/index.html' }],
    demoFollowUp: { es: 'Mostrar la vista de incidentes correlacionados y el flujo de respuesta.', en: 'Show the correlated incident view and the response workflow.' },
    scenarioEvents: ['e2-host-alert', 'e3-spread', 'e4-admin', 'e5-data'],
  },
];

export function getProductCard(key: string): ProductCard | undefined {
  return PRODUCT_CATALOG.find((c) => c.key === key || c.service === key);
}
