import { useEffect, useState } from 'react';
import { BrowserRouter, Link, Navigate, NavLink, Outlet, Route, Routes, useLocation, useOutletContext, useParams } from 'react-router-dom';
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  Check,
  ClipboardList,
  Eye,
  EyeOff,
  LayoutDashboard,
  Lock,
  LogOut,
  Mail,
  Menu,
  RefreshCw,
  Settings2,
  ShieldCheck,
  Ticket,
  Users,
  WalletCards,
  X,
} from 'lucide-react';
import './App.css';

const API_BASE = import.meta.env.DEV
  ? (import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000').replace(/\/+$/, '')
  : '';
const ADMIN_ROLES = new Set(['admin', 'super_admin']);

const safeJson = async (response) => {
  try {
    return await response.json();
  } catch {
    return null;
  }
};

const formatCurrency = (value) => {
  if (typeof value === 'number') {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      maximumFractionDigits: 0,
    }).format(value);
  }

  return value || '₦0';
};

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-NG', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
};

const formatDateTime = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-NG', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

const normalizeRole = (value) => {
  if (!value) return 'User';
  return String(value)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
};

const getStatusTone = (status) => {
  if (!status) return 'neutral';
  const normalized = String(status).toLowerCase();
  if (['verified', 'success', 'successful', 'active', 'completed', 'approved', 'resolved'].includes(normalized)) return 'success';
  if (['pending', 'in_progress', 'processing', 'warning'].includes(normalized)) return 'warning';
  if (['suspended', 'blocked', 'rejected', 'failed', 'danger'].includes(normalized)) return 'danger';
  return 'neutral';
};

const BrandMark = ({ className = 'brand-mark' }) => (
  <img
    src="/brand/kalma-capital-logo.png"
    alt="Kalma Capital"
    className={className}
    loading="eager"
    decoding="async"
  />
);

const fetchAdminData = async (endpoint, { method = 'GET', body } = {}) => {
  const response = await fetch(`${API_BASE}/api/admin/${endpoint}`, {
    method,
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    cache: 'no-store',
  });

  if (response.status === 401) {
    throw new Error('Your session expired. Please sign in again.');
  }

  const payload = await safeJson(response);
  if (!response.ok) {
    throw new Error(payload?.message || 'Unable to load admin data.');
  }

  if (!payload) throw new Error('The server returned an invalid response.');
  return payload;
};

const loadCurrentAdminSession = async () => {
  try {
    const response = await fetch(`${API_BASE}/api/auth/me`, {
      credentials: 'include',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });

    if (response.status === 401) {
      return { user: null, error: '' };
    }

    if (!response.ok) {
      return { user: null, error: 'Unable to verify the admin session. Check the backend service.' };
    }

    const payload = await safeJson(response);
    if (!payload) {
      return { user: null, error: 'The backend returned an invalid session response.' };
    }
    const user = payload?.user;
    if (!user || !ADMIN_ROLES.has(user.role)) {
      return { user: null, error: '' };
    }

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      error: '',
    };
  } catch {
    return {
      user: null,
      error: 'Unable to reach the backend. Check the API URL and backend availability before signing in.',
    };
  }
};

function App() {
  const [session, setSession] = useState(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [sessionError, setSessionError] = useState('');

  useEffect(() => {
    let active = true;

    loadCurrentAdminSession().then((result) => {
      if (active) {
        setSession(result.user);
        setSessionError(result.error);
      }
    }).finally(() => {
      if (active) setCheckingSession(false);
    });

    return () => {
      active = false;
    };
  }, []);

  if (checkingSession) return <div className="state-box">Checking secure admin session…</div>;

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={session ? <Navigate to="/" replace /> : <LoginPage onLogin={setSession} sessionError={sessionError} />} />
        <Route
          path="/"
          element={session ? <AdminLayout session={session} onLogout={async () => {
            try {
              await fetch(`${API_BASE}/api/auth/logout`, {
                method: 'POST',
                credentials: 'include',
              });
            } catch {
              // ignore logout failures and clear the local admin session
            }
            setSession(null);
          }} /> : <Navigate to="/login" replace />}
        >
          <Route index element={<DashboardPage />} />
          <Route path="users" element={<UsersPage />} />
          <Route path="users/:userId" element={<UserDetailPage />} />
          <Route path="kyc" element={<KYCPage />} />
          <Route path="wallets" element={<WalletsPage />} />
          <Route path="transactions" element={<TransactionsPage />} />
          <Route path="support" element={<SupportPage />} />
          <Route path="activity" element={<ActivityPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
        <Route path="*" element={<Navigate to={session ? '/' : '/login'} replace />} />
      </Routes>
    </BrowserRouter>
  );
}

function LoginPage({ onLogin, sessionError }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setPending(true);

    try {
      const response = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });

      let payload = null;
      try {
        payload = await response.json();
      } catch {
        payload = null;
      }

      if (!response.ok || !payload?.user) {
        throw new Error(payload?.message || 'Unable to sign in to the admin dashboard.');
      }

      const user = payload.user;
      if (!ADMIN_ROLES.has(user.role)) {
        throw new Error('This account does not have admin access.');
      }

      const sessionResponse = await fetch(`${API_BASE}/api/auth/me`, {
        credentials: 'include',
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      });
      const sessionPayload = await safeJson(sessionResponse);
      if (!sessionResponse.ok || !ADMIN_ROLES.has(sessionPayload?.user?.role)) {
        throw new Error('Sign-in was accepted, but the secure session could not be saved. Please try again or use a browser that allows site cookies.');
      }

      onLogin({
        id: sessionPayload.user.id,
        name: sessionPayload.user.name,
        email: sessionPayload.user.email,
        role: sessionPayload.user.role,
      });
    } catch (loginError) {
      setError(loginError.message || 'Unable to sign in.');
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="login-screen">
      <div className="login-device">
        <div className="login-hero">
          <div className="hero-brand-row">
            <BrandMark className="brand-svg giant" />
          </div>

          <div className="section-divider" />
          <div className="hero-panel-title">SECURE OPERATIONS PORTAL</div>
        </div>

        <div className="login-card">
          <div className="login-shield">
            <ShieldCheck size={36} />
          </div>

          <p className="login-eyebrow">WELCOME BACK</p>
          <h1>Admin sign in</h1>
          <p className="login-subtitle">A secure workspace for managing Kalma Capital operations.</p>

          <form className="login-form" onSubmit={handleSubmit}>
            <label className="field-wrap">
              <span className="field-label">
                <Mail size={18} />
                <strong>Email</strong>
              </span>
              <div className="input-shell">
                <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Enter your email address" required />
              </div>
            </label>

            <label className="field-wrap">
              <span className="field-label">
                <Lock size={18} />
                <strong>Password</strong>
              </span>
              <div className="input-shell password-shell">
                <input type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" required />
                <button type="button" className="password-toggle" onClick={() => setShowPassword((value) => !value)} aria-label="Toggle password visibility">
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </label>

            {error ? <p className="error-banner">{error}</p> : null}
            {sessionError ? <p className="error-banner" role="alert">{sessionError}</p> : null}

            <button type="submit" className="primary-button login-submit" disabled={pending}>
              <ArrowRight size={20} />
              <span>{pending ? 'Signing in...' : 'Login'}</span>
            </button>
          </form>

          <div className="secure-row">
            <span className="secure-check"><Check size={14} /></span>
            <span>Protected staff access</span>
          </div>

          <div className="info-note">
            <span className="info-icon">i</span>
            <p>Use an admin account provisioned through the backend deployment. Passwords are never stored in this app.</p>
          </div>
        </div>

        <footer className="login-footer">
          <span>Kalma Capital</span>
          <span>Private operations workspace</span>
        </footer>
      </div>
    </div>
  );
}

