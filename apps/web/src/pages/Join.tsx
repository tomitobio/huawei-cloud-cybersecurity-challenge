import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Banner, Card } from '../components/ui';

interface JoinResult {
  user: { id: string; displayName: string; role: 'MEMBER' };
  team: { id: string; name: string };
  session: { id: string; name: string };
}

export function JoinPage() {
  const { t } = useTranslation();
  const { refresh } = useAuth();
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await api.post<JoinResult>('/join', { code: code.trim().toUpperCase(), displayName });
      localStorage.setItem('hcc_teamId', res.team.id);
      await refresh();
      navigate(`/team/${res.team.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('join.invalid'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto mt-8 max-w-md">
      <Card>
        <h1 className="text-lg font-semibold text-white">{t('join.title')}</h1>
        <p className="mt-1 text-sm text-slate-400">{t('join.subtitle')}</p>
        <form className="mt-5 space-y-4" onSubmit={submit}>
          <div>
            <label className="label">{t('join.code')}</label>
            <input
              className="input text-center font-mono text-lg tracking-[0.3em] uppercase"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="ABC12"
              required
            />
          </div>
          <div>
            <label className="label">{t('join.name')}</label>
            <input className="input" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
          </div>
          {error && <Banner kind="error">{error}</Banner>}
          <button className="btn-primary w-full" disabled={busy}>
            {t('join.submit')}
          </button>
        </form>
      </Card>
      <p className="mt-4 text-center text-xs text-slate-500">
        <a href="/login" className="text-accent-cyan hover:underline">
          {t('join.haveAccount')}
        </a>
      </p>
    </div>
  );
}
