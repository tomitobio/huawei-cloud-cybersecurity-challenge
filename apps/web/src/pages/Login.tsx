import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Banner, Card } from '../components/ui';

export function LoginPage() {
  const { t } = useTranslation();
  const { login, setUser } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('login.invalid'));
    } finally {
      setBusy(false);
    }
  }

  async function demo() {
    const creds = { email: 'admin@admin.com', password: 'adminSOY4592' };
    setBusy(true);
    setError(null);
    try {
      const data = await api.post<{ user: NonNullable<ReturnType<typeof useAuth>['user']> }>('/auth/login', creds);
      setUser(data.user);
      navigate('/');
    } catch {
      setError(t('login.invalid'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto mt-8 max-w-md">
      <Card>
        <h1 className="text-lg font-semibold text-white">{t('login.title')}</h1>
        <p className="mt-1 text-sm text-slate-400">{t('login.subtitle')}</p>
        <form className="mt-5 space-y-4" onSubmit={submit}>
          <div>
            <label className="label">{t('login.email')}</label>
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div>
            <label className="label">{t('login.password')}</label>
            <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          {error && <Banner kind="error">{error}</Banner>}
          <button className="btn-primary w-full" disabled={busy}>
            {t('login.signIn')}
          </button>
        </form>
        <div className="mt-6 border-t border-base-700 pt-4">
          <p className="mb-2 text-xs uppercase tracking-wide text-slate-500">{t('login.demo')}</p>
          <div className="flex gap-2">
            <button className="btn-ghost flex-1 text-xs" onClick={() => void demo()} disabled={busy}>
              {t('login.demoAdmin')}
            </button>
          </div>
        </div>
      </Card>
      <p className="mt-4 text-center text-xs text-slate-500">
        <a href="/join" className="text-accent-cyan hover:underline">
          {t('join.haveAccount')} {t('nav.join')}
        </a>
      </p>
    </div>
  );
}
