import { useCallback, useEffect, useState } from 'react';
import { Activity, BarChart3, BriefcaseBusiness, Check, Clock3, IdCard, MessageSquareText, Plus, RefreshCw, Search, ShieldCheck, Users, WalletCards, X } from 'lucide-react';
import './KalmaConnectAdmin.css';

const API_BASE = import.meta.env.DEV
  ? (import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000').replace(/\/+$/, '')
  : '';
const tabs = [
  { id: 'overview', label: 'Overview', icon: BarChart3 },
  { id: 'applications', label: 'Applications', icon: Users },
  { id: 'inbox', label: 'Recruitment inbox', icon: MessageSquareText },
  { id: 'id-cards', label: 'Associate ID cards', icon: IdCard },
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
const weekdayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const payoutDaysLabel = (days = [1]) => days.map((day) => weekdayNames[day]).filter(Boolean).join(', ');
const isTodayPayoutDay = (days = [1]) => {
  const today = new Intl.DateTimeFormat('en-US', { timeZone: 'Africa/Lagos', weekday: 'short' }).format(new Date());
  return days.includes(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(today));
};

async function api(path, { method = 'GET', body, formData } = {}) {
  const response = await fetch(`${API_BASE}/api/admin/connect/${path}`, {
    method,
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    ...(formData === undefined ? {} : { body: formData }),
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
  const [selectedConversationId, setSelectedConversationId] = useState('');
  const [unreadInboxCount, setUnreadInboxCount] = useState(0);
  const refreshConnectData = useCallback(() => setReloadToken((current) => current + 1), []);

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
        } else if (activeTab === 'inbox') {
          const result = await api('inbox');
          if (active) {
            const conversations = result.conversations || [];
            setRows(conversations);
            setUnreadInboxCount(conversations.reduce((total, conversation) => total + conversation.unreadCount, 0));
          }
        } else if (activeTab === 'id-cards') {
          const query = statusFilter === 'all' ? '' : `?status=${encodeURIComponent(statusFilter)}`;
          const result = await api(`id-cards${query}`);
          if (active) setRows(result.idCards || []);
        } else {
          const query = statusFilter === 'all' ? '' : `?status=${encodeURIComponent(statusFilter)}`;
          if (activeTab === 'payouts') {
            const [result, policyResult] = await Promise.all([api(`${activeTab}${query}`), api('policy')]);
            if (active) {
              setRows(result.payouts || []);
              setPolicy(policyResult.policy);
            }
          } else {
            const result = await api(`${activeTab}${query}`);
            if (active) setRows(result[activeTab] || []);
          }
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
      const { record, status, reviewNote, assignedRole, interviewAt, otp, paymentReference } = decision;
      if (activeTab === 'applications') {
        await api(`applications/${record._id}`, { method: 'PATCH', body: { status, reviewNote, assignedRole, interviewAt } });
      } else if (activeTab === 'commissions') {
        await api(`commissions/${record._id}`, { method: 'PATCH', body: { status, reviewNote } });
      } else if (activeTab === 'payouts') {
        if (status === 'otp') {
          await api(`payouts/${record._id}/otp`, { method: 'POST', body: { otp } });
        } else if (status === 'reconcile') {
          await api(`payouts/${record._id}/reconcile`, { method: 'POST' });
        } else {
          await api(`payouts/${record._id}`, { method: 'PATCH', body: { status, reviewNote, paymentReference } });
        }
      }
      setDecision(null);
      setNotice(activeTab === 'payouts' && status === 'approved'
        ? 'Withdrawal approved and submitted to Paystack. It will be marked paid after provider confirmation.'
        : activeTab === 'payouts' && status === 'otp'
          ? 'Paystack accepted the OTP. The transfer will be marked paid after provider confirmation.'
          : activeTab === 'payouts' && status === 'paid'
            ? 'The historical withdrawal payment was recorded.'
          : activeTab === 'payouts' && status === 'reconcile'
            ? 'Paystack transfer status refreshed.'
            : 'The Connect record has been updated and audited.');
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
          kycRewardNaira: Number(formData.get('kycRewardNaira')),
          firstDepositRewardNaira: Number(formData.get('firstDepositRewardNaira')),
          activeSaverBonusNaira: Number(formData.get('activeSaverBonusNaira')),
          minimumPayoutNaira: Number(formData.get('minimumPayoutNaira')),
          payoutDays: formData.getAll('payoutDays').map(Number),
          milestoneRewardsEnabled: formData.get('milestoneRewardsEnabled') === 'on',
        },
      });
      setPolicy(result.policy);
      setNotice('Commission and payout schedule saved.');
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

  const reviewIdCard = async (record, status, reviewNote) => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await api(`id-cards/${record.id}`, { method: 'PATCH', body: { status, reviewNote } });
      setNotice(status === 'approved'
        ? 'Associate ID card approved and issued.'
        : status === 'revoked'
          ? 'ID card unissued. Its QR verification now reports it as unissued.'
          : `ID card request marked ${status.replaceAll('_', ' ')}.`);
      setLoading(true);
      setReloadToken((current) => current + 1);
    } catch (reason) {
      setError(reason.message);
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
            <Icon size={15} /><span>{label}</span>{id === 'inbox' && unreadInboxCount > 0 && <i className="connect-tab-unread" />}
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
            : activeTab === 'inbox'
              ? <InboxPanel conversations={rows} loading={loading} busy={busy} initialApplicationId={selectedConversationId} onRefresh={refreshConnectData} />
              : activeTab === 'id-cards'
                ? <IdCardPanel rows={rows} loading={loading} busy={busy} onReview={reviewIdCard} />
        : <section className="connect-panel">
          <div className="connect-panel-toolbar">
            <div><h3>{tabs.find((tab) => tab.id === activeTab)?.label}</h3><span>{loading ? 'Loading…' : `${visibleRows.length} records`}</span></div>
            {activeTab === 'payouts' && policy && <span className="connect-payout-schedule">Payout days: {payoutDaysLabel(policy.payoutDays)} · West Africa Time</span>}
            {activeTab !== 'audit' && <div className="connect-filters">
              <label className="connect-search"><Search size={14} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search records" /></label>
              <select value={statusFilter} onChange={(event) => { setLoading(true); setError(''); setStatusFilter(event.target.value); }} aria-label="Filter by status">
                <option value="all">All statuses</option>
                {(activeTab === 'applications'
                  ? ['pending', 'in_review', 'interview_scheduled', 'approved', 'rejected']
                  : activeTab === 'id-cards'
                    ? ['pending', 'changes_requested', 'approved', 'revoked', 'rejected']
                  : activeTab === 'partners'
                    ? ['active', 'suspended']
                    : activeTab === 'commissions'
                      ? ['pending', 'approved', 'rejected']
                      : ['pending', 'approved', 'processing', 'requires_otp', 'rejected', 'paid', 'failed', 'reversed']).map((status) => <option value={status} key={status}>{status.replaceAll('_', ' ')}</option>)}
              </select>
            </div>}
          </div>
          {loading ? <div className="connect-loading">Loading Connect records…</div>
            : visibleRows.length ? <div className="connect-records">{visibleRows.map((row) => renderRecord(activeTab, row, { setDecision, updatePartner, busy, payoutDays: policy?.payoutDays, openInbox: (applicationId) => { setSelectedConversationId(applicationId); setActiveTab('inbox'); } }))}</div>
              : <div className="connect-empty"><span>✦</span><strong>No records found</strong><p>There are no matching records for this filter.</p></div>}
        </section>}

      {decision && <DecisionDialog activeTab={activeTab} decision={decision} setDecision={setDecision} onSubmit={submitDecision} busy={busy} />}
    </div>
  );
}

