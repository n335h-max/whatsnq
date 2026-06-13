import { useState, useEffect, useCallback } from 'react'
import {
  Shield, Users, MessageSquare, Database, Search, Trash2,
  ArrowLeft, RefreshCw, Loader2, ChevronRight, Eye,
  Bot, Layers, Activity, AlertTriangle
} from 'lucide-react'

const TOKEN_KEY = 'wa_admin_token'

function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}

function setToken(t) {
  if (t) localStorage.setItem(TOKEN_KEY, t)
  else localStorage.removeItem(TOKEN_KEY)
}

async function api(path, opts = {}) {
  const token = getToken()
  const headers = { 'Content-Type': 'application/json', ...opts.headers }
  if (token) headers['Authorization'] = `Bearer ${token}`
  const res = await fetch(path, { ...opts, headers })
  const data = await res.json()
  if (!res.ok && !data.success) throw new Error(data.message || 'Request failed')
  return data
}

function AdminHeader({ title, subtitle, onBack, page, setPage, onLogout }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {onBack && (
            <button className="btn btn-secondary" style={{ padding: '8px 12px' }} onClick={onBack}>
              <ArrowLeft size={16} />
            </button>
          )}
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>{title}</h2>
          <span className="badge badge-danger" style={{ fontSize: '0.7rem' }}>Admin</span>
        </div>
        {subtitle && <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '4px' }}>{subtitle}</p>}
      </div>
      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
        <button
          className={`btn ${page === 'dashboard' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ padding: '8px 14px', fontSize: '0.85rem' }}
          onClick={() => setPage('dashboard')}
        >
          <Activity size={15} /> Dashboard
        </button>
        <button
          className={`btn ${page === 'conversations' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ padding: '8px 14px', fontSize: '0.85rem' }}
          onClick={() => setPage('conversations')}
        >
          <MessageSquare size={15} /> Conversations
        </button>
        <button
          className="btn btn-secondary"
          style={{ padding: '8px 14px', fontSize: '0.85rem', color: 'var(--danger)', borderColor: 'rgba(239,68,68,0.3)' }}
          onClick={onLogout}
        >
          Sign Out
        </button>
      </div>
    </div>
  )
}

