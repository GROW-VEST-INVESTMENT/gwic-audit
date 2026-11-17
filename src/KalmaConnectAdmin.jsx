import { useEffect, useState } from 'react';
import { Activity, BarChart3, BriefcaseBusiness, Check, Clock3, Plus, RefreshCw, Search, ShieldCheck, Users, WalletCards, X } from 'lucide-react';
import './KalmaConnectAdmin.css';

const API_BASE = import.meta.env.DEV
  ? (import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000').replace(/\/+$/, '')
  : '';
const tabs = [
  { id: 'overview', label: 'Overview', icon: BarChart3 },
  { id: 'applications', label: 'Applications', icon: Users },
  { id: 'opportunities', label: 'Opportunities', icon: BriefcaseBusiness },
  { id: 'partners', label: 'Partners', icon: ShieldCheck },
  { id: 'commissions', label: 'Earnings', icon: Clock3 },
  { id: 'payouts', label: 'Withdrawals', icon: WalletCards },
  { id: 'policy', label: 'Commission policy', icon: Search },
  { id: 'audit', label: 'Audit log', icon: Activity },
];
const roleOptions = [
  'Customer Care Assistant',
  'Marketing Assistant',
  'Business Development Personnel',
  'Community Manager',
  'Support Personnel',
  'Other',
];

async function api(path, { method = 'GET', body } = {}) {
  const response = await fetch(`${API_BASE}/api/admin/connect/${path}`, {
    method,
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    cache: 'no-store',
  });
  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new Error('The server returned an invalid response.');
  }
  if (!response.ok) throw new Error(payload?.message || 'Unable to load Kalma Connect data.');
  return payload;
}

function currency(value) {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(value || 0);
}

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-NG', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

