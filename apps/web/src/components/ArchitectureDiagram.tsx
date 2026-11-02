import type { ArchitectureNode, ControlId } from '@hcc/shared';
import { cn } from './ui';
import { useLang } from '../lib/useLang';

const ZONES: { key: ArchitectureNode['zone']; label: string }[] = [
  { key: 'internet', label: 'Internet' },
  { key: 'perimeter', label: 'Perímetro / Red' },
  { key: 'internal', label: 'Interno / Workloads' },
  { key: 'data', label: 'Datos y claves' },
  { key: 'admin', label: 'Acceso privilegiado' },
  { key: 'security', label: 'Operaciones' },
];

/**
 * Conceptual security architecture. Shows the six Huawei Cloud controls in
 * context and highlights which ones the team has funded.
 */
export function ArchitectureDiagram({
  nodes,
  fundedControls = [],
  compact = false,
}: {
  nodes: ArchitectureNode[];
  fundedControls?: string[];
  compact?: boolean;
}) {
  const { lt } = useLang();
  const funded = new Set(fundedControls.map((c) => c.toUpperCase()));

  return (
    <div className={cn('grid gap-2', compact ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6')}>
      {ZONES.map((zone) => {
        const zoneNodes = nodes.filter((n) => n.zone === zone.key);
        if (!zoneNodes.length) return null;
        return (
          <div key={zone.key} className="rounded-lg border border-base-700 bg-base-900/60 p-2">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">{zone.label}</p>
            <div className="space-y-1.5">
              {zoneNodes.map((node) => {
                const isControl = Boolean(node.control);
                const isFunded = node.control ? funded.has(node.control.toUpperCase()) : false;
                return (
                  <div
                    key={node.id}
                    className={cn(
                      'rounded-md border px-2 py-1.5 text-[11px] leading-tight',
                      isControl
                        ? isFunded
                          ? 'border-accent-cyan/50 bg-accent-cyan/10 text-cyan-100'
                          : 'border-base-600 bg-base-800 text-slate-400'
                        : 'border-base-700 bg-base-850 text-slate-300',
                    )}
                  >
                    {node.control && (
                      <span className={cn('mr-1 font-mono font-semibold', isFunded ? 'text-accent-cyan' : 'text-slate-500')}>
                        {node.control}
                      </span>
                    )}
                    {lt(node.label)}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function ControlBadge({ control, funded }: { control: ControlId | string; funded?: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded px-1.5 py-0.5 font-mono text-[10px]',
        funded ? 'bg-accent-cyan/15 text-accent-cyan' : 'bg-base-700 text-slate-400',
      )}
    >
      {control}
    </span>
  );
}