function renderRecord(tab, row, actions) {
  if (tab === 'audit') return <AuditRecord key={row._id} row={row} />;
  if (tab === 'applications') return <ApplicationRecord key={row._id} row={row} openDecision={actions.setDecision} openInbox={actions.openInbox} busy={actions.busy} />;
  if (tab === 'partners') return <PartnerRecord key={row._id} row={row} updatePartner={actions.updatePartner} busy={actions.busy} />;
  if (tab === 'commissions') return <CommissionRecord key={row._id} row={row} openDecision={actions.setDecision} />;
  return <PayoutRecord key={row._id} row={row} openDecision={actions.setDecision} payoutDays={actions.payoutDays} />;
}

function OverviewPanel({ summary, loading }) {
  if (loading || !summary) return <div className="connect-panel connect-loading">Loading Kalma Connect overview…</div>;
  const cards = [
    ['Applicants & applications', summary.totalApplications, `${summary.pendingApplications} active applications`, '✦'],
    ['Open opportunities', summary.openOpportunities, 'Published and accepting activity', '◎'],
    ['Unread applicant messages', summary.unreadApplicantMessages, 'Waiting in the recruitment inbox', '✉'],
    ['Approved associates', summary.approvedAssociates, 'Active assigned roles', '◎'],
    ['Active partners', summary.activePartners, `${summary.totalReferrals} total referrals`, '↗'],
    ['Pending commissions', currency(summary.pendingCommissionNaira), `${currency(summary.approvedCommissionNaira)} approved`, '₦'],
    ['Approved commissions', currency(summary.approvedCommissionNaira), 'Cleared for withdrawal', '✓'],
    ['Payouts paid', currency(summary.paidPayoutNaira), `${currency((summary.pendingPayoutNaira || 0) + (summary.approvedPayoutNaira || 0) + (summary.processingPayoutNaira || 0))} in the payout queue`, '◷'],
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
      <span>{row.actorId?.name || (row.action.startsWith('payout_transfer_') ? 'Paystack' : 'Staff member')} · {row.actorId?.email || '—'} · {formatDate(row.createdAt)}</span>
      {detail && <p className="connect-note">{detail}</p>}
    </div></div>
  </article>;
}

function ApplicationRecord({ row, openDecision, openInbox, busy }) {
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
        <button type="button" className="connect-button light" disabled={busy} onClick={() => openInbox(row._id)}>Open conversation</button>
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

function IdCardPanel({ rows, loading, busy, onReview }) {
  const [notes, setNotes] = useState({});
  return <section className="connect-id-card-panel">
    <header><div><h3>Associate ID card requests</h3><span>{loading ? 'Loading requests…' : `${rows.length} requests`}</span></div></header>
    {loading ? <div className="connect-loading">Loading ID card requests…</div>
      : rows.length ? <div className="connect-id-card-list">{rows.map((request) => <article className="connect-id-card-request" key={request.id}>
        <img crossOrigin="use-credentials" src={`${API_BASE}${request.photoUrl}`} alt={`${request.name || 'Associate'} ID request photo`} loading="lazy" />
        <div className="connect-id-card-details">
          <div className="connect-id-card-heading"><div><h4>{request.name || 'Associate'}</h4><small>{request.email}</small></div><Status status={request.status} /></div>
          <p><strong>Assigned role:</strong> {request.assignedRole || 'Not listed'}</p>
          <p><strong>Submitted:</strong> {formatDate(request.createdAt)}</p>
          {request.employeeId && <p><strong>Staff ID:</strong> {request.employeeId}</p>}
          {request.reviewNote && <div className="connect-id-card-note"><strong>Previous review note</strong><p>{request.reviewNote}</p></div>}
          {request.status === 'pending' && <div className="connect-id-card-review">
            <label htmlFor={`id-card-note-${request.id}`}>Review note</label>
            <textarea id={`id-card-note-${request.id}`} maxLength="500" value={notes[request.id] || ''} onChange={(event) => setNotes((current) => ({ ...current, [request.id]: event.target.value }))} placeholder="Explain what needs updating, if applicable…" />
            <div>
              <button type="button" className="connect-button" onClick={() => onReview(request, 'approved', notes[request.id] || '')} disabled={busy}>Approve and issue</button>
              <button type="button" className="connect-button light" onClick={() => onReview(request, 'changes_requested', notes[request.id] || '')} disabled={busy || !notes[request.id]?.trim()}>Request changes</button>
              <button type="button" className="connect-button danger" onClick={() => onReview(request, 'rejected', notes[request.id] || '')} disabled={busy}>Reject</button>
            </div>
          </div>}
          {request.status === 'approved' && <div className="connect-id-card-review connect-id-card-unissue">
            <label htmlFor={`id-card-unissue-note-${request.id}`}>Reason for unissuing</label>
            <textarea id={`id-card-unissue-note-${request.id}`} maxLength="500" value={notes[request.id] || ''} onChange={(event) => setNotes((current) => ({ ...current, [request.id]: event.target.value }))} placeholder="A reason is required and will be included in the audit record…" />
            <small>Unissuing immediately changes QR verification to “Card unissued.” The associate will also be notified.</small>
            <div><button type="button" className="connect-button danger" onClick={() => onReview(request, 'revoked', notes[request.id] || '')} disabled={busy || !notes[request.id]?.trim()}>Unissue card</button></div>
          </div>}
        </div>
      </article>)}</div>
        : <div className="connect-empty"><strong>No ID card requests</strong><p>Requests from eligible active associates will appear here for review.</p></div>}
  </section>;
}

function InboxPanel({ conversations, loading, busy, initialApplicationId, onRefresh }) {
  const [selectedId, setSelectedId] = useState(initialApplicationId ? String(initialApplicationId) : '');
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [attachmentError, setAttachmentError] = useState('');
  const [threadLoading, setThreadLoading] = useState(Boolean(initialApplicationId));
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState('');
  const [threadError, setThreadError] = useState('');
  const [hasOlderMessages, setHasOlderMessages] = useState(false);
  const [nextMessageCursor, setNextMessageCursor] = useState('');
  const [loadingOlder, setLoadingOlder] = useState(false);

  useEffect(() => {
    if (!selectedId) return;
    let active = true;
    api(`applications/${selectedId}/messages`)
      .then((result) => { if (active) { setMessages(result.messages || []); setHasOlderMessages(Boolean(result.hasMore)); setNextMessageCursor(result.nextBefore || ''); onRefresh(); } })
      .catch((reason) => { if (active) setThreadError(reason.message); })
      .finally(() => { if (active) setThreadLoading(false); });
    return () => { active = false; };
  }, [selectedId, onRefresh]);

  const send = async (event) => {
    event.preventDefault();
    if (!selectedId || (!draft.trim() && !attachments.length) || sending || busy) return;
    setSending(true);
    setThreadError('');
    try {
      const path = `applications/${selectedId}/messages`;
      const result = attachments.length
        ? await api(path, {
          method: 'POST',
          formData: (() => {
            const formData = new FormData();
            formData.append('body', draft);
            attachments.forEach((file) => formData.append('images', file));
            return formData;
          })(),
        })
        : await api(path, { method: 'POST', body: { body: draft } });
      setMessages((current) => [...current, result.message]);
      setDraft('');
      setAttachments([]);
      setAttachmentError('');
      onRefresh();
    } catch (reason) {
      setThreadError(reason.message);
    } finally {
      setSending(false);
    }
  };

  const selectAttachments = (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (files.length > 3) {
      setAttachments([]);
      setAttachmentError('Attach no more than three images to one message.');
      return;
    }
    if (files.some((file) => file.size > 5 * 1024 * 1024) || files.reduce((total, file) => total + file.size, 0) > 10 * 1024 * 1024) {
      setAttachments([]);
      setAttachmentError('Each image must be 5 MB or smaller, and all images together must be 10 MB or smaller.');
      return;
    }
    if (files.some((file) => !['image/jpeg', 'image/png', 'image/webp'].includes(file.type))) {
      setAttachments([]);
      setAttachmentError('Choose PNG, JPEG, or WebP images.');
      return;
    }
    setAttachmentError('');
    setAttachments(files);
  };

  const loadOlder = async () => {
    if (!selectedId || !nextMessageCursor || loadingOlder) return;
    setLoadingOlder(true);
    setThreadError('');
    try {
      const result = await api(`applications/${selectedId}/messages?before=${encodeURIComponent(nextMessageCursor)}`);
      setMessages((current) => [...(result.messages || []), ...current]);
      setHasOlderMessages(Boolean(result.hasMore));
      setNextMessageCursor(result.nextBefore || '');
    } catch (reason) {
      setThreadError(reason.message);
    } finally {
      setLoadingOlder(false);
    }
  };

  const visibleConversations = conversations.filter((conversation) => {
    const text = `${conversation.applicant?.name || ''} ${conversation.applicant?.email || ''} ${conversation.opportunityTitle || ''}`.toLowerCase();
    return text.includes(search.trim().toLowerCase());
  });
  const selected = conversations.find((conversation) => String(conversation.applicationId) === String(selectedId));
  const unreadCount = conversations.reduce((total, conversation) => total + conversation.unreadCount, 0);

  return <section className="connect-inbox-panel">
    <aside className="connect-inbox-list">
      <div className="connect-inbox-list-heading"><div><p className="connect-kicker">PRIVATE APPLICANT THREADS</p><h3>Recruitment inbox</h3><small>{unreadCount ? `${unreadCount} unread message${unreadCount === 1 ? '' : 's'}` : 'All caught up'}</small></div><span>{conversations.length}</span></div>
      <label className="connect-inbox-search"><Search size={14} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search applicants or roles" /></label>
      {loading ? <div className="connect-loading">Loading conversations…</div>
        : visibleConversations.length ? visibleConversations.map((conversation) => <button type="button" className={String(conversation.applicationId) === String(selectedId) ? 'connect-inbox-item selected' : 'connect-inbox-item'} key={conversation.applicationId} onClick={() => { setThreadError(''); setThreadLoading(true); setSelectedId(String(conversation.applicationId)) }}>
        <span className="connect-inbox-avatar">{conversation.applicant?.name?.[0]?.toUpperCase() || 'A'}</span><span className="connect-inbox-copy"><strong>{conversation.applicant?.name || 'Applicant'}</strong><small className="connect-inbox-role">{conversation.opportunityTitle}</small><small className="connect-inbox-preview">{conversation.latestMessage?.body || (conversation.latestMessage?.attachments?.length ? 'Image attachment' : 'Start the conversation with this applicant.')}</small><small className="connect-inbox-time">{conversation.latestMessage ? formatDate(conversation.latestMessage.createdAt) : 'No messages yet'}</small></span>{conversation.unreadCount > 0 && <span className="connect-inbox-unread">{conversation.unreadCount}</span>}
        </button>)
          : <div className="connect-empty"><strong>No conversations found</strong><p>Application conversations will appear here.</p></div>}
    </aside>
    <section className="connect-inbox-thread">
      {selected ? <>
        <header className="connect-inbox-thread-heading"><div><p className="connect-kicker">PRIVATE RECRUITMENT CONVERSATION</p><h3>{selected.applicant?.name || 'Applicant'}</h3><span>{selected.opportunityTitle} · {selected.applicant?.email || 'No email available'}</span></div><Status status={selected.applicationStatus} /></header>
        {threadError && <div className="connect-alert error connect-inbox-error" role="alert">{threadError}</div>}
        <div className="connect-inbox-messages" aria-live="polite">
          {threadLoading ? <div className="connect-loading">Loading thread…</div>
            : <>{hasOlderMessages && <button type="button" className="connect-load-older" onClick={loadOlder} disabled={loadingOlder}>{loadingOlder ? 'Loading earlier messages…' : 'Load earlier messages'}</button>}{messages.length ? messages.map((message) => <article className={`connect-inbox-message ${message.senderRole}`} key={message.id}><small><span>{message.senderRole === 'staff' ? 'Kalma Connect team · You' : message.senderRole === 'applicant' ? selected.applicant?.name || 'Applicant' : 'System update'}</span><time dateTime={message.createdAt}>{formatDate(message.createdAt)}</time></small>{message.body && <p>{message.body}</p>}{message.attachments?.length > 0 && <div className="connect-inbox-image-grid">{message.attachments.map((attachment) => <a key={attachment.id} href={`${API_BASE}/api/admin/connect/applications/${selectedId}/messages/${message.id}/attachments/${attachment.id}`} target="_blank" rel="noreferrer"><img crossOrigin="use-credentials" src={`${API_BASE}/api/admin/connect/applications/${selectedId}/messages/${message.id}/attachments/${attachment.id}`} alt={attachment.name} loading="lazy" /></a>)}</div>}</article>)
              : <div className="connect-empty"><strong>Start a helpful conversation</strong><p>Send a clear, actionable update related to this application.</p></div>}</>}
        </div>
        <form className="connect-inbox-reply" onSubmit={send}><label htmlFor="connect-inbox-message">Message applicant</label><textarea id="connect-inbox-message" rows="3" maxLength="2000" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Share an update, request a document, or explain the next step…" /><div className="connect-inbox-attachment-controls"><label className="connect-button light" htmlFor="connect-inbox-images">Attach images</label><input id="connect-inbox-images" type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={selectAttachments} /><small>Up to 3 private images · 5 MB each</small></div>{attachments.length > 0 && <div className="connect-inbox-selected-files">{attachments.map((file) => <span key={`${file.name}-${file.lastModified}`}>{file.name}</span>)}</div>}{attachmentError && <p className="connect-inbox-error" role="alert">{attachmentError}</p>}<div><small>{draft.length}/2000 characters · Only authorized staff and this applicant can view this thread</small><button type="submit" className="connect-button" disabled={sending || busy || (!draft.trim() && !attachments.length)}>{sending ? 'Sending…' : 'Send message'} <MessageSquareText size={14} /></button></div></form>
      </> : <div className="connect-empty"><strong>Select an applicant thread</strong><p>Messages stay private to the assigned applicant and authorized Connect staff.</p></div>}
    </section>
  </section>;
}

function OpportunityPanel({ opportunities, loading, busy, onSave }) {
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
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
  const visibleOpportunities = opportunities.filter((opportunity) => {
    const matchesStatus = statusFilter === 'all' || opportunity.status === statusFilter;
    const matchesSearch = `${opportunity.title} ${opportunity.summary}`.toLowerCase().includes(search.trim().toLowerCase());
    return matchesStatus && matchesSearch;
  });
  return <section className="connect-panel connect-opportunities">
    <div className="connect-panel-toolbar">
      <div><h3>Opportunity feed</h3><span>{loading ? 'Loading…' : `${visibleOpportunities.length} of ${opportunities.length} posts`}</span></div>
      <div className="connect-opportunity-toolbar-actions"><label className="connect-search"><Search size={14} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search opportunities" /></label><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Filter opportunities by status"><option value="all">All statuses</option><option value="draft">Drafts</option><option value="open">Open</option><option value="closed">Closed</option></select><button type="button" className="connect-button" onClick={openNew}><Plus size={15} /> Create opportunity</button></div>
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
      : visibleOpportunities.length ? <div className="connect-records">{visibleOpportunities.map((opportunity) => <article className="connect-record" key={opportunity.id}>
        <div className="connect-record-main"><span className="connect-record-icon"><BriefcaseBusiness size={15} /></span><div className="connect-record-content">
          <div className="connect-record-title"><strong>{opportunity.title}</strong><Status status={opportunity.status} /><span className="connect-status">{opportunity.type}</span></div>
          <span>{opportunity.summary}</span>
          <p>{opportunity.type === 'announcement' ? 'Announcement' : `${opportunity.applicationCount} / ${opportunity.maximumApplications} applications · ${opportunity.positionsAvailable} positions`} · {opportunity.interestedCount} following · {opportunity.reactionCount || 0} reactions</p>
          {opportunity.type !== 'announcement' && <div className="connect-opportunity-capacity"><div><strong>Application capacity</strong><span>{Math.round((opportunity.applicationCount / Math.max(opportunity.maximumApplications, 1)) * 100)}%</span></div><progress value={opportunity.applicationCount} max={Math.max(opportunity.maximumApplications, 1)} aria-label={`${opportunity.applicationCount} of ${opportunity.maximumApplications} applications received`} /></div>}
          {opportunity.deadline && <p className="connect-note">Deadline: {formatDate(opportunity.deadline)}</p>}
        </div></div>
        <div className="connect-record-actions"><button type="button" className="connect-button light" disabled={busy} onClick={() => edit(opportunity)}>Edit / manage</button></div>
      </article>)}</div>
      : <div className="connect-empty"><span>✦</span><strong>{search || statusFilter !== 'all' ? 'No matching opportunities' : 'No opportunities created'}</strong><p>{search || statusFilter !== 'all' ? 'Try another search or status filter.' : 'Publish a role, partner program or announcement to the Connect feed.'}</p></div>}
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
  const referredUser = row.referralId?.referredUserId || {};
  const rewardLabels = {
    registration: 'Completed signup',
    kyc_verification: 'KYC approved',
    first_deposit: 'First qualifying deposit',
    active_saver: 'Active saver milestone',
  };
  return <article className="connect-record">
    <div className="connect-record-main"><span className="connect-record-icon earnings">₦</span><div className="connect-record-content">
      <div className="connect-record-title"><strong>{currency(row.amountNaira)} · {rewardLabels[row.type] || 'Referral reward'}</strong><Status status={row.status} /></div>
      <span>Partner: {partner.userId?.name || partner.promoCode || '—'} · Referred account: {referredUser.name || referredUser.email || '—'}</span>
      <p>Reward recorded {formatDate(row.createdAt)} · Signup {formatDate(row.referralId?.registeredAt)}</p>
      {row.reviewNote && <p className="connect-note">Review note: {row.reviewNote}</p>}
    </div></div>
    {row.status === 'pending' && <div className="connect-record-actions"><button type="button" className="connect-button" onClick={() => openDecision({ record: row, status: 'approved' })}>Approve</button><button type="button" className="connect-button danger" onClick={() => openDecision({ record: row, status: 'rejected' })}>Reject</button></div>}
  </article>;
}

function PayoutRecord({ row, openDecision, payoutDays = [1] }) {
  const user = row.userId || {};
  const bank = row.linkedBankId || {};
  const payoutDayAvailable = isTodayPayoutDay(payoutDays);
  return <article className="connect-record">
    <div className="connect-record-main"><span className="connect-record-icon payout">₦</span><div className="connect-record-content">
      <div className="connect-record-title"><strong>{currency(row.amountNaira)}</strong><Status status={row.status} /></div>
      <span>{user.name || 'Partner'} · {user.email}</span><p>{bank.bankName || row.bankName || 'Linked bank'} ···· {bank.accountLast4 || row.accountLast4 || '—'} · Requested {formatDate(row.createdAt)}</p>
      {(bank.accountName || user.name) && <p className="connect-note">Connect legal name: {user.name || '—'} · Paystack account name: {bank.accountName || '—'}</p>}
      {row.reviewNote && <p className="connect-note">Note: {row.reviewNote}</p>}
      {row.paymentReference && <p className="connect-note">Payment reference: {row.paymentReference}</p>}
      {row.transferReference && <p className="connect-note">Paystack reference: {row.transferReference}{row.transferStatus ? ` · ${row.transferStatus}` : ''}</p>}
      {row.transferError && <p className="connect-transfer-error">{row.transferError}</p>}
    </div></div>
    <div className="connect-record-actions">
      {row.status === 'pending' && <>{!payoutDayAvailable && <small className="connect-payout-day-hint">Available on {payoutDaysLabel(payoutDays)} (West Africa Time)</small>}<button type="button" className="connect-button" disabled={!payoutDayAvailable} onClick={() => openDecision({ record: row, status: 'approved' })}>Approve &amp; pay</button><button type="button" className="connect-button danger" onClick={() => openDecision({ record: row, status: 'rejected' })}>Reject</button></>}
      {row.status === 'approved' && !row.transferReference && <button type="button" className="connect-button light" onClick={() => openDecision({ record: row, status: 'paid', paymentReference: '' })}>Record legacy payment</button>}
      {row.status === 'requires_otp' && <button type="button" className="connect-button" onClick={() => openDecision({ record: row, status: 'otp', otp: '' })}>Enter Paystack OTP</button>}
      {row.status === 'processing' && <button type="button" className="connect-button light" onClick={() => openDecision({ record: row, status: 'reconcile' })}>Check Paystack status</button>}
    </div>
  </article>;
}

function PolicyPanel({ policy, loading, busy, onSubmit }) {
  if (loading || !policy) return <div className="connect-panel connect-loading">Loading commission policy…</div>;
  return <form className="connect-panel connect-policy" onSubmit={onSubmit}>
    <div className="connect-panel-toolbar"><div><h3>Commission policy</h3><span>Configure milestone rewards and withdrawal minimums. Maximum scheduled exposure is {currency(policy.maxPerReferralNaira)} per referral.</span></div></div>
    {!policy.rewardsMayBeEnabled && <div className="connect-policy-notice"><ShieldCheck size={17} /><span>All referral rewards remain locked until the operator configures formal compliance approval on the backend. Signup referrals can still be tracked.</span></div>}
    <div className="connect-policy-fields">
      <label>Completed signup (NGN)<input type="number" min="0" max={policy.maxPerReferralNaira} step="1" name="registrationRewardNaira" defaultValue={policy.registrationRewardNaira} /></label>
      <label>KYC approved (NGN)<input type="number" min="0" max={policy.maxPerReferralNaira} step="1" name="kycRewardNaira" defaultValue={policy.kycRewardNaira} /></label>
      <label>First qualifying deposit (NGN)<input type="number" min="0" max={policy.maxPerReferralNaira} step="1" name="firstDepositRewardNaira" defaultValue={policy.firstDepositRewardNaira} /></label>
      <label>Active saver (NGN)<input type="number" min="0" max={policy.maxPerReferralNaira} step="1" name="activeSaverBonusNaira" defaultValue={policy.activeSaverBonusNaira} /></label>
      <label>Minimum withdrawal (NGN)<input type="number" min="1" max="10000000" step="1" name="minimumPayoutNaira" defaultValue={policy.minimumPayoutNaira} /></label>
      <fieldset className="connect-payout-days">
        <legend>Scheduled payout days</legend>
        <small>Partners can request withdrawals any day. Paystack transfers can only be initiated on the selected days (West Africa Time).</small>
        <div>{weekdayNames.map((day, index) => <label key={day}><input type="checkbox" name="payoutDays" value={index} defaultChecked={(policy.payoutDays || [1]).includes(index)} /><span>{day}</span></label>)}</div>
      </fieldset>
      <label className={`connect-toggle ${!policy.rewardsMayBeEnabled ? 'disabled' : ''}`}><input type="checkbox" name="milestoneRewardsEnabled" defaultChecked={policy.milestoneRewardsEnabled} disabled={!policy.rewardsMayBeEnabled} /><span><b>Enable milestone rewards</b><small>Eligible events create pending commissions for admin review. Approved withdrawal requests are paid through Paystack.</small></span></label>
    </div>
    <button className="connect-button" type="submit" disabled={busy}>Save policy</button>
  </form>;
}

function DecisionDialog({ activeTab, decision, setDecision, onSubmit, busy }) {
  const { record, status } = decision;
  const setField = (field) => (event) => setDecision((current) => ({ ...current, [field]: event.target.value }));
  let title = `${status.replaceAll('_', ' ')} ${activeTab === 'applications' ? 'application' : activeTab === 'commissions' ? 'commission' : 'withdrawal'}`;
  if (status === 'approved' && activeTab === 'applications') title = record.type === 'partner' ? 'Approve Connect Partner' : 'Approve applicant';
  if (activeTab === 'payouts' && status === 'approved') title = 'Approve and pay withdrawal';
  if (activeTab === 'payouts' && status === 'paid') title = 'Record legacy withdrawal payment';
  if (activeTab === 'payouts' && status === 'otp') title = 'Confirm Paystack transfer';
  if (activeTab === 'payouts' && status === 'reconcile') title = 'Check Paystack transfer status';
  return <div className="connect-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setDecision(null); }}>
    <section className="connect-modal" role="dialog" aria-modal="true" aria-labelledby="connect-modal-title">
      <div className="connect-modal-heading"><div><p className="connect-kicker">KALMA CONNECT REVIEW</p><h3 id="connect-modal-title">{title}</h3></div><button type="button" aria-label="Close dialog" onClick={() => setDecision(null)}><X size={18} /></button></div>
      <form onSubmit={onSubmit} className="connect-modal-form">
        <p className="connect-modal-target">{record.userId?.name || record.partnerId?.userId?.name || `Record ${record._id?.slice(-6)}`}{record.userId?.email ? ` · ${record.userId.email}` : ''}</p>
        {activeTab === 'payouts' && status === 'approved' && <p className="connect-payment-warning">Confirm the recipient and amount. This immediately submits {currency(record.amountNaira)} from the Kalma Capital Paystack balance to {record.linkedBankId?.bankName || record.bankName || 'the linked bank'} ending in {record.linkedBankId?.accountLast4 || record.accountLast4 || '—'}. The withdrawal shows as paid only after Paystack confirms it.</p>}
        {activeTab === 'payouts' && status === 'paid' && <p className="connect-payment-warning">This withdrawal was approved before automated Paystack payouts. Only record it as paid after verifying the external transfer already completed. This action does not send money.</p>}
        {activeTab === 'payouts' && status === 'otp' && <p className="connect-payment-warning">Enter the one-time transfer authorization code from Paystack. The code is sent directly to Paystack and is not stored.</p>}
        {activeTab === 'payouts' && status === 'reconcile' && <p className="connect-payment-warning">Check Paystack for the final transfer state. This does not initiate another transfer.</p>}
        {activeTab === 'applications' && status === 'approved' && record.type === 'applicant' && <label>Assigned role<select required value={decision.assignedRole || record.roleInterest || ''} onChange={setField('assignedRole')}><option value="" disabled>Select role</option>{roleOptions.map((role) => <option key={role}>{role}</option>)}{record.roleInterest && !roleOptions.includes(record.roleInterest) && <option>{record.roleInterest}</option>}</select></label>}
        {activeTab === 'applications' && status === 'interview_scheduled' && <label>Interview date and time<input type="datetime-local" required value={decision.interviewAt || ''} onChange={setField('interviewAt')} /></label>}
        {activeTab === 'payouts' && status === 'otp' && <label>Paystack OTP<input required inputMode="numeric" autoComplete="one-time-code" maxLength={10} value={decision.otp || ''} onChange={setField('otp')} placeholder="Enter the transfer OTP" /></label>}
        {activeTab === 'payouts' && status === 'paid' && <label>Payment reference<input required maxLength={120} value={decision.paymentReference || ''} onChange={setField('paymentReference')} placeholder="Reference for the completed transfer" /></label>}
        {status !== 'otp' && status !== 'reconcile' && <label>Staff note <span>Optional</span><textarea rows="3" maxLength={500} value={decision.reviewNote || ''} onChange={setField('reviewNote')} placeholder="Add a note for the audit history…" /></label>}
        <div className="connect-modal-actions"><button type="button" className="connect-button light" onClick={() => setDecision(null)}>Cancel</button><button type="submit" className="connect-button" disabled={busy || (status === 'otp' && !/^\d{4,10}$/.test(decision.otp || ''))}>{busy ? 'Processing…' : status === 'approved' ? 'Approve & pay' : status === 'paid' ? 'Record payment' : status === 'otp' ? 'Confirm OTP' : status === 'reconcile' ? 'Check status' : 'Confirm decision'} <Check size={15} /></button></div>
      </form>
    </section>
  </div>;
}

function Status({ status }) {
  return <span className={`connect-status ${status}`}>{String(status || 'unknown').replaceAll('_', ' ')}</span>;
}