export default function KalmaConnectAdmin() {
  const [activeTab, setActiveTab] = useState('overview');
  const [statusFilter, setStatusFilter] = useState('all');
  const [rows, setRows] = useState([]);
  const [overview, setOverview] = useState(null);
  const [policy, setPolicy] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [decision, setDecision] = useState(null);
  const [search, setSearch] = useState('');
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let active = true;
    const fetchData = async () => {
      try {
        if (activeTab === 'overview') {
          const result = await api('summary');
          if (active) setOverview(result.summary);
        } else if (activeTab === 'policy') {
          const result = await api('policy');
          if (active) {
            setPolicy(result.policy);
            setRows([]);
          }
        } else {
          const query = statusFilter === 'all' ? '' : `?status=${encodeURIComponent(statusFilter)}`;
          const result = await api(`${activeTab}${query}`);
          if (active) setRows(result[activeTab] || []);
        }
      } catch (reason) {
        if (active) setError(reason.message);
      } finally {
        if (active) setLoading(false);
      }
    };
    fetchData();
    return () => { active = false; };
  }, [activeTab, statusFilter, reloadToken]);

  const submitDecision = async (event) => {
    event.preventDefault();
    if (!decision) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const { record, status, reviewNote, assignedRole, interviewAt, paymentReference } = decision;
      if (activeTab === 'applications') {
        await api(`applications/${record._id}`, { method: 'PATCH', body: { status, reviewNote, assignedRole, interviewAt } });
      } else if (activeTab === 'commissions') {
        await api(`commissions/${record._id}`, { method: 'PATCH', body: { status, reviewNote } });
      } else if (activeTab === 'payouts') {
        await api(`payouts/${record._id}`, { method: 'PATCH', body: { status, reviewNote, paymentReference } });
      }
      setDecision(null);
      setNotice('The Connect record has been updated and audited.');
      setLoading(true);
      setReloadToken((current) => current + 1);
    } catch (reason) {
      setError(reason.message);
    } finally {
      setBusy(false);
    }
  };

  const updatePartner = async (partner) => {
    const status = partner.status === 'active' ? 'suspended' : 'active';
    setBusy(true);
    setError('');
    try {
      await api(`partners/${partner._id}`, { method: 'PATCH', body: { status } });
      setNotice(`Partner ${status === 'active' ? 'reactivated' : 'suspended'}.`);
      setLoading(true);
      setReloadToken((current) => current + 1);
    } catch (reason) {
      setError(reason.message);
    } finally {
      setBusy(false);
    }
  };

  const savePolicy = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    const formData = new FormData(event.currentTarget);
    try {
      const result = await api('policy', {
        method: 'PATCH',
        body: {
          registrationRewardNaira: Number(formData.get('registrationRewardNaira')),
          minimumPayoutNaira: Number(formData.get('minimumPayoutNaira')),
          registrationRewardEnabled: formData.get('registrationRewardEnabled') === 'on',
        },
      });
      setPolicy(result.policy);
      setNotice('Commission policy saved.');
    } catch (reason) {
      setError(reason.message);
    } finally {
      setBusy(false);
    }
  };

  const saveOpportunity = async (opportunity, opportunityId) => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await api(opportunityId ? `opportunities/${opportunityId}` : 'opportunities', {
        method: opportunityId ? 'PATCH' : 'POST',
        body: opportunity,
      });
      setNotice(opportunityId ? 'Opportunity updated.' : 'Opportunity saved.');
      setLoading(true);
      setReloadToken((current) => current + 1);
      return true;
    } catch (reason) {
      setError(reason.message);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const visibleRows = rows.filter((row) => {
    const text = [
      row.userId?.name,
      row.userId?.email,
      row.partnerId?.promoCode,
      row.partnerId?.userId?.name,
      row.promoCode,
      row.type,
      row.status,
    ].filter(Boolean).join(' ').toLowerCase();
    return text.includes(search.trim().toLowerCase());
  });

  return (
    <div className="connect-admin">
      <div className="connect-admin-heading">
        <div>
          <p className="connect-kicker">KALMA CAPITAL · CONNECT</p>
          <h2>Talent & partner operations</h2>
          <p>Review applications, manage partner activity and process payouts.</p>
        </div>
        <button type="button" className="connect-refresh" onClick={() => { setLoading(true); setError(''); setReloadToken((current) => current + 1); }} disabled={loading}><RefreshCw size={15} /> Refresh</button>
      </div>

      <div className="connect-tabs" role="tablist" aria-label="Connect management">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button type="button" role="tab" aria-selected={activeTab === id} className={activeTab === id ? 'selected' : ''} key={id} onClick={() => { setLoading(true); setPolicy(null); setActiveTab(id); setStatusFilter('all'); setSearch(''); setError(''); setNotice(''); }}>
            <Icon size={15} /><span>{label}</span>
          </button>
        ))}
      </div>

      {error && <div className="connect-alert error" role="alert">{error}<button type="button" onClick={() => setError('')} aria-label="Dismiss error"><X size={15} /></button></div>}
      {notice && <div className="connect-alert success" role="status">{notice}<button type="button" onClick={() => setNotice('')} aria-label="Dismiss message"><X size={15} /></button></div>}

      {activeTab === 'overview'
        ? <OverviewPanel summary={overview} loading={loading} />
        : activeTab === 'policy'
          ? <PolicyPanel policy={policy} loading={loading} busy={busy} onSubmit={savePolicy} />
          : activeTab === 'opportunities'
            ? <OpportunityPanel opportunities={rows} loading={loading} busy={busy} onSave={saveOpportunity} />
        : <section className="connect-panel">
          <div className="connect-panel-toolbar">
            <div><h3>{tabs.find((tab) => tab.id === activeTab)?.label}</h3><span>{loading ? 'Loading…' : `${visibleRows.length} records`}</span></div>
            {activeTab !== 'audit' && <div className="connect-filters">
              <label className="connect-search"><Search size={14} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search records" /></label>
              <select value={statusFilter} onChange={(event) => { setLoading(true); setError(''); setStatusFilter(event.target.value); }} aria-label="Filter by status">
                <option value="all">All statuses</option>
                {(activeTab === 'applications'
                  ? ['pending', 'in_review', 'interview_scheduled', 'approved', 'rejected']
                  : activeTab === 'partners'
                    ? ['active', 'suspended']
                    : activeTab === 'commissions'
                      ? ['pending', 'approved', 'rejected']
                      : ['pending', 'approved', 'rejected', 'paid']).map((status) => <option value={status} key={status}>{status.replaceAll('_', ' ')}</option>)}
              </select>
            </div>}
          </div>
          {loading ? <div className="connect-loading">Loading Connect records…</div>
            : visibleRows.length ? <div className="connect-records">{visibleRows.map((row) => renderRecord(activeTab, row, { setDecision, updatePartner, busy }))}</div>
              : <div className="connect-empty"><span>✦</span><strong>No records found</strong><p>There are no matching records for this filter.</p></div>}
        </section>}

      {decision && <DecisionDialog activeTab={activeTab} decision={decision} setDecision={setDecision} onSubmit={submitDecision} busy={busy} />}
    </div>
  );
}

