import { useEffect, useState, type ReactNode } from 'react';

export function cn(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('card card-pad', className)}>{children}</div>;
}

export function SectionTitle({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
}) {
  return (
    <div className="mb-3 flex items-start justify-between gap-3">
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-300">{title}</h2>
        {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}

const statusColors: Record<string, string> = {
  LOBBY: 'border-slate-500/40 bg-slate-500/10 text-slate-300',
  ACTIVE: 'border-accent-emerald/40 bg-accent-emerald/10 text-accent-emerald',
  PAUSED: 'border-accent-amber/40 bg-accent-amber/10 text-accent-amber',
  ENDED: 'border-base-600 bg-base-800 text-slate-400',
};

export function StatusPill({ status }: { status: string }) {
  return (
    <span className={cn('chip font-medium', statusColors[status] ?? statusColors.ENDED)}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {status}
    </span>
  );
}

export function ControlChip({ control }: { control: string }) {
  return <span className="chip border-accent-cyan/30 bg-accent-cyan/10 text-accent-cyan">{control}</span>;
}

export function metricColor(value: number): string {
  if (value >= 75) return 'bg-accent-emerald';
  if (value >= 50) return 'bg-accent-cyan';
  if (value >= 30) return 'bg-accent-amber';
  return 'bg-accent';
}

export function MetricBar({ label, value, compact = false }: { label: string; value: number; compact?: boolean }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="text-slate-400">{label}</span>
        <span className="font-mono text-slate-200">{Math.round(value)}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-base-700">
        <div className={cn('h-full rounded-full transition-all', metricColor(value))} style={{ width: `${Math.max(2, value)}%` }} />
      </div>
      {!compact && null}
    </div>
  );
}

export function MetricCard({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <div className="card card-pad">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="stat mt-1">{value}</p>
      {sub && <p className="mt-1 text-xs text-slate-500">{sub}</p>}
    </div>
  );
}

export interface LeaderboardRow {
  teamId: string;
  name: string;
  color: string;
  score: number;
  budget?: number;
  status?: string;
  metrics?: Record<string, number> | null;
  fundedControls?: string[];
}

export function Leaderboard({ rows, highlightTeamId }: { rows: LeaderboardRow[]; highlightTeamId?: string }) {
  if (!rows.length) return <p className="text-sm text-slate-500">—</p>;
  return (
    <ol className="space-y-2">
      {rows.map((row, i) => (
        <li
          key={row.teamId}
          className={cn(
            'flex items-center gap-3 rounded-lg border px-3 py-2',
            row.teamId === highlightTeamId ? 'border-accent-cyan/50 bg-accent-cyan/5' : 'border-base-700 bg-base-800/60',
          )}
        >
          <span className="w-6 text-center font-mono text-sm text-slate-400">{i + 1}</span>
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: row.color }} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-slate-100">{row.name}</p>
            {row.metrics && (
              <div className="mt-1 flex flex-wrap gap-1">
                {Object.entries(row.metrics)
                  .slice(0, 3)
                  .map(([k, v]) => (
                    <span key={k} className="text-[10px] text-slate-500">
                      {k}: <span className="font-mono text-slate-400">{Math.round(v)}</span>
                    </span>
                  ))}
              </div>
            )}
          </div>
          <span className="font-mono text-base font-semibold text-white">{row.score.toFixed(1)}</span>
        </li>
      ))}
    </ol>
  );
}

export function Countdown({ deadlineAt, label }: { deadlineAt: string | null; label: string }) {
  const [remaining, setRemaining] = useState<number>(() => calc(deadlineAt));
  useEffect(() => {
    setRemaining(calc(deadlineAt));
    const id = setInterval(() => setRemaining(calc(deadlineAt)), 500);
    return () => clearInterval(id);
  }, [deadlineAt]);

  if (!deadlineAt) return <span className="font-mono text-slate-500">--:--</span>;
  const expired = remaining <= 0;
  const mm = Math.floor(Math.abs(remaining) / 60);
  const ss = Math.abs(remaining) % 60;
  return (
    <span className={cn('font-mono text-lg font-semibold', expired ? 'text-accent' : 'text-slate-100')} title={label}>
      {expired ? '+' : ''}
      {String(mm).padStart(2, '0')}:{String(ss).padStart(2, '0')}
    </span>
  );
}

function calc(deadlineAt: string | null): number {
  if (!deadlineAt) return 0;
  return Math.floor((new Date(deadlineAt).getTime() - Date.now()) / 1000);
}

export function InsightCard({
  card,
}: {
  card: {
    displayName: string;
    domain: { es: string; en: string };
    businessProblem: { es: string; en: string };
    capabilities: { es: string; en: string }[];
    limitations: { es: string; en: string }[];
    dependencies: { es: string; en: string }[];
    deploymentContext: { es: string; en: string };
    docs: { label: string; url: string }[];
    demoFollowUp: { es: string; en: string };
  };
  lang?: 'es' | 'en';
}) {
  return (
    <div className="card card-pad space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-accent-cyan">{card.displayName}</h3>
      </div>
      <p className="text-xs text-slate-400">{card.businessProblem.es}</p>
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Capacidades</p>
        <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-slate-300">
          {card.capabilities.map((c, i) => (
            <li key={i}>{c.es}</li>
          ))}
        </ul>
      </div>
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Limitaciones</p>
        <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-slate-400">
          {card.limitations.map((c, i) => (
            <li key={i}>{c.es}</li>
          ))}
        </ul>
      </div>
      <div className="flex flex-wrap gap-2 pt-1">
        {card.docs.map((d) => (
          <a
            key={d.url}
            href={d.url}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-accent-cyan underline decoration-dotted hover:text-accent-cyan/80"
          >
            {d.label} ↗
          </a>
        ))}
      </div>
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-dashed border-base-600 p-6 text-center text-sm text-slate-500">
      {message}
    </div>
  );
}

export function Banner({ kind, children }: { kind: 'error' | 'info' | 'ok'; children: ReactNode }) {
  const styles =
    kind === 'error'
      ? 'border-accent/40 bg-accent/10 text-rose-200'
      : kind === 'ok'
        ? 'border-accent-emerald/40 bg-accent-emerald/10 text-emerald-200'
        : 'border-accent-cyan/30 bg-accent-cyan/10 text-cyan-100';
  return <div className={cn('rounded-lg border px-3 py-2 text-sm', styles)}>{children}</div>;
}
