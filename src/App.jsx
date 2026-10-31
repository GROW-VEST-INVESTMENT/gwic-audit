import { useEffect, useState } from 'react';
import { BrowserRouter, Link, Navigate, NavLink, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  Check,
  Eye,
  EyeOff,
  LayoutDashboard,
  Lock,
  LogOut,
  Mail,
  Settings2,
  ShieldCheck,
  Ticket,
  Users,
  WalletCards,
} from 'lucide-react';
import './App.css';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const ADMIN_ROLES = new Set(['admin', 'super_admin']);

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
  return new Intl.DateTimeFormat('en-NG', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
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
  if (['verified', 'success', 'active', 'completed', 'approved'].includes(normalized)) return 'success';
  if (['pending', 'in_progress', 'processing', 'warning'].includes(normalized)) return 'warning';
  if (['suspended', 'blocked', 'rejected', 'failed', 'danger'].includes(normalized)) return 'danger';
  return 'neutral';
};

const getPriorityTone = (priority) => {
  const normalized = String(priority || 'medium').toLowerCase();
  if (normalized.includes('high')) return 'high';
  if (normalized.includes('low')) return 'low';
  return 'medium';
};

const BrandMark = ({ className = 'brand-mark' }) => (
  <svg className={className} viewBox="0 0 96 96" aria-hidden="true">
    <path d="M15 58.5 38 42.5 51 52.5 70 28.5 82 25.5 78 38.5 59 64.5 46 53 29 68.5Z" fill="currentColor" opacity="0.96" />
    <path d="M12 63.5 25 60.5l17-14 26-19" fill="none" stroke="#baf7a3" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="71.5" cy="28.5" r="6.5" fill="#baf7a3" />
  </svg>
);

const getUserFromStorage = () => {
  try {
    const saved = JSON.parse(localStorage.getItem('gwic-admin-session') || 'null');
    return saved && ADMIN_ROLES.has(saved.role) ? saved : null;
  } catch {
    return null;
  }
};

const fetchAdminData = async (endpoint) => {
  const response = await fetch(`${API_BASE}/api/admin/${endpoint}`, {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  });

  if (response.status === 401) {
    localStorage.removeItem('gwic-admin-session');
    throw new Error('Your session expired. Please sign in again.');
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Unable to load admin data.' }));
    throw new Error(error.message || 'Unable to load admin data.');
  }

  return response.json();
};

const loadCurrentAdminSession = async () => {
  try {
    const response = await fetch(`${API_BASE}/api/auth/me`, {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      return null;
    }

    const payload = await response.json();
    const user = payload?.user;
    if (!user || !ADMIN_ROLES.has(user.role)) {
      return null;
    }

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    };
  } catch {
    return null;
  }
};

function App() {
  const [session, setSession] = useState(getUserFromStorage);

  useEffect(() => {
    let active = true;

    loadCurrentAdminSession().then((user) => {
      if (active && user) {
        setSession(user);
      }
    });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (session) {
      localStorage.setItem('gwic-admin-session', JSON.stringify(session));
    } else {
      localStorage.removeItem('gwic-admin-session');
    }
  }, [session]);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={session ? <Navigate to="/" replace /> : <LoginPage onLogin={setSession} />} />
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
          <Route path="kyc" element={<KYCPage />} />
          <Route path="wallets" element={<WalletsPage />} />
          <Route path="transactions" element={<TransactionsPage />} />
          <Route path="support" element={<SupportPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
        <Route path="*" element={<Navigate to={session ? '/' : '/login'} replace />} />
      </Routes>
    </BrowserRouter>
  );
}

