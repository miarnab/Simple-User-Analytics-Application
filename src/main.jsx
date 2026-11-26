import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

const API = '/api';
const shortId = (id = '') => id.length > 19 ? `${id.slice(0, 8)}…${id.slice(-6)}` : id;
const relativeTime = (value) => {
  if (!value) return '—';
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
};
const formatDate = (value) => value ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '—';
const pathOf = (url = '') => { try { const parsed = new URL(url); return `${parsed.host}${parsed.pathname}`; } catch { return url; } };

async function getJson(url) {
  const response = await fetch(url);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || `Request failed (${response.status})`);
  return body;
}

function App() {
  const [view, setView] = useState('sessions');
  const [sessions, setSessions] = useState([]);
  const [pages, setPages] = useState([]);
  const [selectedSession, setSelectedSession] = useState(null);
  const [journey, setJourney] = useState([]);
  const [selectedPage, setSelectedPage] = useState('');
  const [clicks, setClicks] = useState([]);
  const [health, setHealth] = useState('checking');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = async (silent = false) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const [sessionRows, pageRows, status] = await Promise.all([
        getJson(`${API}/sessions`), getJson(`${API}/pages`), getJson(`${API}/health`),
      ]);
      setSessions(sessionRows);
      setPages(pageRows);
      setHealth(status.database);
      setSelectedPage((current) => current && pageRows.includes(current) ? current : pageRows[0] || '');
    } catch (err) {
      setHealth('disconnected');
      setError(err.message || 'Could not load analytics data.');
    } finally { setLoading(false); }
  };

  useEffect(() => { refresh(); const timer = setInterval(() => refresh(true), 30000); return () => clearInterval(timer); }, []);
  useEffect(() => {
    if (!selectedSession) { setJourney([]); return; }
    getJson(`${API}/sessions/${encodeURIComponent(selectedSession.session_id)}/events`)
      .then(setJourney).catch((err) => setError(err.message));
  }, [selectedSession]);
  useEffect(() => {
    if (!selectedPage) { setClicks([]); return; }
    getJson(`${API}/heatmap?url=${encodeURIComponent(selectedPage)}`)
      .then(setClicks).catch((err) => setError(err.message));
  }, [selectedPage]);

  const totals = useMemo(() => sessions.reduce((sum, row) => ({
    events: sum.events + row.total_events, clicks: sum.clicks + row.clicks, pageViews: sum.pageViews + row.page_views,
  }), { events: 0, clicks: 0, pageViews: 0 }), [sessions]);

  return <div className="app-shell">
    <aside className="sidebar">
      <a className="brand" href="#sessions" onClick={(e) => { e.preventDefault(); setView('sessions'); }}><span className="brand-mark"><i /></span><span>signal<span className="brand-period">.</span></span></a>
      <div className="workspace-label">WORKSPACE</div>
      <div className="workspace-switch"><span className="workspace-icon">C</span><span className="workspace-name">CausalFunnel</span><span className="chevron">⌄</span></div>
      <div className="nav-label">ANALYTICS</div>
      <button className={`nav-item ${view === 'sessions' ? 'active' : ''}`} onClick={() => setView('sessions')}><span className="nav-icon">◷</span> Sessions <span className="nav-count">{sessions.length}</span></button>
      <button className={`nav-item ${view === 'heatmap' ? 'active' : ''}`} onClick={() => setView('heatmap')}><span className="nav-icon">▦</span> Heatmap</button>
      <div className="sidebar-bottom"><div className="help-card"><span className="help-icon">✳</span><strong>Getting started</strong><p>Install the tracker to start seeing visitor activity.</p><a href="/demo.html" target="_blank" rel="noreferrer">Open demo page <span>↗</span></a></div><div className="profile"><div className="avatar">M</div><div><strong>Arnab Mitra</strong><span>Free workspace</span></div><span className="profile-menu">•••</span></div></div>
    </aside>
    <main className="main-area">
      <header className="topbar"><div className="breadcrumbs">Analytics <span>/</span> <strong>{view === 'sessions' ? 'Sessions' : 'Heatmap'}</strong></div><div className="topbar-actions"><div className={`connection ${health}`}><span />{health === 'connected' ? 'Live data' : health === 'checking' ? 'Connecting' : 'Offline'}</div><button className="icon-button" title="Refresh data" onClick={() => refresh()} aria-label="Refresh data">↻</button><div className="top-avatar">M</div></div></header>
      {error && <div className="alert"><span>!</span><div><strong>Unable to load analytics</strong><p>{error}. Start MongoDB and the app server, then refresh.</p></div><button onClick={() => refresh()}>Retry</button></div>}
      <div className="page-content">
        <div className="page-heading"><div><div className="eyebrow">PRODUCT ANALYTICS <span className="eyebrow-dot">•</span> LAST 30 DAYS</div><h1>{view === 'sessions' ? 'Sessions' : 'Click heatmap'}</h1><p>{view === 'sessions' ? 'See how visitors explore your product.' : 'Explore where visitors click on your pages.'}</p></div><div className="heading-actions"><a className="button secondary" href="/demo.html" target="_blank" rel="noreferrer"><span>↗</span> Open demo</a><button className="button primary" onClick={() => refresh()}><span>↻</span> Refresh</button></div></div>
        <div className="stat-grid">
          <StatCard label="Total sessions" value={sessions.length.toLocaleString()} delta="All time" icon="◷" tone="lavender" />
          <StatCard label="Total events" value={totals.events.toLocaleString()} delta={`${totals.pageViews.toLocaleString()} page views`} icon="⌁" tone="blue" />
          <StatCard label="Clicks tracked" value={totals.clicks.toLocaleString()} delta={`${pages.length} tracked pages`} icon="↗" tone="peach" />
        </div>
        {view === 'sessions' ? <section className="data-card">
          <div className="card-heading"><div><h2>Recent sessions</h2><p>Visitor activity, ordered by most recent.</p></div><div className="table-tools"><span className="result-count">{sessions.length} sessions</span><button className="icon-button small" onClick={() => refresh()} title="Refresh">↻</button></div></div>
          <div className="table-wrap"><table><thead><tr><th>SESSION</th><th>EVENTS</th><th>PAGE VIEWS</th><th>CLICKS</th><th>LAST PAGE</th><th>LAST ACTIVE</th><th></th></tr></thead><tbody>
            {sessions.map((session, index) => <tr key={session.session_id} className={selectedSession?.session_id === session.session_id ? 'selected-row' : ''} onClick={() => setSelectedSession(session)}><td><div className="session-cell"><span className={`session-avatar avatar-${index % 5}`}>{index % 2 ? '↗' : '◉'}</span><span><strong>{shortId(session.session_id)}</strong><small>{formatDate(session.first_seen)}</small></span></div></td><td><span className="number-pill">{session.total_events}</span></td><td>{session.page_views}</td><td>{session.clicks}</td><td className="page-cell" title={session.last_page}>{pathOf(session.last_page)}</td><td><span className="active-time"><i />{relativeTime(session.last_seen)}</span></td><td><button className="row-arrow" aria-label="View session journey">→</button></td></tr>)}
            {!sessions.length && <tr><td colSpan="7"><EmptyState loading={loading} title="No sessions yet" message="Open the demo page and click around to send your first events." action={<a href="/demo.html" target="_blank" rel="noreferrer" className="button primary">Open demo page <span>↗</span></a>} /></td></tr>}
          </tbody></table></div>
          {selectedSession && <div className="journey-panel"><div className="journey-title"><div><span className="eyebrow">SESSION JOURNEY</span><h3>{shortId(selectedSession.session_id)}</h3></div><button className="close-button" onClick={() => setSelectedSession(null)} aria-label="Close journey">×</button></div><div className="journey-summary"><span>{selectedSession.total_events} events</span><span>{formatDate(selectedSession.first_seen)}</span><span>{formatDate(selectedSession.last_seen)}</span></div><div className="timeline">{journey.map((event, index) => <div className="timeline-item" key={event.id || index}><span className={`timeline-dot ${event.event_type === 'click' ? 'click' : ''}`}>{event.event_type === 'click' ? '↗' : '◷'}</span><div className="event-detail"><div><strong>{event.event_type === 'page_view' ? 'Viewed a page' : 'Clicked'}</strong><time>{formatDate(event.timestamp)}</time></div><p>{pathOf(event.page_url)}</p>{event.event_type === 'click' && <small>Position {Math.round(event.x)}, {Math.round(event.y)}</small>}</div></div>)}{!journey.length && <p className="subtle">Loading events…</p>}</div></div>}
        </section> : <HeatmapView
          pages={pages}
          selectedPage={selectedPage}
          setSelectedPage={setSelectedPage}
          clicks={clicks}
          loading={loading}
        />}
        <footer className="page-footer"><span>Signal Analytics <span>•</span> Built for understanding every journey</span><span><i className={health === 'connected' ? 'ok' : ''} /> {health === 'connected' ? 'All systems operational' : 'Waiting for database connection'}</span></footer>
      </div>
    </main>
  </div>;
}