function renderRecord(tab, row, actions) {
  if (tab === 'audit') return <AuditRecord key={row._id} row={row} />;
  if (tab === 'applications') return <ApplicationRecord key={row._id} row={row} openDecision={actions.setDecision} busy={actions.busy} />;
  if (tab === 'partners') return <PartnerRecord key={row._id} row={row} updatePartner={actions.updatePartner} busy={actions.busy} />;
  if (tab === 'commissions') return <CommissionRecord key={row._id} row={row} openDecision={actions.setDecision} />;
  return <PayoutRecord key={row._id} row={row} openDecision={actions.setDecision} />;
}

function OverviewPanel({ summary, loading }) {
  if (loading || !summary) return <div className="connect-panel connect-loading">Loading Kalma Connect overview…</div>;
  const cards = [
    ['Applicants & applications', summary.totalApplications, `${summary.pendingApplications} awaiting review`, '✦'],
    ['Approved associates', summary.approvedAssociates, 'Active assigned roles', '◎'],
    ['Active partners', summary.activePartners, `${summary.totalReferrals} total referrals`, '↗'],
    ['Pending commissions', currency(summary.pendingCommissionNaira), `${currency(summary.approvedCommissionNaira)} approved`, '₦'],
    ['Approved commissions', currency(summary.approvedCommissionNaira), 'Cleared for withdrawal', '✓'],
    ['Payouts paid', currency(summary.paidPayoutNaira), `${currency(summary.pendingPayoutNaira + summary.approvedPayoutNaira)} in the payout queue`, '◷'],
  ];
  return <div className="connect-overview">
    <div className="connect-overview-heading"><div><p className="connect-kicker">OPERATIONS SNAPSHOT</p><h3>Kalma Connect at a glance</h3></div><span>Live data from Connect records</span></div>
    <div className="connect-overview-grid">{cards.map(([label, value, caption, icon]) => <article className="connect-overview-card" key={label}><div><span>{label}</span><b>{icon}</b></div><strong>{value}</strong><small>{caption}</small></article>)}</div>
  </div>;
}

function AuditRecord({ row }) {
  const detail = Object.entries(row.details || {}).map(([key, value]) => `${key.replaceAll(/([A-Z])/g, ' $1').replaceAll('_', ' ')}: ${String(value)}`).join(' · ');
  return <article className="connect-record">
    <div className="connect-record-main"><span className="connect-record-icon audit"><Activity size={15} /></span><div className="connect-record-content">
      <div className="connect-record-title"><strong>{row.action.replaceAll('_', ' ')}</strong><span className="connect-status">{row.entityType}</span></div>
      <span>{row.actorId?.name || 'Staff member'} · {row.actorId?.email || '—'} · {formatDate(row.createdAt)}</span>
      {detail && <p className="connect-note">{detail}</p>}
    </div></div>
  </article>;
}