export default function AdminPanel({ onBack }) {
  const [token, setTokenState] = useState(getToken())
  const [page, setPage] = useState('login') // login | dashboard | conversations | conversation
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [stats, setStats] = useState(null)
  const [clients, setClients] = useState([])
  const [conversations, setConversations] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [clientFilter, setClientFilter] = useState('')
  const [selectedContact, setSelectedContact] = useState(null) // { clientId, contactId, messages }
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoginError('')
    setLoading(true)
    try {
      const data = await api('/api/admin/login', {
        method: 'POST',
        body: JSON.stringify({ username, password })
      })
      setToken(data.token)
      setTokenState(data.token)
      setPage('dashboard')
    } catch (err) {
      setLoginError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = () => {
    setToken(null)
    setTokenState(null)
    setPage('login')
    setUsername('')
    setPassword('')
  }

  const fetchStats = useCallback(async () => {
    try {
      const data = await api('/api/admin/stats')
      setStats(data.stats)
    } catch (err) {
      setError(err.message)
    }
  }, [])

  const fetchClients = useCallback(async () => {
    try {
      const data = await api('/api/admin/clients')
      setClients(data.clients || [])
    } catch (err) {
      setError(err.message)
    }
  }, [])

  const fetchConversations = useCallback(async (search, nextClientFilter = clientFilter) => {
    setLoading(true)
    try {
      let path = '/api/admin/conversations?limit=100'
      if (search) path += `&search=${encodeURIComponent(search)}`
      if (nextClientFilter) path += `&clientId=${encodeURIComponent(nextClientFilter)}`
      const data = await api(path)
      setConversations(data.conversations || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [clientFilter])

  const fetchContactMessages = useCallback(async (clientId, contactId) => {
    setLoading(true)
    try {
      const data = await api(`/api/admin/conversations/${clientId}/${encodeURIComponent(contactId)}`)
      setSelectedContact({ clientId, contactId, messages: data.messages || [] })
      setPage('conversation')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  // On mount / page change — load data
  useEffect(() => {
    if (!token) return
    if (page === 'dashboard') {
      const timeoutId = setTimeout(() => {
        fetchStats()
        fetchClients()
      }, 0)
      return () => clearTimeout(timeoutId)
    } else if (page === 'conversations') {
      const timeoutId = setTimeout(() => {
        fetchConversations(searchQuery, clientFilter)
      }, 0)
      return () => clearTimeout(timeoutId)
    }
  }, [page, token, clientFilter, fetchStats, fetchClients, fetchConversations, searchQuery])

  // Verify token on mount
  useEffect(() => {
    if (token) {
      api('/api/admin/verify').then(d => {
        if (d.success) setPage('dashboard')
        else { setToken(null); setTokenState(null) }
      }).catch(() => {
        setToken(null); setTokenState(null)
      })
    }
  }, [])

  const getStatusBadge = (status) => {
    switch (status) {
      case 'ready': return <span className="badge badge-success">Active</span>
      case 'qr': return <span className="badge badge-warning">QR</span>
      case 'initializing': return <span className="badge badge-warning">Init</span>
      case 'stopped': return <span className="badge badge-muted">Stopped</span>
      case 'error': case 'auth_failure': return <span className="badge badge-danger">Error</span>
      default: return <span className="badge badge-muted">{status}</span>
    }
  }

  const handleDeleteContact = async (clientId, contactId) => {
    if (!window.confirm(`Delete conversation with ${contactId.split('@')[0]}?`)) return
    try {
      await api(`/api/admin/conversations/${clientId}/${encodeURIComponent(contactId)}`, { method: 'DELETE' })
      fetchConversations(searchQuery, clientFilter)
    } catch (err) {
      setError(err.message)
    }
  }

  // ─── LOGIN SCREEN ──────────────────────────────────────────────
  if (page === 'login') {
    return (
      <div className="page-container" style={{ maxWidth: '440px', margin: '80px auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <div style={{
            width: '64px', height: '64px', borderRadius: '16px',
            background: 'linear-gradient(135deg, #ef4444, #dc2626)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px', boxShadow: '0 8px 24px rgba(239,68,68,0.3)'
          }}>
            <Shield size={32} color="white" />
          </div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Admin Panel</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '6px' }}>
            Manage clients, conversations, and system data.
          </p>
        </div>

        <div className="card">
          <form onSubmit={handleLogin}>
            {loginError && (
              <div style={{
                backgroundColor: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
                color: 'var(--danger)', padding: '10px 14px', borderRadius: '8px',
                fontSize: '0.85rem', marginBottom: '20px'
              }}>
                <AlertTriangle size={14} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
                {loginError}
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Username</label>
              <input className="form-input" type="text" value={username}
                onChange={e => setUsername(e.target.value)} placeholder="admin"
                autoFocus />
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <input className="form-input" type="password" value={password}
                onChange={e => setPassword(e.target.value)} placeholder="••••••" />
            </div>
            <button className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
              {loading ? <Loader2 size={16} style={{ animation: 'spin 1s infinite' }} /> : <Shield size={16} />}
              <span>Sign In</span>
            </button>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: '16px' }}>
              Default: admin / admin123 (set ADMIN_USER / ADMIN_PASS in .env)
            </p>
          </form>
        </div>
      </div>
    )
  }

  // ─── VIEW: CONVERSATION DETAIL ──────────────────────────────
  if (page === 'conversation' && selectedContact) {
    const { clientId, contactId, messages } = selectedContact
    return (
      <div className="page-container">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
          <button className="btn btn-secondary" style={{ padding: '8px 12px' }}
            onClick={() => { setPage('conversations'); setSelectedContact(null) }}>
            <ArrowLeft size={16} />
          </button>
          <div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>
              <span style={{ textTransform: 'capitalize' }}>{clientId}</span>
              <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}> / </span>
              <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{contactId.split('@')[0]}</span>
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{messages.length} messages</p>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
            <button className="btn btn-secondary" style={{ padding: '8px 14px', fontSize: '0.8rem' }}
              onClick={() => fetchContactMessages(clientId, contactId)}>
              <RefreshCw size={14} /> Refresh
            </button>
            <button className="btn btn-danger" style={{ padding: '8px 14px', fontSize: '0.8rem' }}
              onClick={() => handleDeleteContact(clientId, contactId)}>
              <Trash2 size={14} /> Delete
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {messages.map((msg, i) => (
            <div key={i} style={{
              alignSelf: msg.role === 'user' ? 'flex-start' : 'flex-end',
              maxWidth: '75%',
              backgroundColor: msg.role === 'user'
                ? 'var(--bg-card)'
                : 'rgba(99,102,241,0.12)',
              border: `1px solid ${msg.role === 'user' ? 'var(--border)' : 'rgba(99,102,241,0.2)'}`,
              borderRadius: '12px',
              padding: '12px 16px',
            }}>
              <div style={{
                fontSize: '0.7rem', color: 'var(--text-muted)',
                marginBottom: '4px', fontWeight: 600,
                textTransform: 'uppercase', letterSpacing: '0.03em'
              }}>
                {msg.role === 'user' ? '👤 Customer' : '🤖 AI Bot'}
                <span style={{ marginLeft: '8px', fontWeight: 400, color: 'var(--text-muted)' }}>
                  {msg.created_at || ''}
                </span>
              </div>
              <div style={{ fontSize: '0.9rem', lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {msg.content}
              </div>
            </div>
          ))}
          {messages.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
              No messages in this conversation.
            </div>
          )}
        </div>
      </div>
    )
  }

  // ─── DASHBOARD TAB ─────────────────────────────────────────
  if (page === 'dashboard') {
    return (
      <div className="page-container">
        <AdminHeader
          title="Admin Dashboard"
          subtitle="System overview and client monitoring"
          onBack={onBack}
          page={page}
          setPage={setPage}
          onLogout={handleLogout}
        />

        {error && (
          <div style={{
            backgroundColor: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
            color: 'var(--danger)', padding: '10px 14px', borderRadius: '8px',
            fontSize: '0.85rem', marginBottom: '20px'
          }}>{error}</div>
        )}

        {/* Stats grid */}
        {stats && (
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-icon" style={{ backgroundColor: 'rgba(99,102,241,0.1)', color: 'var(--accent)' }}>
                <Layers size={22} />
              </div>
              <div className="stat-info">
                <span className="stat-label">Total Clients</span>
                <span className="stat-value">{stats.totalClients}</span>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon" style={{ backgroundColor: 'rgba(16,185,129,0.1)', color: 'var(--success)' }}>
                <Bot size={22} />
              </div>
              <div className="stat-info">
                <span className="stat-label">Active Bots</span>
                <span className="stat-value">{stats.activeClients}</span>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon" style={{ backgroundColor: 'rgba(245,158,11,0.1)', color: 'var(--warning)' }}>
                <MessageSquare size={22} />
              </div>
              <div className="stat-info">
                <span className="stat-label">Replies Sent</span>
                <span className="stat-value">{stats.totalMessages}</span>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon" style={{ backgroundColor: 'rgba(139,92,246,0.1)', color: '#8b5cf6' }}>
                <Database size={22} />
              </div>
              <div className="stat-info">
                <span className="stat-label">Stored Messages</span>
                <span className="stat-value">{stats.totalConversations}</span>
              </div>
            </div>
          </div>
        )}

        {/* Client details table */}
        <div className="card">
          <div className="card-title">
            <Users size={20} style={{ color: 'var(--accent)' }} />
            <span>All Client Sessions</span>
            <button className="btn btn-secondary" style={{ marginLeft: 'auto', padding: '6px 12px', fontSize: '0.8rem' }}
              onClick={() => { fetchStats(); fetchClients() }}>
              <RefreshCw size={14} /> Refresh
            </button>
          </div>
          <table className="client-table">
            <thead>
              <tr>
                <th>Client ID</th>
                <th>Status</th>
                <th>Messages Sent</th>
                <th>DB Messages</th>
                <th>Contacts</th>
                <th>Uptime</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {clients.map(c => (
                <tr key={c.clientId}>
                  <td style={{ fontWeight: 600, textTransform: 'capitalize' }}>{c.clientId}</td>
                  <td>{getStatusBadge(c.status)}</td>
                  <td>{c.messageCount || 0}</td>
                  <td><span className="badge badge-muted">{c.dbMessages || 0}</span></td>
                  <td>{c.contacts?.length || 0}</td>
                  <td style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                    {c.uptime > 0 ? `${Math.floor(c.uptime / 60)}m` : '—'}
                  </td>
                  <td>
                    <button className="btn btn-secondary"
                      style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                      onClick={() => {
                        setSearchQuery('')
                        setClientFilter(c.clientId)
                        setPage('conversations')
                      }}>
                      <Eye size={13} /> View
                    </button>
                  </td>
                </tr>
              ))}
              {clients.length === 0 && (
                <tr><td colSpan="7" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px' }}>No clients configured.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  // ─── CONVERSATIONS TAB ─────────────────────────────────────
  if (page === 'conversations') {
    const contactCount = conversations.length
    const subtitleParts = []
    if (clientFilter) subtitleParts.push(`Filtered to ${clientFilter}`)
    if (searchQuery) subtitleParts.push(`Search: "${searchQuery}"`)
    const subtitle = subtitleParts.length > 0
      ? `${contactCount} contact threads. ${subtitleParts.join(' • ')}`
      : `${contactCount} contact threads across all clients`
    return (
      <div className="page-container">
        <AdminHeader
          title="Conversations"
          subtitle={subtitle}
          onBack={onBack}
          page={page}
          setPage={setPage}
          onLogout={handleLogout}
        />

        {error && (
          <div style={{
            backgroundColor: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
            color: 'var(--danger)', padding: '10px 14px', borderRadius: '8px',
            fontSize: '0.85rem', marginBottom: '20px'
          }}>{error}</div>
        )}

        {/* Search */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <Search size={16} style={{
              position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)',
              color: 'var(--text-muted)'
            }} />
            <input className="form-input" style={{ paddingLeft: '40px' }}
              placeholder="Search messages by content..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && fetchConversations(searchQuery, clientFilter)} />
          </div>
          <button className="btn btn-primary" onClick={() => fetchConversations(searchQuery, clientFilter)}>
            <Search size={16} />
            <span>Search</span>
          </button>
          <button className="btn btn-secondary" onClick={() => { setSearchQuery(''); setClientFilter(''); fetchConversations('', '') }}>
            <RefreshCw size={16} />
          </button>
        </div>

        {clientFilter && (
          <div style={{
            marginBottom: '16px',
            padding: '10px 14px',
            borderRadius: '12px',
            backgroundColor: 'rgba(37, 211, 102, 0.08)',
            border: '1px solid rgba(37, 211, 102, 0.14)',
            color: 'var(--text-secondary)',
            fontSize: '0.82rem'
          }}>
            Viewing only conversations for <strong style={{ color: 'var(--text-primary)' }}>{clientFilter}</strong>.
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <Loader2 size={32} style={{ color: 'var(--accent)', animation: 'spin 1s infinite' }} />
            <p style={{ color: 'var(--text-secondary)', marginTop: '12px' }}>Loading conversations...</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {conversations.map((conv) => (
              <div key={`${conv.client_id}-${conv.contact_id}`} style={{
                backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)',
                borderRadius: '10px', padding: '14px 18px',
                display: 'flex', alignItems: 'center', gap: '14px',
                transition: 'all 0.2s ease', cursor: 'pointer'
              }}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border-hover)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
                onClick={() => fetchContactMessages(conv.client_id, conv.contact_id)}>
                <div style={{
                  width: '36px', height: '36px', borderRadius: '50%',
                  backgroundColor: 'rgba(99,102,241,0.1)', color: 'var(--accent)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 700, fontSize: '0.85rem', flexShrink: 0
                }}>
                  {conv.client_id.charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                    <strong style={{ fontSize: '0.9rem', textTransform: 'capitalize' }}>{conv.client_id}</strong>
                    <span style={{ color: 'var(--text-muted)' }}>/</span>
                    <span style={{ color: 'var(--accent)', fontSize: '0.9rem', fontWeight: 600 }}>
                      {conv.contact_id.split('@')[0]}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                    {conv.message_count} messages · Last seen {conv.last_seen || 'N/A'}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <span className="badge badge-muted">{conv.message_count}</span>
                  <button className="btn btn-secondary"
                    style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                    onClick={e => { e.stopPropagation(); handleDeleteContact(conv.client_id, conv.contact_id) }}>
                    <Trash2 size={13} />
                  </button>
                  <ChevronRight size={16} style={{ color: 'var(--text-muted)' }} />
                </div>
              </div>
            ))}
            {conversations.length === 0 && !loading && (
              <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
                <MessageSquare size={40} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
                <p>No conversations yet.</p>
                <p style={{ fontSize: '0.85rem' }}>Messages are persisted once the AI bot starts replying.</p>
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  return null
}