function HeatmapView({ pages, selectedPage, setSelectedPage, clicks, loading }) {
  return (
    <section className="data-card heatmap-card">
      <div className="card-heading heatmap-heading">
        <div>
          <h2>Click activity</h2>
          <p>Click locations recorded on the selected page.</p>
        </div>
        <label className="select-wrap">
          <span>PAGE URL</span>
          <select value={selectedPage} onChange={(event) => setSelectedPage(event.target.value)} disabled={!pages.length}>
            {pages.map((page) => <option key={page} value={page}>{pathOf(page)}</option>)}
          </select>
          <b>⌄</b>
        </label>
      </div>
      <div className="heatmap-content">
        {selectedPage ? (
          <>
            <div className="page-preview-head">
              <div><span className="site-icon">◈</span><span>{pathOf(selectedPage)}</span></div>
              <span className="click-count"><i />{clicks.length} clicks</span>
            </div>
            <div className="heatmap-canvas" aria-label="Click positions heatmap">
              <div className="canvas-toolbar"><span>PAGE CANVAS</span><span>CLICK POSITIONS</span></div>
              <div className="fake-page">
                <div className="fake-nav">
                  <span className="fake-logo"><i /> storefront</span>
                  <span className="fake-links">Collections &nbsp;&nbsp; About &nbsp;&nbsp; Contact</span>
                  <span className="fake-cart">Bag (0)</span>
                </div>
                <div className="fake-hero">
                  <div className="hero-copy">
                    <span className="fake-kicker">THE EVERYDAY EDIT</span>
                    <h3>Made for<br />your kind of day.</h3>
                    <p>Thoughtful essentials, designed to feel right at home.</p>
                    <button>Shop the collection <span>→</span></button>
                  </div>
                  <div className="hero-art">
                    <div className="art-sun" />
                    <div className="art-arch"><div className="art-vase" /><div className="art-stem" /></div>
                    <span className="art-caption">OBJECTS FOR SLOW LIVING</span>
                  </div>
                </div>
                <div className="fake-products">
                  <div className="section-label">A FEW FAVORITES</div>
                  <div className="product-row">
                    <div className="product-box product-one"><span>01</span><i /></div>
                    <div className="product-box product-two"><span>02</span><i /></div>
                    <div className="product-box product-three"><span>03</span><i /></div>
                  </div>
                </div>
                {clicks.map((click, index) => {
                  const width = Number(click.viewport_width) || 1440;
                  const height = Number(click.viewport_height) || 900;
                  const left = Math.max(0, Math.min(100, click.x / width * 100));
                  const top = Math.max(0, Math.min(100, click.y / height * 100));
                  return <span key={index} className="heat-dot" style={{ left: `${left}%`, top: `${top}%` }} title={`Click at ${Math.round(click.x)}, ${Math.round(click.y)}`} />;
                })}
              </div>
            </div>
            <div className="heatmap-legend">
              <span className="legend-dot" /> Each dot represents one click.
              <span className="legend-tip">Coordinates are normalized to the visitor's viewport</span>
            </div>
          </>
        ) : (
          <EmptyState
            loading={loading}
            title="No pages to show"
            message="Click events will appear here once your tracker sends data."
            action={<a className="button primary" href="/demo.html" target="_blank" rel="noreferrer">Open demo page <span>↗</span></a>}
          />
        )}
      </div>
    </section>
  );
}

function StatCard({ label, value, delta, icon, tone }) { return <div className="stat-card"><div className={`stat-icon ${tone}`}>{icon}</div><div className="stat-label">{label}</div><div className="stat-value">{value}</div><div className="stat-delta"><span>↗</span> {delta}</div></div>; }
function EmptyState({ loading, title, message, action }) { return <div className="empty-state"><div className="empty-illustration"><span className="empty-circle">{loading ? '◌' : '⌁'}</span><span className="empty-spark spark-a">✦</span><span className="empty-spark spark-b">·</span></div><h3>{loading ? 'Loading your data' : title}</h3><p>{loading ? 'Connecting to your analytics workspace.' : message}</p>{!loading && action}</div>; }

createRoot(document.getElementById('root')).render(<App />);