function ApplicationRecord({ row, openDecision, busy }) {
  return (
    <article className="connect-record">
      <div className="connect-record-main">
        <span className="connect-record-icon">{row.type === 'partner' ? '↗' : '✦'}</span>
        <div className="connect-record-content">
          <div className="connect-record-title"><strong>{row.userId?.name || 'Applicant'}</strong><Status status={row.status} /></div>
          <span>{row.userId?.email} {row.userId?.phone ? `· ${row.userId.phone}` : ''}</span>
          <p>{row.opportunityId?.title || (row.type === 'partner' ? 'Connect Partner' : row.roleInterest || 'Applicant')} · Submitted {formatDate(row.createdAt)}</p>
          {row.motivation && <details><summary>Read motivation</summary><p>{row.motivation}</p></details>}
          {row.experience && <p className="connect-note">Experience: {row.experience}</p>}
          {!!row.promotionChannels?.length && <p className="connect-note">Channels: {row.promotionChannels.join(', ').replaceAll('_', ' ')}</p>}
          {!!row.documents?.length && <div className="connect-document-list">{row.documents.map((document) => <a
            key={document._id}
            href={`${API_BASE}/api/admin/connect/applications/${row._id}/documents/${document._id}`}
            target="_blank"
            rel="noreferrer"
          >Download {document.name}</a>)}</div>}
          {row.reviewNote && <p className="connect-note">Review note: {row.reviewNote}</p>}
        </div>
      </div>
      <div className="connect-record-actions">
        {row.active && <>
          <button type="button" className="connect-button light" disabled={busy} onClick={() => openDecision({ record: row, status: 'in_review' })}>Review</button>
          <button type="button" className="connect-button" disabled={busy} onClick={() => openDecision({ record: row, status: 'approved' })}>Approve</button>
          <button type="button" className="connect-button danger" disabled={busy} onClick={() => openDecision({ record: row, status: 'rejected' })}>Reject</button>
        </>}
        {row.status === 'pending' && <button type="button" className="connect-link-button" disabled={busy} onClick={() => openDecision({ record: row, status: 'interview_scheduled' })}>Schedule interview</button>}
      </div>
    </article>
  );
}