function LoginPage({ onLogin }) {
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

      onLogin({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
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
            <div className="hero-wordmark-wrap">
              <div className="hero-wordmark">GWIC</div>
              <div className="hero-subtitle">GROW WITH CORE</div>
            </div>
            <div className="chart-bars" aria-hidden="true">
              <span /><span /><span /><span /><span /><span /><span /><span />
            </div>
          </div>

          <div className="section-divider" />
          <div className="hero-panel-title">ADMIN PANEL</div>
        </div>

        <div className="login-card">
          <div className="login-shield">
            <ShieldCheck size={36} />
          </div>

          <h1>Admin Access</h1>
          <p className="login-subtitle">Sign in to manage GWIC operations and monitor platform activities.</p>

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

            <button type="submit" className="primary-button login-submit" disabled={pending}>
              <ArrowRight size={20} />
              <span>{pending ? 'Signing in...' : 'Login'}</span>
            </button>
          </form>

          <div className="secure-row">
            <span className="secure-check"><Check size={14} /></span>
            <span>Secure Access</span>
          </div>

          <div className="info-note">
            <span className="info-icon">i</span>
            <p>Use a real GWIC admin account from the shared backend database.</p>
          </div>
        </div>

        <footer className="login-footer">
          <span>GWIC — Admin Panel</span>
          <span>Manage • Monitor • Grow</span>
        </footer>
      </div>
    </div>
  );
}

function AdminLayout({ session, onLogout }) {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const navItems = [
    { to: '/', label: 'Overview', icon: LayoutDashboard },
    { to: '/users', label: 'Users', icon: Users },
    { to: '/kyc', label: 'KYC', icon: ShieldCheck },
    { to: '/wallets', label: 'Wallets', icon: WalletCards },
    { to: '/transactions', label: 'Transactions', icon: Activity },
    { to: '/support', label: 'Support', icon: Ticket },
    { to: '/settings', label: 'Settings', icon: Settings2 },
  ];

  const currentTitle = navItems.find((item) => item.to === location.pathname)?.label || 'Overview';

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  return (
    <div className="admin-app">
      <button type="button" className="mobile-toggle" onClick={() => setSidebarOpen((value) => !value)} aria-label="Toggle navigation">
        ☰
      </button>
      <div className={`sidebar-backdrop ${sidebarOpen ? 'visible' : ''}`} onClick={() => setSidebarOpen(false)} aria-hidden="true" />

      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div>
          <div className="brand-block">
            <div className="brand-mark">G</div>
            <div>
              <p className="eyebrow">Operations</p>
              <h2>GWIC Admin</h2>
            </div>
          </div>

          <nav className="nav">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                  onClick={() => setSidebarOpen(false)}
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
              <ArrowUpRight size={16} />
              <span>Refresh data</span>
            </button>
            <Link to="/settings" className="primary-button">
              <Settings2 size={16} />
              <span>Settings</span>
            </Link>
          </div>
        </header>

        <div className="content-area">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

function DashboardPage() {
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
      change: `${data.summary.adminUsers || 0} admins`,
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
      label: 'Support queue',
      value: String(data.supportTickets?.length || 0),
      change: 'live tickets',
      tone: 'neutral',
      icon: Ticket,
    },
  ];

  const healthStatus = [
    { label: 'Onboarding completion', value: 82, color: 'success' },
    { label: 'KYC approval rate', value: 91, color: 'success' },
    { label: 'Wallet risk flags', value: 14, color: 'warning' },
    { label: 'Support SLA', value: 76, color: 'neutral' },
  ];

  if (loading) {
    return <div className="state-box">Loading dashboard…</div>;
  }

  return (
    <>
      {error ? <div className="error-banner inline-error">{error}</div> : null}

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

      <section className="insight-grid">
        <div className="panel insight-panel">
          <div className="panel-header">
            <div>
              <h3>Operations health</h3>
              <p className="section-note">Live business pulse and platform resilience</p>
            </div>
          </div>
          <div className="status-stack">
            {healthStatus.map((item) => (
              <div key={item.label} className="status-row">
                <div className="status-row-meta">
                  <span>{item.label}</span>
                  <strong>{item.value}%</strong>
                </div>
                <div className="progress-track">
                  <span className={`progress-bar ${item.color}`} style={{ width: `${item.value}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="panel insight-panel">
          <div className="panel-header">
            <div>
              <h3>Priority action list</h3>
              <p className="section-note">High-impact items requiring attention</p>
            </div>
          </div>
          <div className="action-list">
            <div className="action-item">
              <div className="action-dot success" />
              <div>
                <strong>Review pending KYC queue</strong>
                <small>{data.summary.pendingKyc || 0} users awaiting approval</small>
              </div>
            </div>
            <div className="action-item">
              <div className="action-dot warning" />
              <div>
                <strong>Watch wallet anomalies</strong>
                <small>12 flagged balances need manual review</small>
              </div>
            </div>
            <div className="action-item">
              <div className="action-dot neutral" />
              <div>
                <strong>Support response time</strong>
                <small>Average response remains within SLA</small>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="panel-grid two-up">
        <div className="panel">
          <div className="panel-header">
            <h3>Recent transactions</h3>
            <Link to="/transactions" className="link-button">View all</Link>
          </div>
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
                  <td><span className="status-pill success">{row.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
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

  useEffect(() => {
    let active = true;

    fetchAdminData('users')
      .then((payload) => {
        if (active) setUsers(payload.users || []);
      })
      .catch(() => {
        if (active) setUsers([]);
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
    { label: 'Verified', value: users.filter((user) => user.status === 'verified' || user.status === 'active').length },
    { label: 'Admins', value: users.filter((user) => user.role === 'admin' || user.role === 'super_admin').length },
  ];

  if (loading) {
    return <div className="state-box">Loading users…</div>;
  }

  return (
    <div className="panel">
      <div className="panel-header">
        <div>
          <h3>User management</h3>
          <p className="section-note">Manage member access and account status</p>
        </div>
        <div className="page-actions">
          <button type="button" className="secondary-button">Filter</button>
          <button type="button" className="primary-button">Invite user</button>
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

      {users.length === 0 ? (
        <div className="empty-state">No users found for the current workspace.</div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Product</th>
              </tr>
            </thead>
            <tbody>
              {users.map((row) => (
                <tr key={row.id}>
                  <td>{row.name}</td>
                  <td>{row.email}</td>
                  <td>{normalizeRole(row.role)}</td>
                  <td><span className={`status-pill ${getStatusTone(row.status)}`}>{row.status || 'Active'}</span></td>
                  <td>{row.product || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function KYCPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    fetchAdminData('kyc')
      .then((payload) => {
        if (active) setUsers(payload.users || []);
      })
      .catch(() => {
        if (active) setUsers([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const kycSummary = [
    { label: 'Pending review', value: users.filter((user) => user.status === 'pending').length },
    { label: 'Verified', value: users.filter((user) => user.status === 'verified').length },
    { label: 'Requires action', value: users.filter((user) => user.status === 'rejected' || user.status === 'in_review').length },
  ];

  if (loading) {
    return <div className="state-box">Loading KYC review…</div>;
  }

  return (
    <div className="panel">
      <div className="panel-header">
        <div>
          <h3>KYC queue</h3>
          <p className="section-note">Review onboarding and compliance status</p>
        </div>
        <div className="page-actions">
          <button type="button" className="secondary-button">Review policy</button>
        </div>
      </div>

      <div className="summary-strip">
        {kycSummary.map((item) => (
          <div key={item.label} className="summary-pill">
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </div>
        ))}
      </div>

      {users.length === 0 ? (
        <div className="empty-state">No KYC records are waiting for review.</div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Status</th>
                <th>Role</th>
              </tr>
            </thead>
            <tbody>
              {users.map((row) => (
                <tr key={row.id}>
                  <td>{row.name}</td>
                  <td>{row.email}</td>
                  <td><span className={`status-pill ${getStatusTone(row.statusCode)}`}>{row.status}</span></td>
                  <td>{normalizeRole(row.role)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function WalletsPage() {
  const walletCards = [
    { label: 'Total wallet value', value: '₦12.4M' },
    { label: 'Successful deposits', value: '86.4%' },
    { label: 'Flagged balances', value: '12 users' },
  ];

  return (
    <div className="panel">
      <div className="panel-header">
        <div>
          <h3>Wallet controls</h3>
          <p className="section-note">Cash movement, reconciliation, and risk monitoring</p>
        </div>
        <div className="page-actions">
          <button type="button" className="secondary-button">Audit logs</button>
          <button type="button" className="primary-button">Reconcile balances</button>
        </div>
      </div>

      <div className="wallet-summary-grid">
        {walletCards.map((item) => (
          <div key={item.label} className="summary-box">
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </div>
        ))}
      </div>

      <div className="detail-grid">
        <div className="mini-panel">
          <h4>Reconciliation checklist</h4>
          <ul className="check-list">
            <li>Daily wallet drift review</li>
            <li>Failed settlement reconcile</li>
            <li>Manual approval on flagged balances</li>
          </ul>
        </div>
        <div className="mini-panel">
          <h4>Operational notes</h4>
          <p>Risk controls remain stable and no critical wallet exception requires emergency action.</p>
        </div>
      </div>
    </div>
  );
}

function TransactionsPage() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    fetchAdminData('transactions')
      .then((payload) => {
        if (active) setTransactions(payload.transactions || []);
      })
      .catch(() => {
        if (active) setTransactions([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const totalVolume = transactions.reduce((sum, row) => sum + (Number(row.amount) || 0), 0);

  if (loading) {
    return <div className="state-box">Loading transactions…</div>;
  }

  return (
    <div className="panel">
      <div className="panel-header">
        <div>
          <h3>Transactions</h3>
          <p className="section-note">Track deposits, withdrawals, and wallet movement</p>
        </div>
        <div className="page-actions">
          <button type="button" className="secondary-button">Filter</button>
          <button type="button" className="primary-button">Export</button>
        </div>
      </div>

      <div className="summary-strip">
        <div className="summary-pill">
          <span>Total volume</span>
          <strong>{formatCurrency(totalVolume)}</strong>
        </div>
        <div className="summary-pill">
          <span>Records</span>
          <strong>{transactions.length}</strong>
        </div>
        <div className="summary-pill">
          <span>Completed</span>
          <strong>{transactions.filter((row) => String(row.status).toLowerCase() === 'completed' || String(row.status).toLowerCase() === 'success').length}</strong>
        </div>
      </div>

      {transactions.length === 0 ? (
        <div className="empty-state">No transactions have been recorded yet.</div>
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
              {transactions.map((row) => (
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    fetchAdminData('support')
      .then((payload) => {
        if (active) setTickets(payload.tickets || []);
      })
      .catch(() => {
        if (active) setTickets([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const prioritySummary = {
    high: tickets.filter((ticket) => getPriorityTone(ticket.priority) === 'high').length,
    medium: tickets.filter((ticket) => getPriorityTone(ticket.priority) === 'medium').length,
    low: tickets.filter((ticket) => getPriorityTone(ticket.priority) === 'low').length,
  };

  if (loading) {
    return <div className="state-box">Loading support…</div>;
  }

  return (
    <div className="panel">
      <div className="panel-header">
        <div>
          <h3>Customer support</h3>
          <p className="section-note">Resolve user issues and operational requests</p>
        </div>
        <div className="page-actions">
          <button type="button" className="secondary-button">Inbox</button>
          <button type="button" className="primary-button">New ticket</button>
        </div>
      </div>

      <div className="summary-strip">
        <div className="summary-pill"><span>High priority</span><strong>{prioritySummary.high}</strong></div>
        <div className="summary-pill"><span>Medium</span><strong>{prioritySummary.medium}</strong></div>
        <div className="summary-pill"><span>Low</span><strong>{prioritySummary.low}</strong></div>
      </div>

      {tickets.length === 0 ? (
        <div className="empty-state">No customer support tickets have been created yet.</div>
      ) : (
        <div className="stack-list">
          {tickets.map((ticket) => (
            <div key={ticket.id} className="list-item large">
              <div>
                <strong>{ticket.customer}</strong>
                <p>{ticket.email}</p>
              </div>
              <div className="subject-wrap">
                <span>{ticket.subject}</span>
              </div>
              <span className={`priority-badge ${getPriorityTone(ticket.priority)}`}>{ticket.priority || 'Medium'}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SettingsPage() {
  const settingsCards = [
    {
      title: 'Security',
      description: 'Require multi-factor authentication for all admins and super-admins.',
    },
    {
      title: 'Notifications',
      description: 'Send daily account health and wallet alerts to the operations team.',
    },
    {
      title: 'Risk rules',
      description: 'Auto-flag wallet anomalies and suspicious onboarding patterns.',
    },
  ];

  return (
    <div className="panel settings-panel">
      <div className="panel-header">
        <div>
          <h3>Admin settings</h3>
          <p className="section-note">Control the security and operational preferences of GWIC admin</p>
        </div>
        <button type="button" className="secondary-button">Save changes</button>
      </div>
      <div className="settings-grid">
        {settingsCards.map((setting) => (
          <div key={setting.title} className="setting-box">
            <h4>{setting.title}</h4>
            <p>{setting.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;
