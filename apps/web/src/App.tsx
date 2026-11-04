import { NavLink, Navigate, Route, Routes, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from './lib/auth';
import { currentLang, setLang } from './lib/i18n';
import { cn } from './components/ui';
import { LoginPage } from './pages/Login';
import { JoinPage } from './pages/Join';
import { SessionsPage } from './pages/InstructorSessions';
import { ScenarioEditorPage } from './pages/ScenarioEditor';
import { CardLibraryPage } from './pages/CardLibrary';
import { ConsolePage } from './pages/InstructorConsole';
import { PresentationPage } from './pages/Presentation';
import { TeamWorkspacePage } from './pages/TeamWorkspace';
import { AudiencePage } from './pages/Audience';
import { AdminPage } from './pages/Admin';

function LangToggle() {
  const { t } = useTranslation();
  const lang = currentLang();
  return (
    <div className="flex items-center gap-1" title={t('common.language')}>
      {(['es', 'en'] as const).map((l) => (
        <button
          key={l}
          onClick={() => setLang(l)}
          className={cn(
            'rounded px-2 py-0.5 text-xs font-medium uppercase',
            lang === l ? 'bg-base-700 text-white' : 'text-slate-500 hover:text-slate-300',
          )}
        >
          {l}
        </button>
      ))}
    </div>
  );
}

function Header() {
  const { user, logout } = useAuth();
  const { t } = useTranslation();
  const isStaff = user?.role === 'ADMIN' || user?.role === 'INSTRUCTOR';
  return (
    <header className="border-b border-base-700 bg-base-900/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3">
        <Link to="/" className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded bg-accent text-xs font-bold text-white">HC</span>
          <span className="hidden text-sm font-semibold text-slate-100 sm:block">
            Huawei Cloud <span className="text-accent">Cybersecurity Challenge</span>
          </span>
        </Link>
        <nav className="ml-4 hidden items-center gap-1 md:flex">
          {isStaff && (
            <NavLink to="/sessions" className={({ isActive }) => navCls(isActive)}>
              {t('nav.sessions')}
            </NavLink>
          )}
          {isStaff && (
            <NavLink to="/scenarios" className={({ isActive }) => navCls(isActive)}>
              {t('nav.scenarios')}
            </NavLink>
          )}
          {isStaff && (
            <NavLink to="/cards" className={({ isActive }) => navCls(isActive)}>
              {t('nav.cards')}
            </NavLink>
          )}
          {user?.role === 'ADMIN' && (
            <NavLink to="/admin" className={({ isActive }) => navCls(isActive)}>
              {t('nav.admin')}
            </NavLink>
          )}
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <LangToggle />
          {user ? (
            <div className="flex items-center gap-2">
              <span className="hidden text-xs text-slate-400 sm:block">
                {user.displayName} · <span className="text-slate-500">{user.role}</span>
              </span>
              <button onClick={() => void logout()} className="btn-ghost px-2.5 py-1 text-xs">
                {t('nav.logout')}
              </button>
            </div>
          ) : (
            <Link to="/login" className="btn-ghost px-2.5 py-1 text-xs">
              {t('login.signIn')}
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

function navCls(isActive: boolean) {
  return cn(
    'rounded-md px-3 py-1.5 text-sm font-medium',
    isActive ? 'bg-base-800 text-white' : 'text-slate-400 hover:text-slate-200',
  );
}

function RequireStaff({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuth();
  if (loading) return <Centered>Loading…</Centered>;
  if (!user || (user.role !== 'ADMIN' && user.role !== 'INSTRUCTOR')) return <Navigate to="/login" replace />;
  return children;
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="grid h-64 place-items-center text-slate-500">{children}</div>;
}

function Home() {
  const { user, loading } = useAuth();
  if (loading) return <Centered>Loading…</Centered>;
  if (user?.role === 'ADMIN' || user?.role === 'INSTRUCTOR') return <Navigate to="/sessions" replace />;
  const teamId = localStorage.getItem('hcc_teamId');
  if (user?.role === 'MEMBER' && teamId) return <Navigate to={`/team/${teamId}`} replace />;
  return <Navigate to="/join" replace />;
}

export function App() {
  return (
    <div className="min-h-full">
      <Header />
      <main className="mx-auto max-w-7xl px-4 py-6">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/join" element={<JoinPage />} />
          <Route
            path="/sessions"
            element={
              <RequireStaff>
                <SessionsPage />
              </RequireStaff>
            }
          />
          <Route
            path="/sessions/:id"
            element={
              <RequireStaff>
                <ConsolePage />
              </RequireStaff>
            }
          />
          <Route
            path="/scenarios"
            element={
              <RequireStaff>
                <ScenarioEditorPage />
              </RequireStaff>
            }
          />
          <Route
            path="/cards"
            element={
              <RequireStaff>
                <CardLibraryPage />
              </RequireStaff>
            }
          />
          <Route
            path="/sessions/:id/present"
            element={
              <RequireStaff>
                <PresentationPage />
              </RequireStaff>
            }
          />
          <Route
            path="/admin"
            element={
              <RequireStaff>
                <AdminPage />
              </RequireStaff>
            }
          />
          <Route path="/team/:teamId" element={<TeamWorkspacePage />} />
          <Route path="/audience/:token" element={<AudiencePage />} />
          <Route path="*" element={<Centered>404</Centered>} />
        </Routes>
      </main>
    </div>
  );
}