function AdminLayout({ session, onLogout }) {
  const location = useLocation();
  const [sidebarState, setSidebarState] = useState({ pathname: location.pathname, open: false });
  const sidebarOpen = sidebarState.pathname === location.pathname && sidebarState.open;
  const closeSidebar = () => setSidebarState({ pathname: location.pathname, open: false });

  const navItems = [
    { to: '/', label: 'Overview', icon: LayoutDashboard },
    { to: '/users', label: 'Users', icon: Users },
    { to: '/kyc', label: 'KYC', icon: ShieldCheck },
    { to: '/wallets', label: 'Wallets', icon: WalletCards },
    { to: '/transactions', label: 'Transactions', icon: Activity },
    { to: '/support', label: 'Support', icon: Ticket },
    { to: '/activity', label: 'Activity log', icon: ClipboardList },
    { to: '/settings', label: 'Settings', icon: Settings2 },
  ];

  const currentTitle = location.pathname.startsWith('/users/')
    ? 'User profile'
    : navItems.find((item) => item.to === location.pathname)?.label || 'Overview';

  return (
    <div className="admin-app">
      <button
        type="button"
        className="mobile-toggle"
        onClick={() => setSidebarState({ pathname: location.pathname, open: !sidebarOpen })}
        aria-label={sidebarOpen ? 'Close navigation' : 'Open navigation'}
        aria-expanded={sidebarOpen}
      >
        {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
      </button>
      <div className={`sidebar-backdrop ${sidebarOpen ? 'visible' : ''}`} onClick={closeSidebar} aria-hidden="true" />

      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div>
          <div className="brand-block">
            <BrandMark className="sidebar-brand-logo" />
          </div>

          <p className="nav-caption">WORKSPACE</p>
          <nav className="nav">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                  onClick={closeSidebar}
                >
                  <span className="nav-icon"><Icon size={16} /></span>
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </nav>
        </div>

        <div className="sidebar-footer">
          <div className="user-pill">
            <span className="avatar">{session.name?.charAt(0) || 'A'}</span>
            <div>
              <strong>{session.name || 'Admin'}</strong>
              <small>{session.role}</small>
            </div>
          </div>
          <button type="button" className="logout-button" onClick={onLogout}>
            <LogOut size={16} />
            <span>Log out</span>
          </button>
        </div>
      </aside>

      <main className="main-panel">
        <header className="topbar">
          <div>
            <p className="eyebrow">Admin workspace</p>
            <h1>{currentTitle}</h1>
          </div>

          <div className="topbar-actions">
            <button type="button" className="secondary-button" onClick={() => window.location.reload()}>
              <RefreshCw size={16} />
              <span>Refresh</span>
            </button>
            <Link to="/settings" className="primary-button">
              <Settings2 size={16} />
              <span>Settings</span>
            </Link>
          </div>
        </header>

        <div className="content-area">
          <Outlet context={session} />
        </div>
      </main>
    </div>
  );
}

function DashboardPage() {
  const session = useOutletContext();
  const [data, setData] = useState({ summary: {}, transactions: [], supportTickets: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    fetchAdminData('overview')
      .then((payload) => {
        if (active) {
          setData(payload);
          setError('');
        }
      })
      .catch((fetchError) => {
        if (active) {
          setData({ summary: {}, transactions: [], supportTickets: [] });
          setError(fetchError.message || 'Unable to load dashboard data.');
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const kpis = [
    {
      label: 'Users',
      value: String(data.summary.totalUsers || 0),
      change: `${data.summary.activeUsers || 0} active`,
      tone: 'positive',
      icon: Users,
    },
    {
      label: 'Wallet balance',
      value: formatCurrency(data.summary.walletBalance || 0),
      change: 'Across all wallet accounts',
      tone: 'positive',
      icon: WalletCards,
    },
    {
      label: 'Pending KYC',
      value: String(data.summary.pendingKyc || 0),
      change: 'Needs review',
      tone: 'warning',
      icon: ShieldCheck,
    },
    {
      label: 'Open support',
      value: String(data.summary.openSupportTickets || 0),
      change: 'open or in progress',
      tone: 'neutral',
      icon: Ticket,
    },
  ];

  if (loading) {
    return <div className="state-box">Loading dashboard…</div>;
  }

  if (error) {
    return <div className="error-banner inline-error" role="alert">{error}</div>;
  }

  return (
    <>
      <section className="dashboard-welcome">
        <div>
          <span className="welcome-kicker">KALMA CAPITAL · OPERATIONS</span>
          <h2>Welcome back, {session?.name?.split(' ')[0] || 'Admin'}</h2>
          <p>Your operations overview is up to date. Here’s what needs your attention.</p>
        </div>
        <div className="welcome-actions">
          <Link to="/kyc" className="welcome-primary"><ShieldCheck size={16} /> Review KYC</Link>
          <Link to="/users" className="welcome-secondary"><Users size={16} /> User directory</Link>
        </div>
      </section>
      <section className="metrics-grid">
        {kpis.map((item) => {
          const Icon = item.icon;
          return (
            <article key={item.label} className="metric-card">
              <div className="metric-card-top">
                <span>{item.label}</span>
                <div className={`metric-icon ${item.tone}`}><Icon size={16} /></div>
              </div>
              <strong>{item.value}</strong>
              <em className={item.tone}>{item.change}</em>
            </article>
          );
        })}
      </section>

      <section className="panel-grid two-up">
        <div className="panel">
          <div className="panel-header">
            <h3>Recent transactions</h3>
            <Link to="/transactions" className="link-button">View all</Link>
          </div>
          <div className="table-wrap">
            <table>
            <thead>
              <tr>
                <th>Reference</th>
                <th>User</th>
                <th>Type</th>
                <th>Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {(data.transactions || []).map((row) => (
                <tr key={row.reference || row.id}>
                  <td>{row.reference || row.id}</td>
                  <td>{row.user}</td>
                  <td>{row.type}</td>
                  <td>{row.amount}</td>
                  <td><span className={`status-pill ${getStatusTone(row.status)}`}>{row.status}</span></td>
                </tr>
              ))}
            </tbody>
            </table>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <h3>Support queue</h3>
            <Link to="/support" className="link-button">Open inbox</Link>
          </div>
          <div className="stack-list">
            {(data.supportTickets || []).map((ticket) => (
              <div key={ticket.id} className="list-item">
                <div>
                  <strong>{ticket.customer}</strong>
                  <p>{ticket.subject}</p>
                </div>
                <span className={`priority-badge ${ticket.priority?.toLowerCase() || 'medium'}`}>{ticket.priority || 'Medium'}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

function UsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    let active = true;

    fetchAdminData('users')
      .then((payload) => {
        if (active) setUsers(payload.users || []);
      })
      .catch((fetchError) => {
        if (active) setError(fetchError.message || 'Unable to load users.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const overviewStats = [
    { label: 'Total users', value: users.length || 0 },
    { label: 'KYC verified', value: users.filter((user) => user.kycVerified).length },
    { label: 'Admins', value: users.filter((user) => user.role === 'admin' || user.role === 'super_admin').length },
  ];
  const visibleUsers = users.filter((user) => (
    `${user.name} ${user.email}`.toLowerCase().includes(search.trim().toLowerCase())
  ));

  if (loading) {
    return <div className="state-box">Loading users…</div>;
  }

  if (error) {
    return <div className="error-banner inline-error" role="alert">{error}</div>;
  }

  return (
    <div className="panel">
      <div className="panel-header">
        <div>
          <h3>User directory</h3>
          <p className="section-note">Live account records from the backend. Access changes are not enabled here.</p>
        </div>
      </div>

      <div className="summary-strip">
        {overviewStats.map((item) => (
          <div key={item.label} className="summary-pill">
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </div>
        ))}
      </div>

      <label className="search-field">
        <span>Search users</span>
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name or email" />
      </label>

      {visibleUsers.length === 0 ? (
        <div className="empty-state">{users.length ? 'No users match that search.' : 'No user records were returned.'}</div>
      ) : (
        <div className="table-wrap">
          <table className="user-directory-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Account</th>
                <th>KYC</th>
                <th>Product</th>
              </tr>
            </thead>
            <tbody>
              {visibleUsers.map((row) => (
                <tr key={row.id}>
                  <td data-label="Name"><Link className="user-name-link" to={`/users/${encodeURIComponent(row.id)}`}>{row.name}</Link></td>
                  <td data-label="Email">{row.email}</td>
                  <td data-label="Role">{normalizeRole(row.role)}</td>
                  <td data-label="Account">
                    <span className={`status-pill ${getStatusTone(row.status)}`}>{row.status || 'Active'}</span>
                    {row.transactionRestricted ? <span className="status-pill danger">Transactions restricted</span> : null}
                  </td>
                  <td data-label="KYC"><span className={`status-pill ${row.kycVerified ? 'success' : 'warning'}`}>{row.kycVerified ? 'Verified' : 'Not verified'}</span></td>
                  <td data-label="Product">{row.product || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function UserDetailPage() {
  const { userId } = useParams();
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [restrictionReason, setRestrictionReason] = useState('');
  const [restrictionError, setRestrictionError] = useState('');
  const [restrictionMessage, setRestrictionMessage] = useState('');
  const [savingRestriction, setSavingRestriction] = useState(false);
  const [accountStatusReason, setAccountStatusReason] = useState('');
  const [accountStatusError, setAccountStatusError] = useState('');
  const [accountStatusMessage, setAccountStatusMessage] = useState('');
  const [savingAccountStatus, setSavingAccountStatus] = useState(false);

  useEffect(() => {
    let active = true;

    fetchAdminData(`users/${encodeURIComponent(userId)}`)
      .then((payload) => {
        if (active) {
          setDetail(payload);
          setError('');
        }
      })
      .catch((fetchError) => {
        if (active) setError(fetchError.message || 'Unable to load this user profile.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [userId]);

  if (loading) return <div className="state-box">Loading user profile…</div>;
  if (error) {
    return (
      <section className="panel user-detail-error">
        <p className="error-banner" role="alert">{error}</p>
        <Link to="/users" className="secondary-button"><ArrowLeft size={16} /> Back to users</Link>
      </section>
    );
  }

  const { user, wallet, transactions = [], verificationRequests = [], supportRequests = [], investmentPlans = [], savingsGoals = [] } = detail;
  const latestVerification = verificationRequests[0];
  const saveTransactionRestriction = async () => {
    const reason = restrictionReason.trim();
    if (reason.length < 3 || reason.length > 500) {
      setRestrictionError('Enter a reason between 3 and 500 characters.');
      setRestrictionMessage('');
      return;
    }

    const restricted = !user.transactionRestricted;
    const action = restricted ? 'restrict transaction access for' : 'restore transaction access for';
    if (!window.confirm(`Are you sure you want to ${action} ${user.name}?`)) return;

    setSavingRestriction(true);
    setRestrictionError('');
    setRestrictionMessage('');
    try {
      const payload = await fetchAdminData(`users/${encodeURIComponent(userId)}/transaction-restriction`, {
        method: 'PATCH',
        body: { restricted, reason },
      });
      setDetail((current) => ({ ...current, user: { ...current.user, ...payload.user } }));
      setRestrictionReason('');
      setRestrictionMessage(payload.message);
    } catch (actionError) {
      setRestrictionError(actionError.message || 'Unable to update transaction access.');
    } finally {
      setSavingRestriction(false);
    }
  };
  const saveAccountStatus = async () => {
    const reason = accountStatusReason.trim();
    if (reason.length < 3 || reason.length > 500) {
      setAccountStatusError('Enter a reason between 3 and 500 characters.');
      setAccountStatusMessage('');
      return;
    }

    const suspended = user.status !== 'suspended';
    const action = suspended ? 'freeze' : 'restore access for';
    if (!window.confirm(`Are you sure you want to ${action} ${user.name}?`)) return;

    setSavingAccountStatus(true);
    setAccountStatusError('');
    setAccountStatusMessage('');
    try {
      const payload = await fetchAdminData(`users/${encodeURIComponent(userId)}/account-status`, {
        method: 'PATCH',
        body: { status: suspended ? 'suspended' : 'active', reason },
      });
      setDetail((current) => ({ ...current, user: { ...current.user, ...payload.user } }));
      setAccountStatusReason('');
      setAccountStatusMessage(payload.message);
    } catch (actionError) {
      setAccountStatusError(actionError.message || 'Unable to update account access.');
    } finally {
      setSavingAccountStatus(false);
    }
  };

  return (
    <div className="user-detail-page">
      <Link to="/users" className="user-back-link"><ArrowLeft size={16} /> All users</Link>

      <section className="user-profile-hero">
        <div className="user-profile-avatar">{user.name?.trim().charAt(0)?.toUpperCase() || 'U'}</div>
        <div className="user-profile-heading">
          <span className="welcome-kicker">CUSTOMER PROFILE</span>
          <h2>{user.name}</h2>
          <p>{user.email}</p>
        </div>
        <div className="user-profile-status">
          <span className={`status-pill ${getStatusTone(user.status)}`}>{normalizeRole(user.status)}</span>
          <span className={`status-pill ${user.kycVerified ? 'success' : 'warning'}`}>{user.kycVerified ? 'KYC verified' : 'KYC not verified'}</span>
        </div>
      </section>

      <section className="user-detail-metrics">
        <article className="user-detail-metric">
          <span>Wallet balance</span>
          <strong>{formatCurrency(wallet?.balance || 0)}</strong>
          <small>{wallet ? `Updated ${formatDate(wallet.updatedAt)}` : 'No wallet record'}</small>
        </article>
        <article className="user-detail-metric">
          <span>Investment plans</span>
          <strong>{investmentPlans.length}</strong>
          <small>{investmentPlans.filter((plan) => plan.status === 'ACTIVE').length} active</small>
        </article>
        <article className="user-detail-metric">
          <span>Support requests</span>
          <strong>{supportRequests.length}</strong>
          <small>{supportRequests.filter((request) => request.status !== 'resolved').length} open or in progress</small>
        </article>
      </section>

      {user.role === 'user' ? (
        <section className="panel transaction-access-panel">
          <div className="panel-header">
            <div>
              <h3>Transaction access</h3>
              <p className="section-note">Temporarily stop new deposits, withdrawals, bank-account changes, and investment actions without locking the customer out of their account.</p>
            </div>
            <span className={`status-pill ${user.transactionRestricted ? 'danger' : 'success'}`}>
              {user.transactionRestricted ? 'Restricted' : 'Available'}
            </span>
          </div>
          {user.transactionRestricted ? (
            <div className="transaction-restriction-current">
              <strong>Current restriction reason</strong>
              <p>{user.transactionRestrictionReason || 'No reason recorded.'}</p>
              {user.transactionRestrictedAt ? <small>Applied {formatDateTime(user.transactionRestrictedAt)}</small> : null}
            </div>
          ) : (
            <p className="transaction-access-copy">No transaction restriction is active. Account freezing is managed separately in Account access; restoring transactions does not unfreeze the account.</p>
          )}
          {restrictionError ? <p className="error-banner inline-error" role="alert">{restrictionError}</p> : null}
          {restrictionMessage ? <p className="success-message" role="status">{restrictionMessage}</p> : null}
          <label className="transaction-restriction-reason">
            <span>{user.transactionRestricted ? 'Reason for restoring access' : 'Reason for restriction'}</span>
            <textarea
              value={restrictionReason}
              onChange={(event) => setRestrictionReason(event.target.value)}
              maxLength={500}
              rows={3}
              placeholder="Record the operational reason for this change"
              disabled={savingRestriction}
            />
          </label>
          <div className="transaction-restriction-footer">
            <small>Every change is recorded in the admin activity log. Existing balances and provider settlement callbacks are preserved; requests already in progress may still complete.</small>
            <button
              type="button"
              className={user.transactionRestricted ? 'secondary-button' : 'transaction-restrict-button'}
              onClick={saveTransactionRestriction}
              disabled={savingRestriction || restrictionReason.trim().length < 3}
            >
              {savingRestriction ? 'Saving…' : user.transactionRestricted ? 'Restore transactions' : 'Restrict transactions'}
            </button>
          </div>
        </section>
      ) : null}

      {user.role === 'user' ? (
        <section className="panel account-freeze-panel">
          <div className="panel-header">
            <div>
              <h3>Account access</h3>
              <p className="section-note">Freeze blocks sign-in and invalidates existing sessions. It does not change the customer’s balance or cancel existing plans.</p>
            </div>
            <span className={`status-pill ${user.status === 'suspended' ? 'danger' : 'success'}`}>
              {user.status === 'suspended' ? 'Frozen' : 'Access enabled'}
            </span>
          </div>
          {user.status === 'suspended' ? (
            <div className="account-freeze-current">
              <strong>Current freeze reason</strong>
              <p>{user.suspensionReason || 'No reason recorded.'}</p>
              {user.suspendedAt ? <small>Frozen {formatDateTime(user.suspendedAt)}</small> : null}
            </div>
          ) : (
            <p className="account-freeze-copy">The customer can currently sign in and use their account. Freezing is separate from transaction restrictions.</p>
          )}
          {accountStatusError ? <p className="error-banner inline-error" role="alert">{accountStatusError}</p> : null}
          {accountStatusMessage ? <p className="success-message" role="status">{accountStatusMessage}</p> : null}
          <label className="account-freeze-reason">
            <span>{user.status === 'suspended' ? 'Reason for restoring access' : 'Reason for freezing account'}</span>
            <textarea
              value={accountStatusReason}
              onChange={(event) => setAccountStatusReason(event.target.value)}
              maxLength={500}
              rows={3}
              placeholder="Record the operational reason for this change"
              disabled={savingAccountStatus}
            />
          </label>
          <div className="account-freeze-footer">
            <small>The reason and admin action are recorded in the activity log. Restoring access invalidates prior sessions; the customer must sign in again.</small>
            <button
              type="button"
              className={user.status === 'suspended' ? 'secondary-button' : 'account-freeze-button'}
              onClick={saveAccountStatus}
              disabled={savingAccountStatus || accountStatusReason.trim().length < 3}
            >
              {savingAccountStatus ? 'Saving…' : user.status === 'suspended' ? 'Restore account access' : 'Freeze account'}
            </button>
          </div>
        </section>
      ) : null}

      <section className="user-detail-grid">
        <article className="panel user-detail-panel">
          <div className="panel-header"><div><h3>Account information</h3><p className="section-note">Read-only profile details</p></div></div>
          <dl className="user-facts">
            <div><dt>Email</dt><dd>{user.email}</dd></div>
            <div><dt>Phone</dt><dd>{user.phone || 'Not provided'}</dd></div>
            <div><dt>Account status</dt><dd>{normalizeRole(user.status)}</dd></div>
            <div><dt>Access role</dt><dd>{normalizeRole(user.role)}</dd></div>
            <div><dt>Product</dt><dd>{normalizeRole(user.product)}</dd></div>
            <div><dt>Primary goal</dt><dd>{user.goal || 'Not provided'}</dd></div>
            <div><dt>Joined</dt><dd>{formatDate(user.createdAt)}</dd></div>
            <div><dt>User reference</dt><dd className="user-reference">{user.id}</dd></div>
          </dl>
        </article>

        <article className="panel user-detail-panel">
          <div className="panel-header"><div><h3>Verification</h3><p className="section-note">Current status and recent review history</p></div></div>
          <div className="detail-status-row">
            <span>Account verification</span>
            <span className={`status-pill ${user.kycVerified ? 'success' : 'warning'}`}>{user.kycVerified ? 'Verified' : 'Not verified'}</span>
          </div>
          {latestVerification ? (
            <div className="user-detail-note">
              <strong>Latest request · {normalizeRole(latestVerification.status)}</strong>
              <span>Submitted {formatDate(latestVerification.createdAt)}</span>
              {latestVerification.reviewedAt ? <span>Reviewed {formatDate(latestVerification.reviewedAt)}</span> : null}
            </div>
          ) : <div className="empty-state">No verification request has been submitted.</div>}
          {latestVerification?.status === 'pending' ? <Link to="/kyc" className="user-detail-action">Open KYC queue</Link> : null}
        </article>

        <article className="panel user-detail-panel">
          <div className="panel-header"><div><h3>Investment plans</h3><p className="section-note">Plan status and balances</p></div></div>
          {investmentPlans.length ? (
            <div className="user-detail-list">
              {investmentPlans.map((plan, index) => (
                <div className="user-detail-list-row" key={`${plan.productType}-${plan.startDate || index}`}>
                  <div><strong>{normalizeRole(plan.productType)}</strong><span>{formatDate(plan.startDate)} – {formatDate(plan.maturityDate)}</span></div>
                  <div className="user-plan-values"><strong>{formatCurrency(plan.principal)}</strong><span>{normalizeRole(plan.status)}</span></div>
                </div>
              ))}
            </div>
          ) : <div className="empty-state">No investment plans found.</div>}
        </article>

        <article className="panel user-detail-panel">
          <div className="panel-header"><div><h3>Savings goals</h3><p className="section-note">Customer-created planning goals</p></div></div>
          {savingsGoals.length ? (
            <div className="user-detail-list">
              {savingsGoals.map((goal, index) => {
                const progress = goal.targetAmount > 0 ? Math.min(100, Math.round((goal.savedAmount / goal.targetAmount) * 100)) : 0;
                return (
                  <div className="user-goal-row" key={`${goal.name}-${index}`}>
                    <div className="user-detail-list-row">
                      <div><strong>{goal.name}</strong><span>{goal.targetDate ? `Target ${formatDate(goal.targetDate)}` : 'No target date'}</span></div>
                      <div className="user-plan-values"><strong>{formatCurrency(goal.savedAmount)}</strong><span>of {formatCurrency(goal.targetAmount)}</span></div>
                    </div>
                    <div className="user-goal-track"><span style={{ width: `${progress}%` }} /></div>
                  </div>
                );
              })}
            </div>
          ) : <div className="empty-state">No savings goals found.</div>}
        </article>

        <article className="panel user-detail-panel">
          <div className="panel-header"><div><h3>Recent transactions</h3><p className="section-note">Latest 10 wallet movements</p></div></div>
          {transactions.length ? (
            <div className="user-detail-list">
              {transactions.map((transaction) => (
                <div className="user-detail-list-row" key={transaction.reference}>
                  <div><strong>{normalizeRole(transaction.type)}</strong><span>{transaction.reference} · {formatDate(transaction.createdAt)}</span></div>
                  <div className="user-plan-values"><strong>{formatCurrency(transaction.amount)}</strong><span className={`status-text ${getStatusTone(transaction.status)}`}>{normalizeRole(transaction.status)}</span></div>
                </div>
              ))}
            </div>
          ) : <div className="empty-state">No wallet transactions found.</div>}
        </article>

        <article className="panel user-detail-panel">
          <div className="panel-header">
            <div><h3>Support history</h3><p className="section-note">Latest 10 requests from this customer</p></div>
            <Link to="/support" className="link-button">Open inbox</Link>
          </div>
          {supportRequests.length ? (
            <div className="user-detail-list">
              {supportRequests.map((request) => (
                <div className="user-detail-list-row" key={request.reference}>
                  <div><strong>{request.subject}</strong><span>{request.reference} · {normalizeRole(request.category)} · {formatDate(request.createdAt)}</span></div>
                  <span className={`status-pill ${getStatusTone(request.status)}`}>{normalizeRole(request.status)}</span>
                </div>
              ))}
            </div>
          ) : <div className="empty-state">No support requests found.</div>}
        </article>
      </section>
    </div>
  );
}

function KYCPage() {
  const [requests, setRequests] = useState([]);
  const [stats, setStats] = useState({ pending: 0, verified: 0, rejected: 0 });
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('pending');
  const [reviewNotes, setReviewNotes] = useState({});
  const [evidenceChecks, setEvidenceChecks] = useState({});
  const [pendingActionId, setPendingActionId] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;

    fetchAdminData(`operations/verification-requests?status=${status}`)
      .then((payload) => {
        if (active) {
          setRequests(payload.requests || []);
          setStats(payload.stats || { pending: 0, verified: 0, rejected: 0 });
          setError('');
        }
      })
      .catch((fetchError) => {
        if (active) setError(fetchError.message || 'Unable to load verification requests.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [status]);

  const handleReview = async (request, decision) => {
    const note = (reviewNotes[request.id] || '').trim();
    if (!evidenceChecks[request.id]) {
      setError('Confirm that you reviewed evidence using the approved verification process.');
      return;
    }
    if (note.length < 3) {
      setError('Add a reviewer note of at least 3 characters before saving.');
      return;
    }

    setPendingActionId(request.id);
    setError('');
    setMessage('');
    try {
      const payload = await fetchAdminData(`operations/verification-requests/${encodeURIComponent(request.id)}`, {
        method: 'PATCH',
        body: { decision, note, evidenceReviewed: true },
      });
      setMessage(`Verification request ${decision}.`);
      setReviewNotes((current) => ({ ...current, [request.id]: '' }));
      setEvidenceChecks((current) => ({ ...current, [request.id]: false }));
      setRequests((current) => (
        status === 'pending'
          ? current.filter((item) => item.id !== request.id)
          : current.map((item) => (item.id === request.id ? { ...item, status: payload.request.status } : item))
      ));
      setStats((current) => ({
        ...current,
        pending: Math.max(0, current.pending - 1),
        [decision]: current[decision] + 1,
      }));
    } catch (actionError) {
      setError(actionError.message || 'Unable to save the verification decision.');
    } finally {
      setPendingActionId('');
    }
  };

  if (loading) {
    return <div className="state-box">Loading KYC review…</div>;
  }

  return (
    <div className="panel">
      <div className="panel-header">
        <div>
          <h3>KYC queue</h3>
          <p className="section-note">Review actual verification requests. This console does not store identity documents.</p>
        </div>
        <label className="filter-field">
          <span>Status</span>
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="pending">Pending</option>
            <option value="all">All requests</option>
            <option value="verified">Verified</option>
            <option value="rejected">Rejected</option>
          </select>
        </label>
      </div>

      {error ? <div className="error-banner inline-error" role="alert">{error}</div> : null}
      {message ? <p className="success-message" role="status">{message}</p> : null}
      <p className="review-disclaimer">
        Before deciding, verify identity evidence through your approved secure process. Do not approve based only on the name and date of birth shown here.
      </p>

      <div className="summary-strip">
        {[
          { label: 'Pending review', value: stats.pending },
          { label: 'Verified', value: stats.verified },
          { label: 'Rejected', value: stats.rejected },
        ].map((item) => (
          <div key={item.label} className="summary-pill">
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </div>
        ))}
      </div>

      {requests.length === 0 ? (
        error ? null : <div className="empty-state">No verification requests match this status.</div>
      ) : (
        <div className="review-list">
          {requests.map((request) => (
            <article key={request.id} className="review-card">
              <div className="review-card-heading">
                <div>
                  <h4>{request.legalName}</h4>
                  <p>{request.user?.email || 'Account unavailable'} · Submitted {formatDate(request.createdAt)}</p>
                </div>
                <span className={`status-pill ${getStatusTone(request.status)}`}>{normalizeRole(request.status)}</span>
              </div>
              <dl className="review-details">
                <div><dt>Account name</dt><dd>{request.user?.name || '—'}</dd></div>
                <div><dt>Date of birth</dt><dd>{formatDate(request.dateOfBirth)}</dd></div>
                <div><dt>Phone</dt><dd>{request.user?.phone || '—'}</dd></div>
              </dl>
              {request.status === 'pending' ? (
                <div className="review-form">
                  <label className="field-wrap">
                    <span className="field-label"><strong>Reviewer note</strong></span>
                    <textarea
                      value={reviewNotes[request.id] || ''}
                      maxLength={500}
                      required
                      placeholder="Record the reason for this decision"
                      onChange={(event) => setReviewNotes((current) => ({ ...current, [request.id]: event.target.value }))}
                    />
                  </label>
                  <label className="evidence-confirmation">
                    <input
                      type="checkbox"
                      checked={!!evidenceChecks[request.id]}
                      onChange={(event) => setEvidenceChecks((current) => ({ ...current, [request.id]: event.target.checked }))}
                    />
                    <span>I reviewed the evidence using the approved verification process.</span>
                  </label>
                  <div className="page-actions">
                    <button
                      type="button"
                      className="primary-button"
                      disabled={pendingActionId === request.id}
                      onClick={() => handleReview(request, 'verified')}
                    >
                      {pendingActionId === request.id ? 'Saving…' : 'Mark verified'}
                    </button>
                    <button
                      type="button"
                      className="secondary-button"
                      disabled={pendingActionId === request.id}
                      onClick={() => handleReview(request, 'rejected')}
                    >
                      Reject request
                    </button>
                  </div>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function WalletsPage() {
  const [data, setData] = useState({ summary: {}, wallets: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    fetchAdminData('operations/wallets')
      .then((payload) => {
        if (active) setData(payload);
      })
      .catch((fetchError) => {
        if (active) setError(fetchError.message || 'Unable to load wallets.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  if (loading) return <div className="state-box">Loading wallet records…</div>;
  if (error) return <div className="error-banner inline-error" role="alert">{error}</div>;

  return (
    <div className="panel">
      <div className="panel-header">
        <div>
          <h3>Wallet overview</h3>
          <p className="section-note">Read-only balances from the backend. No balance adjustments are available here.</p>
        </div>
      </div>

      <div className="wallet-summary-grid">
        <div className="summary-box">
          <span>Total wallet balance</span>
          <strong>{formatCurrency(data.summary.totalBalance)}</strong>
        </div>
        <div className="summary-box">
          <span>Wallet accounts</span>
          <strong>{data.summary.walletCount || 0}</strong>
        </div>
        <div className="summary-box">
          <span>Records shown</span>
          <strong>{data.summary.recordsShown || 0}</strong>
        </div>
      </div>

      {data.wallets?.length ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Account holder</th><th>Email</th><th>Balance</th><th>Updated</th></tr>
            </thead>
            <tbody>
              {data.wallets.map((wallet) => (
                <tr key={wallet.id}>
                  <td>{wallet.user}</td>
                  <td>{wallet.email || '—'}</td>
                  <td>{formatCurrency(wallet.balance)}</td>
                  <td>{formatDate(wallet.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <div className="empty-state">No wallet records were returned.</div>}
      <p className="section-note">The balance above includes all wallet records; the table is limited to the 100 most recently updated.</p>
    </div>
  );
}

function TransactionsPage() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    let active = true;

    fetchAdminData('transactions')
      .then((payload) => {
        if (active) setTransactions(payload.transactions || []);
      })
      .catch((fetchError) => {
        if (active) setError(fetchError.message || 'Unable to load transactions.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const visibleTransactions = transactions.filter((row) => (
    statusFilter === 'all' || String(row.status).toLowerCase() === statusFilter
  ));
  const totalVolume = visibleTransactions.reduce((sum, row) => {
    const rawAmount = typeof row.amount === 'number'
      ? row.amount
      : Number(String(row.amount || '').replace(/[^\d.-]/g, ''));
    return sum + (Number.isFinite(rawAmount) ? rawAmount : 0);
  }, 0);

  const exportTransactions = () => {
    const escapeCell = (value) => {
      const text = String(value ?? '');
      const safeText = /^[=+\-@]/.test(text.trim()) ? `'${text}` : text;
      return `"${safeText.replace(/"/g, '""')}"`;
    };
    const rows = [
      ['Reference', 'User', 'Type', 'Amount', 'Status', 'Date'],
      ...visibleTransactions.map((row) => [row.id, row.user, row.type, row.amount, row.status, row.createdAt]),
    ];
    const csv = rows.map((row) => row.map(escapeCell).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'kalma-transactions.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return <div className="state-box">Loading transactions…</div>;
  }
  if (error) return <div className="error-banner inline-error" role="alert">{error}</div>;

  return (
    <div className="panel">
      <div className="panel-header">
        <div>
          <h3>Transactions</h3>
          <p className="section-note">Latest backend records. Export and filters apply to the records currently loaded.</p>
        </div>
        <div className="page-actions">
          <label className="filter-field">
            <span>Status</span>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="all">All</option>
              <option value="successful">Successful</option>
              <option value="pending">Pending</option>
              <option value="processing">Processing</option>
              <option value="requires_approval">Needs approval</option>
              <option value="failed">Failed</option>
              <option value="reversed">Reversed</option>
            </select>
          </label>
          <button type="button" className="primary-button" onClick={exportTransactions} disabled={!visibleTransactions.length}>Export CSV</button>
        </div>
      </div>

      <div className="summary-strip">
        <div className="summary-pill">
          <span>Total volume</span>
          <strong>{formatCurrency(totalVolume)}</strong>
        </div>
        <div className="summary-pill">
          <span>Records</span>
          <strong>{visibleTransactions.length}</strong>
        </div>
        <div className="summary-pill">
          <span>Completed</span>
          <strong>{visibleTransactions.filter((row) => ['completed', 'success', 'successful'].includes(String(row.status).toLowerCase())).length}</strong>
        </div>
      </div>

      {visibleTransactions.length === 0 ? (
        <div className="empty-state">{transactions.length ? 'No transactions match this status.' : 'No transactions have been recorded yet.'}</div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Reference</th>
                <th>User</th>
                <th>Type</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {visibleTransactions.map((row) => (
                <tr key={row.id}>
                  <td>{row.id}</td>
                  <td>{row.user}</td>
                  <td>{row.type}</td>
                  <td>{row.amount}</td>
                  <td><span className={`status-pill ${getStatusTone(row.status)}`}>{row.status}</span></td>
                  <td>{formatDate(row.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function SupportPage() {
  const [tickets, setTickets] = useState([]);
  const [stats, setStats] = useState({ open: 0, inProgress: 0, resolved: 0 });
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [statusDrafts, setStatusDrafts] = useState({});
  const [noteDrafts, setNoteDrafts] = useState({});
  const [pendingActionId, setPendingActionId] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;

    fetchAdminData(`operations/support-requests?status=${statusFilter}`)
      .then((payload) => {
        if (active) {
          setTickets(payload.requests || []);
          setStats(payload.stats || { open: 0, inProgress: 0, resolved: 0 });
          setError('');
        }
      })
      .catch((fetchError) => {
        if (active) setError(fetchError.message || 'Unable to load support requests.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [statusFilter]);

  const handleTicketUpdate = async (ticket) => {
    const note = (noteDrafts[ticket.id] || '').trim();
    const status = statusDrafts[ticket.id] || ticket.status;
    if (note.length < 3) {
      setError('Add a staff note of at least 3 characters before saving.');
      return;
    }

    setPendingActionId(ticket.id);
    setError('');
    setMessage('');
    try {
      const payload = await fetchAdminData(`operations/support-requests/${encodeURIComponent(ticket.id)}`, {
        method: 'PATCH',
        body: { status, note },
      });
      setMessage(`Support request ${ticket.reference} updated.`);
      setNoteDrafts((current) => ({ ...current, [ticket.id]: '' }));
      setTickets((current) => (
        statusFilter !== 'all' && status !== statusFilter
          ? current.filter((item) => item.id !== ticket.id)
          : current.map((item) => (item.id === ticket.id ? { ...item, status: payload.request.status } : item))
      ));
      setStats((current) => {
        if (ticket.status === status) return current;
        const statusKeys = { open: 'open', in_progress: 'inProgress', resolved: 'resolved' };
        return {
          ...current,
          [statusKeys[ticket.status]]: Math.max(0, current[statusKeys[ticket.status]] - 1),
          [statusKeys[status]]: current[statusKeys[status]] + 1,
        };
      });
    } catch (actionError) {
      setError(actionError.message || 'Unable to update this support request.');
    } finally {
      setPendingActionId('');
    }
  };

  if (loading) {
    return <div className="state-box">Loading support…</div>;
  }

  return (
    <div className="panel">
      <div className="panel-header">
        <div>
          <h3>Customer support</h3>
          <p className="section-note">Live customer requests. Each status change requires a staff note and is audited.</p>
        </div>
        <label className="filter-field">
          <span>Status</span>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="all">All requests</option>
            <option value="open">Open</option>
            <option value="in_progress">In progress</option>
            <option value="resolved">Resolved</option>
          </select>
        </label>
      </div>

      {error ? <div className="error-banner inline-error" role="alert">{error}</div> : null}
      {message ? <p className="success-message" role="status">{message}</p> : null}

      <div className="summary-strip">
        <div className="summary-pill"><span>Open</span><strong>{stats.open}</strong></div>
        <div className="summary-pill"><span>In progress</span><strong>{stats.inProgress}</strong></div>
        <div className="summary-pill"><span>Resolved</span><strong>{stats.resolved}</strong></div>
      </div>

      {error && !tickets.length ? null : tickets.length === 0 ? (
        <div className="empty-state">No support requests match this status.</div>
      ) : (
        <div className="review-list">
          {tickets.map((ticket) => (
            <article key={ticket.id} className="review-card">
              <div className="review-card-heading">
                <div>
                  <h4>{ticket.subject}</h4>
                  <p>{ticket.user?.name || 'Unknown user'} · {ticket.user?.email || 'No email'} · {ticket.reference}</p>
                </div>
                <span className={`status-pill ${getStatusTone(ticket.status)}`}>{normalizeRole(ticket.status)}</span>
              </div>
              <p className="support-message">{ticket.message}</p>
              <div className="support-meta">
                <span>Category: {normalizeRole(ticket.category)}</span>
                <span>Submitted: {formatDate(ticket.createdAt)}</span>
              </div>
              <div className="review-form">
                <label className="filter-field">
                  <span>Update status</span>
                  <select
                    value={statusDrafts[ticket.id] || ticket.status}
                    onChange={(event) => setStatusDrafts((current) => ({ ...current, [ticket.id]: event.target.value }))}
                  >
                    <option value="open">Open</option>
                    <option value="in_progress">In progress</option>
                    <option value="resolved">Resolved</option>
                  </select>
                </label>
                <label className="field-wrap">
                  <span className="field-label"><strong>Staff note</strong></span>
                  <textarea
                    value={noteDrafts[ticket.id] || ''}
                    maxLength={1000}
                    required
                    placeholder="Record the action taken"
                    onChange={(event) => setNoteDrafts((current) => ({ ...current, [ticket.id]: event.target.value }))}
                  />
                </label>
                <button
                  type="button"
                  className="primary-button"
                  disabled={pendingActionId === ticket.id}
                  onClick={() => handleTicketUpdate(ticket)}
                >
                  {pendingActionId === ticket.id ? 'Saving…' : 'Save update'}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function ActivityPage() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    fetchAdminData('operations/audit-logs')
      .then((payload) => {
        if (active) setEntries(payload.entries || []);
      })
      .catch((fetchError) => {
        if (active) setError(fetchError.message || 'Unable to load the audit log.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  if (loading) return <div className="state-box">Loading activity log…</div>;
  if (error) return <div className="error-banner inline-error" role="alert">{error}</div>;

  return (
    <div className="panel">
      <div className="panel-header">
        <div>
          <h3>Staff activity log</h3>
          <p className="section-note">KYC decisions and support status changes recorded by the backend.</p>
        </div>
      </div>
      {entries.length === 0 ? <div className="empty-state">No staff actions have been recorded.</div> : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Time</th><th>Staff member</th><th>Action</th><th>Status change</th><th>Note</th></tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id}>
                  <td>{formatDateTime(entry.createdAt)}</td>
                  <td>{entry.actor?.name || entry.actor?.email || 'Unknown admin'}</td>
                  <td>{entry.action === 'kyc.reviewed' ? 'KYC review' : entry.action === 'account.transaction_access_updated' ? 'Transaction access' : 'Support update'}</td>
                  <td>{normalizeRole(entry.previousStatus)} → {normalizeRole(entry.nextStatus)}</td>
                  <td>{entry.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function SettingsPage() {
  const session = useOutletContext();

  return (
    <div className="panel settings-panel">
      <div className="panel-header">
        <div>
          <h3>Admin account</h3>
          <p className="section-note">This panel only shows settings that are confirmed by the backend.</p>
        </div>
      </div>
      <div className="settings-grid">
        <div className="setting-box">
          <h4>Signed-in account</h4>
          <p>{session?.name || 'Admin'} · {session?.email || '—'}</p>
          <p>Role: {normalizeRole(session?.role)}</p>
        </div>
        <div className="setting-box">
          <h4>Session security</h4>
          <p>Admin access is verified by the backend and held in an HttpOnly session cookie.</p>
          <p>Multi-factor authentication and notification preferences are not managed from this screen.</p>
        </div>
        <div className="setting-box">
          <h4>Audit history</h4>
          <p>Review saved KYC and support actions in the staff activity log.</p>
          <Link to="/activity" className="link-button">Open activity log</Link>
        </div>
      </div>
    </div>
  );
}

export default App;