function OpportunityPanel({ opportunities, loading, busy, onSave }) {
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const emptyOpportunity = {
    title: '',
    summary: '',
    description: '',
    type: 'role',
    requirements: '',
    benefits: '',
    positionsAvailable: 1,
    maximumApplications: 150,
    deadline: '',
    status: 'draft',
  };
  const [form, setForm] = useState(emptyOpportunity);
  const openNew = () => {
    setForm(emptyOpportunity);
    setEditing(null);
    setShowForm(true);
  };
  const edit = (opportunity) => {
    setForm({
      title: opportunity.title,
      summary: opportunity.summary,
      description: opportunity.description,
      type: opportunity.type,
      requirements: opportunity.requirements || '',
      benefits: opportunity.benefits || '',
      positionsAvailable: opportunity.positionsAvailable,
      maximumApplications: opportunity.maximumApplications,
      deadline: opportunity.deadline ? new Date(opportunity.deadline).toISOString().slice(0, 10) : '',
      status: opportunity.status,
    });
    setEditing(opportunity.id);
    setShowForm(true);
  };
  const setField = (field) => (event) => {
    const value = event.target.value;
    setForm((current) => ({
      ...current,
      [field]: ['positionsAvailable', 'maximumApplications'].includes(field) ? Number(value) : value,
      ...(field === 'type' && value === 'announcement' ? { positionsAvailable: 0, maximumApplications: 0 } : {}),
      ...(field === 'type' && value !== 'announcement' && current.type === 'announcement' ? { positionsAvailable: 1, maximumApplications: 150 } : {}),
    }));
  };
  const submit = async (event) => {
    event.preventDefault();
    if (await onSave({ ...form, deadline: form.deadline || null }, editing)) setShowForm(false);
  };
  return <section className="connect-panel connect-opportunities">
    <div className="connect-panel-toolbar">
      <div><h3>Opportunity feed</h3><span>{loading ? 'Loading…' : `${opportunities.length} published and draft posts`}</span></div>
      <button type="button" className="connect-button" onClick={openNew}><Plus size={15} /> Create opportunity</button>
    </div>
    {showForm && <form className="connect-opportunity-form" onSubmit={submit}>
      <div className="connect-opportunity-form-heading"><div><p className="connect-kicker">STAFF PUBLISHED CONTENT</p><h4>{editing ? 'Edit opportunity' : 'Create opportunity'}</h4></div><button type="button" aria-label="Close opportunity form" onClick={() => setShowForm(false)}><X size={16} /></button></div>
      <div className="connect-opportunity-fields">
        <label>Post type<select required value={form.type} onChange={setField('type')}><option value="role">Career opportunity</option><option value="partner">Partner program</option><option value="announcement">Announcement</option></select></label>
        <label>Publication status<select required value={form.status} onChange={setField('status')}><option value="draft">Draft</option><option value="open">Publish now</option><option value="closed">Closed</option></select></label>
        <label>Title<input required minLength={5} maxLength={120} value={form.title} onChange={setField('title')} /></label>
        <label>Short summary<input required minLength={10} maxLength={240} value={form.summary} onChange={setField('summary')} /></label>
        <label className="wide">Description<textarea required minLength={30} maxLength={6000} rows="5" value={form.description} onChange={setField('description')} /></label>
        <label>Requirements<textarea maxLength={3000} rows="4" value={form.requirements} onChange={setField('requirements')} /></label>
        <label>Benefits<textarea maxLength={3000} rows="4" value={form.benefits} onChange={setField('benefits')} /></label>
        {form.type !== 'announcement' && <>
          <label>Positions available<input type="number" required min="1" max="10000" value={form.positionsAvailable} onChange={setField('positionsAvailable')} /></label>
          <label>Maximum applications<input type="number" required min={form.positionsAvailable} max="1000000" value={form.maximumApplications} onChange={setField('maximumApplications')} /></label>
        </>}
        <label>Application deadline<input type="date" value={form.deadline} onChange={setField('deadline')} /></label>
      </div>
      <div className="connect-modal-actions"><button type="button" className="connect-button light" onClick={() => setShowForm(false)}>Cancel</button><button type="submit" className="connect-button" disabled={busy}>{busy ? 'Saving…' : editing ? 'Save changes' : 'Save post'} <Check size={15} /></button></div>
    </form>}
    {loading ? <div className="connect-loading">Loading opportunities…</div>
      : opportunities.length ? <div className="connect-records">{opportunities.map((opportunity) => <article className="connect-record" key={opportunity.id}>
        <div className="connect-record-main"><span className="connect-record-icon"><BriefcaseBusiness size={15} /></span><div className="connect-record-content">
          <div className="connect-record-title"><strong>{opportunity.title}</strong><Status status={opportunity.status} /><span className="connect-status">{opportunity.type}</span></div>
          <span>{opportunity.summary}</span>
          <p>{opportunity.type === 'announcement' ? 'Announcement' : `${opportunity.applicationCount} / ${opportunity.maximumApplications} applications · ${opportunity.positionsAvailable} positions`} · {opportunity.interestedCount} interested</p>
          {opportunity.deadline && <p className="connect-note">Deadline: {formatDate(opportunity.deadline)}</p>}
        </div></div>
        <div className="connect-record-actions"><button type="button" className="connect-button light" disabled={busy} onClick={() => edit(opportunity)}>Edit / manage</button></div>
      </article>)}</div>
      : <div className="connect-empty"><span>✦</span><strong>No opportunities created</strong><p>Publish a role, partner program or announcement to the Connect feed.</p></div>}
  </section>;
}

