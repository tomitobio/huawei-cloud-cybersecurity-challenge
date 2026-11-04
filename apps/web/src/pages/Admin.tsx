import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useLang } from '../lib/useLang';
import { Card, EmptyState, SectionTitle } from '../components/ui';
import type { ScenarioSummary } from '../types';

interface UserRow {
  id: string;
  email: string;
  displayName: string;
  role: string;
}

export function AdminPage() {
  const { t } = useTranslation();
  const { lt } = useLang();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [scenarios, setScenarios] = useState<ScenarioSummary[]>([]);

  useEffect(() => {
    void (async () => {
      const [u, s] = await Promise.all([
        api.get<{ users: UserRow[] }>('/auth/users').catch(() => ({ users: [] as UserRow[] })),
        api.get<{ scenarios: ScenarioSummary[] }>('/scenarios'),
      ]);
      setUsers(u.users);
      setScenarios(s.scenarios);
    })();
  }, []);

  return (
    <div className="space-y-6">
      <SectionTitle
        title={t('nav.admin')}
        right={
          <Link to="/cards" className="btn-ghost px-3 py-1 text-xs">
            {t('cards.title')}
          </Link>
        }
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-300">Users</h3>
          {users.length === 0 ? (
            <EmptyState message="—" />
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="pb-2">Name</th>
                  <th className="pb-2">Email</th>
                  <th className="pb-2">Role</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-base-700">
                {users.map((u) => (
                  <tr key={u.id}>
                    <td className="py-2 text-slate-200">{u.displayName}</td>
                    <td className="py-2 text-slate-400">{u.email}</td>
                    <td className="py-2 text-slate-400">{u.role}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
        <Card>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-300">Scenarios</h3>
          <div className="space-y-3">
            {scenarios.map((s) => (
              <div key={s.key} className="rounded-lg border border-base-700 p-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-slate-100">{lt(s.name)}</p>
                  <span className="chip">{s.eventCount} eventos</span>
                </div>
                <p className="mt-1 text-xs text-slate-400">{lt(s.summary)}</p>
                <p className="mt-2 text-xs text-slate-500">
                  {s.organization} · budget {s.budget} · {s.valid ? '✔ valid' : '✗ invalid'}
                </p>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