function PartnerRecord({ row, updatePartner, busy }) {
  const user = row.userId || {};
  return <article className="connect-record">
    <div className="connect-record-main"><span className="connect-record-icon partner">↗</span><div className="connect-record-content">
      <div className="connect-record-title"><strong>{user.name || 'Partner'}</strong><Status status={row.status} /></div>
      <span>{user.email}</span><p>Code <b>{row.promoCode}</b> · {row.referralCount || 0} referrals · Joined {formatDate(row.createdAt)}</p>
      <p className="connect-note">Approved earnings: {currency(row.earnings?.approved || 0)} · Pending: {currency(row.earnings?.pending || 0)}</p>
      {row.statusNote && <p className="connect-note">Status note: {row.statusNote}</p>}
    </div></div>
    <div className="connect-record-actions"><button type="button" className={row.status === 'active' ? 'connect-button danger' : 'connect-button'} disabled={busy} onClick={() => updatePartner(row)}>{row.status === 'active' ? 'Suspend' : 'Reactivate'}</button></div>
  </article>;
}

function CommissionRecord({ row, openDecision }) {
  const partner = row.partnerId || {};
  return <article className="connect-record">
    <div className="connect-record-main"><span className="connect-record-icon earnings">₦</span><div className="connect-record-content">
      <div className="connect-record-title"><strong>{currency(row.amountNaira)} · Registration reward</strong><Status status={row.status} /></div>
      <span>{partner.userId?.name || 'Partner'} · {partner.userId?.email || partner.promoCode || '—'}</span><p>Referral activity submitted {formatDate(row.createdAt)}</p>
      {row.reviewNote && <p className="connect-note">Review note: {row.reviewNote}</p>}
    </div></div>
    {row.status === 'pending' && <div className="connect-record-actions"><button type="button" className="connect-button" onClick={() => openDecision({ record: row, status: 'approved' })}>Approve</button><button type="button" className="connect-button danger" onClick={() => openDecision({ record: row, status: 'rejected' })}>Reject</button></div>}
  </article>;
}

function PayoutRecord({ row, openDecision }) {
  const user = row.userId || {};
  const bank = row.linkedBankId || {};
  return <article className="connect-record">
    <div className="connect-record-main"><span className="connect-record-icon payout">₦</span><div className="connect-record-content">
      <div className="connect-record-title"><strong>{currency(row.amountNaira)}</strong><Status status={row.status} /></div>
      <span>{user.name || 'Partner'} · {user.email}</span><p>{bank.bankName || row.bankName || 'Linked bank'} ···· {bank.accountLast4 || row.accountLast4 || '—'} · Requested {formatDate(row.createdAt)}</p>
      {row.reviewNote && <p className="connect-note">Note: {row.reviewNote}</p>}
      {row.paymentReference && <p className="connect-note">Payment reference: {row.paymentReference}</p>}
    </div></div>
    <div className="connect-record-actions">
      {row.status === 'pending' && <><button type="button" className="connect-button" onClick={() => openDecision({ record: row, status: 'approved' })}>Approve</button><button type="button" className="connect-button danger" onClick={() => openDecision({ record: row, status: 'rejected' })}>Reject</button></>}
      {row.status === 'approved' && <button type="button" className="connect-button" onClick={() => openDecision({ record: row, status: 'paid' })}>Mark paid</button>}
    </div>
  </article>;
}

function PolicyPanel({ policy, loading, busy, onSubmit }) {
  if (loading || !policy) return <div className="connect-panel connect-loading">Loading commission policy…</div>;
  return <form className="connect-panel connect-policy" onSubmit={onSubmit}>
    <div className="connect-panel-toolbar"><div><h3>Commission policy</h3><span>Configure approved registration rewards and withdrawal minimums.</span></div></div>
    {!policy.rewardsMayBeEnabled && <div className="connect-policy-notice"><ShieldCheck size={17} /><span>Registration rewards are locked until compliance approval is configured on the backend. Referrals will still be tracked; savings and deposit commissions are not active.</span></div>}
    <div className="connect-policy-fields">
      <label>Registration reward (NGN)<input type="number" min="0" max="100000000" step="1" name="registrationRewardNaira" defaultValue={policy.registrationRewardNaira} /></label>
      <label>Minimum withdrawal (NGN)<input type="number" min="1" max="10000000" step="1" name="minimumPayoutNaira" defaultValue={policy.minimumPayoutNaira} /></label>
      <label className={`connect-toggle ${!policy.rewardsMayBeEnabled ? 'disabled' : ''}`}><input type="checkbox" name="registrationRewardEnabled" defaultChecked={policy.registrationRewardEnabled} disabled={!policy.rewardsMayBeEnabled} /><span><b>Enable registration rewards</b><small>New eligible referrals create a pending commission for review.</small></span></label>
    </div>
    <button className="connect-button" type="submit" disabled={busy}>Save policy</button>
  </form>;
}

function DecisionDialog({ activeTab, decision, setDecision, onSubmit, busy }) {
  const { record, status } = decision;
  const setField = (field) => (event) => setDecision((current) => ({ ...current, [field]: event.target.value }));
  let title = `${status.replaceAll('_', ' ')} ${activeTab === 'applications' ? 'application' : activeTab === 'commissions' ? 'commission' : 'withdrawal'}`;
  if (status === 'approved' && activeTab === 'applications') title = record.type === 'partner' ? 'Approve Connect Partner' : 'Approve applicant';
  return <div className="connect-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setDecision(null); }}>
    <section className="connect-modal" role="dialog" aria-modal="true" aria-labelledby="connect-modal-title">
      <div className="connect-modal-heading"><div><p className="connect-kicker">KALMA CONNECT REVIEW</p><h3 id="connect-modal-title">{title}</h3></div><button type="button" aria-label="Close dialog" onClick={() => setDecision(null)}><X size={18} /></button></div>
      <form onSubmit={onSubmit} className="connect-modal-form">
        <p className="connect-modal-target">{record.userId?.name || record.partnerId?.userId?.name || `Record ${record._id?.slice(-6)}`}{record.userId?.email ? ` · ${record.userId.email}` : ''}</p>
        {activeTab === 'payouts' && status === 'paid' && <p className="connect-payment-warning">Confirm the external payment is complete before marking this withdrawal paid.</p>}
        {activeTab === 'applications' && status === 'approved' && record.type === 'applicant' && <label>Assigned role<select required value={decision.assignedRole || record.roleInterest || ''} onChange={setField('assignedRole')}><option value="" disabled>Select role</option>{roleOptions.map((role) => <option key={role}>{role}</option>)}{record.roleInterest && !roleOptions.includes(record.roleInterest) && <option>{record.roleInterest}</option>}</select></label>}
        {activeTab === 'applications' && status === 'interview_scheduled' && <label>Interview date and time<input type="datetime-local" required value={decision.interviewAt || ''} onChange={setField('interviewAt')} /></label>}
        {activeTab === 'payouts' && status === 'paid' && <label>Payment reference<input required maxLength={120} value={decision.paymentReference || ''} onChange={setField('paymentReference')} placeholder="Bank transfer or payment reference" /></label>}
        <label>Staff note <span>Optional</span><textarea rows="3" maxLength={1000} value={decision.reviewNote || ''} onChange={setField('reviewNote')} placeholder="Add a note for the applicant or audit history…" /></label>
        <div className="connect-modal-actions"><button type="button" className="connect-button light" onClick={() => setDecision(null)}>Cancel</button><button type="submit" className="connect-button" disabled={busy}>{busy ? 'Saving…' : 'Confirm decision'} <Check size={15} /></button></div>
      </form>
    </section>
  </div>;
}

function Status({ status }) {
  return <span className={`connect-status ${status}`}>{String(status || 'unknown').replaceAll('_', ' ')}</span>;
}
