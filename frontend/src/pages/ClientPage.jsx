import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { 
  Bot, 
  MessageSquare, 
  Clock, 
  Settings, 
  Play, 
  Square, 
  RefreshCw, 
  CheckCircle2, 
  AlertTriangle,
  Loader2,
  Save,
  Radio
} from 'lucide-react'

export default function ClientPage({ clientId, token, socket, onRefresh, onDeleteComplete }) {
  const [status, setStatus] = useState('stopped')
  const [qrDataUrl, setQrDataUrl] = useState(null)
  const [config, setConfig] = useState(null)
  const [stats, setStats] = useState({ messageCount: 0, uptime: 0 })
  
  const [systemPrompt, setSystemPrompt] = useState('')
  const [autoReplyEnabled, setAutoReplyEnabled] = useState(false)
  const [respondToGroups, setRespondToGroups] = useState(false)
  
  const [loading, setLoading] = useState(false)
  const [savingPrompt, setSavingPrompt] = useState(false)
  const [errorMessage, setErrorMessage] = useState(null)
  
  const [pausedContacts, setPausedContacts] = useState([])
  const [handoffAlert, setHandoffAlert] = useState(null)
  const [nowTs, setNowTs] = useState(0)
  
  const intervalRef = useRef(null)
  const authHeaders = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token])
  const jsonAuthHeaders = useMemo(() => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }), [token])

  // Fetch current configs and status
  const fetchInstanceDetails = useCallback(async () => {
    try {
      // 1. Fetch Config
      const configRes = await fetch(`/api/clients/${clientId}/config`, { headers: authHeaders })
      const configData = await configRes.json()
      if (configData.success && configData.config) {
        setConfig(configData.config)
        setSystemPrompt(configData.config.systemPrompt || '')
        setAutoReplyEnabled(configData.config.chatSettings?.enableAutoReply ?? false)
        setRespondToGroups(configData.config.chatSettings?.respondToGroups ?? false)
      }

      // 2. Fetch Live Status
      const statusRes = await fetch(`/api/clients/${clientId}/status`, { headers: authHeaders })
      const statusData = await statusRes.json()
      if (statusData.success) {
        setStatus(statusData.status)
        setStats({
          messageCount: statusData.messageCount || 0,
          uptime: statusData.uptime || 0
        })
        if (statusData.status === 'qr' && statusData.qrDataUrl) {
          setQrDataUrl(statusData.qrDataUrl)
        }
      }

      // 3. Fetch Paused Contacts
      try {
        const pausedRes = await fetch(`/api/clients/${clientId}/paused`, { headers: authHeaders })
        const pausedData = await pausedRes.json()
        if (pausedData.success && pausedData.paused) {
          setPausedContacts(pausedData.paused)
        }
      } catch (err) {
        console.error('Error fetching paused contacts:', err)
      }
    } catch (err) {
      console.error('Error fetching details:', err)
      setErrorMessage('Could not communicate with server APIs.')
    }
  }, [authHeaders, clientId])

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchInstanceDetails()
    }, 0)

    // ─── SOCKET.IO LISTENERS ───────────────────────────────────
    if (socket) {
      socket.on(`client:${clientId}:status`, (data) => {
        console.log(`[Socket] Client ${clientId} status update:`, data.status)
        setStatus(data.status)
        if (data.status === 'ready' || data.status === 'stopped') {
          setQrDataUrl(null) // Clear QR code if transitioned
        }
        if (data.status === 'error' && data.message) {
          setErrorMessage(data.message)
        }
        onRefresh() // Refresh root client list statuses
      })

      socket.on(`client:${clientId}:qr`, (data) => {
        console.log(`[Socket] Client ${clientId} QR updated`)
        setQrDataUrl(data.qr)
        setStatus('qr')
      })

      socket.on(`client:${clientId}:stats`, (data) => {
        setStats(prev => ({ ...prev, messageCount: data.messageCount }))
        onRefresh()
      })

      socket.on(`client:${clientId}:paused_contacts`, (data) => {
        console.log(`[Socket] Client ${clientId} paused contacts updated:`, data)
        setPausedContacts(data)
      })

      socket.on(`client:${clientId}:handoff`, (data) => {
        console.log(`[Socket] Client ${clientId} handoff alert:`, data)
        setHandoffAlert(data)
      })
    }

    // Dynamic timer increment for uptime in UI
    intervalRef.current = setInterval(() => {
      setNowTs(Date.now())
      setStatus(curr => {
        if (curr === 'ready') {
          setStats(prev => ({ ...prev, uptime: prev.uptime + 1 }))
        }
        return curr
      })
    }, 1000)

    return () => {
      clearTimeout(timeoutId)
      if (socket) {
        socket.off(`client:${clientId}:status`)
        socket.off(`client:${clientId}:qr`)
        socket.off(`client:${clientId}:stats`)
        socket.off(`client:${clientId}:paused_contacts`)
        socket.off(`client:${clientId}:handoff`)
      }
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [clientId, socket, fetchInstanceDetails, onRefresh])

  // Spawn connection
  const handleStart = async () => {
    setLoading(true)
    setErrorMessage(null)
    setQrDataUrl(null)
    try {
      const res = await fetch(`/api/clients/${clientId}/connect`, { method: 'POST', headers: authHeaders })
      const data = await res.json()
      if (!data.success) {
        setErrorMessage(data.message || 'Failed to start.')
      }
    } catch (err) {
      console.error(err)
      setErrorMessage('Error connecting to the start endpoint.')
    } finally {
      setLoading(false)
    }
  }

  // Destroy session
  const handleStop = async () => {
    setLoading(true)
    setErrorMessage(null)
    try {
      const res = await fetch(`/api/clients/${clientId}/disconnect`, { method: 'POST', headers: authHeaders })
      const data = await res.json()
      if (data.success) {
        setStatus('stopped')
        setQrDataUrl(null)
        onRefresh()
      } else {
        setErrorMessage(data.message || 'Failed to stop.')
      }
    } catch (err) {
      console.error(err)
      setErrorMessage('Error stopping backend instance.')
    } finally {
      setLoading(false)
    }
  }

  // Completely delete the bot
  const handleDeleteBot = async () => {
    const isConfirmed = window.confirm(
      `Are you sure you want to delete the bot "${clientId}"? This will terminate any running session and permanently delete all prompt and training data.`
    )
    if (!isConfirmed) return

    setLoading(true)
    setErrorMessage(null)
    try {
      const res = await fetch(`/api/clients/${clientId}`, {
        method: 'DELETE',
        headers: authHeaders
      })
      const data = await res.json()
      if (data.success) {
        if (onDeleteComplete) {
          onDeleteComplete()
        }
      } else {
        setErrorMessage(data.message || 'Failed to delete the bot.')
      }
    } catch (err) {
      console.error(err)
      setErrorMessage('Error communicating with delete endpoint.')
    } finally {
      setLoading(false)
    }
  }

  // Toggle auto-reply
  const handleToggleAutoReply = async (checked) => {
    try {
      const res = await fetch(`/api/clients/${clientId}/toggle`, {
        method: 'POST',
        headers: jsonAuthHeaders,
        body: JSON.stringify({ enabled: checked })
      })
      const data = await res.json()
      if (data.success) {
        setAutoReplyEnabled(data.enableAutoReply)
      }
    } catch (err) {
      console.error(err)
    }
  }

  const handleToggleRespondToGroups = async (checked) => {
    if (!config) return

    const nextConfig = {
      ...config,
      chatSettings: {
        ...config.chatSettings,
        respondToGroups: checked
      }
    }

    setConfig(nextConfig)
    setRespondToGroups(checked)

    try {
      const res = await fetch(`/api/clients/${clientId}/config`, {
        method: 'PUT',
        headers: jsonAuthHeaders,
        body: JSON.stringify({ config: nextConfig })
      })
      const data = await res.json()
      if (!data.success) {
        throw new Error(data.message || 'Failed to save group reply setting.')
      }
    } catch (err) {
      console.error(err)
      setConfig(config)
      setRespondToGroups(config.chatSettings?.respondToGroups ?? false)
      alert(err.message || 'Failed to save group reply setting.')
    }
  }

  // Edit and Save Prompt
  const handleSavePrompt = async () => {
    setSavingPrompt(true)
    setErrorMessage(null)
    try {
      const res = await fetch(`/api/clients/${clientId}/prompt`, {
        method: 'POST',
        headers: jsonAuthHeaders,
        body: JSON.stringify({ systemPrompt })
      })
      const data = await res.json()
      if (data.success) {
        // Notification logic or visual confirmation
        alert('AI Prompt updated successfully!')
      } else {
        setErrorMessage(data.message || 'Failed to update prompt.')
      }
    } catch (err) {
      console.error(err)
      setErrorMessage('Error writing new system instruction.')
    } finally {
      setSavingPrompt(false)
    }
  }

  const handleResumeContact = async (contactId) => {
    try {
      const res = await fetch(`/api/clients/${clientId}/resume`, {
        method: 'POST',
        headers: jsonAuthHeaders,
        body: JSON.stringify({ contactId })
      })
      const data = await res.json()
      if (data.success) {
        if (handoffAlert && handoffAlert.contactId === contactId) {
          setHandoffAlert(null)
        }
      } else {
        alert(data.message || 'Failed to resume AI.')
      }
    } catch (err) {
      console.error('Error resuming contact:', err)
    }
  }

  const getUptimeStr = () => {
    const s = stats.uptime
    const h = Math.floor(s / 3600)
    const m = Math.floor((s % 3600) / 60)
    const sec = s % 60
    return `${h > 0 ? `${h}h ` : ''}${m}m ${sec}s`
  }

  return (
    <div className="page-container">
      {/* Session Title Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <h2 style={{ fontSize: '1.75rem', fontWeight: 700, textTransform: 'capitalize' }}>
              {clientId} Session
            </h2>
            {status === 'ready' && <span className="badge badge-success">Online</span>}
            {status === 'qr' && <span className="badge badge-warning">Awaiting QR scan</span>}
            {status === 'initializing' && <span className="badge badge-warning">Booting Puppeteer</span>}
            {status === 'stopped' && <span className="badge badge-muted">Offline</span>}
            {status === 'error' && <span className="badge badge-danger">Crash Error</span>}
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '4px' }}>
            Session ID: <code style={{ color: '#818cf8', fontWeight: 600 }}>{clientId}</code>
          </p>
        </div>

        {/* Start/Stop/Delete Session controls */}
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          {status === 'stopped' || status === 'error' || status === 'disconnected' ? (
            <button className="btn btn-primary" onClick={handleStart} disabled={loading}>
              {loading ? <Loader2 size={16} style={{ animation: 'spin 1s infinite' }} /> : <Play size={16} />}
              <span>Start Bot Session</span>
            </button>
          ) : (
            <button className="btn btn-danger" onClick={handleStop} disabled={loading}>
              {loading ? <Loader2 size={16} style={{ animation: 'spin 1s infinite' }} /> : <Square size={16} />}
              <span>Disconnect Session</span>
            </button>
          )}

          <button className="btn btn-secondary" onClick={fetchInstanceDetails} disabled={loading}>
            <RefreshCw size={16} />
          </button>

          <button 
            className="btn btn-danger" 
            style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', borderColor: 'rgba(239, 68, 68, 0.15)' }}
            onClick={handleDeleteBot} 
            disabled={loading}
          >
            <span>Delete Bot</span>
          </button>
        </div>
      </div>

      {errorMessage && (
        <div style={{
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.2)',
          color: 'var(--danger)',
          padding: '12px 16px',
          borderRadius: '8px',
          fontSize: '0.9rem',
          marginBottom: '24px'
        }}>
          ⚠️ {errorMessage}
        </div>
      )}

      {handoffAlert && (
        <div style={{
          background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.15) 0%, rgba(239, 68, 68, 0.15) 100%)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          padding: '16px 20px',
          borderRadius: '12px',
          marginBottom: '24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          boxShadow: '0 4px 20px rgba(239, 68, 68, 0.1)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{
              backgroundColor: 'var(--danger)',
              color: '#fff',
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.25rem',
              fontWeight: 'bold',
              boxShadow: '0 0 12px rgba(239, 68, 68, 0.4)'
            }}>
              🚨
            </div>
            <div>
              <h4 style={{ margin: 0, fontWeight: 700, fontSize: '0.95rem', color: '#fca5a5' }}>
                Handover Requested!
              </h4>
              <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Customer <strong style={{ color: '#fff' }}>{handoffAlert.contactName || handoffAlert.contactId.split('@')[0]}</strong> requested human assistance: 
                <span style={{ fontStyle: 'italic', marginLeft: '6px', color: 'var(--text-primary)' }}>"{handoffAlert.lastMessage}"</span>
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button className="btn btn-primary" style={{ backgroundColor: 'var(--success)', borderColor: 'var(--success)', padding: '6px 12px', fontSize: '0.8rem' }} onClick={() => handleResumeContact(handoffAlert.contactId)}>
              Resume AI
            </button>
            <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem' }} onClick={() => setHandoffAlert(null)}>
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Grid: QR Code & Status Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '24px', alignItems: 'start', marginBottom: '24px' }}>
        
        {/* Connection State Panel */}
        <div className="card" style={{ height: '100%', minHeight: '360px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          
          {status === 'ready' && (
            <div style={{ textAlign: 'center', padding: '24px' }}>
              <CheckCircle2 size={56} style={{ color: 'var(--success)', margin: '0 auto 16px', filter: 'drop-shadow(0 0 12px rgba(16,185,129,0.3))' }} />
              <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '10px' }}>Bot is fully authenticated and live!</h3>
              <p style={{ color: 'var(--text-secondary)', maxWidth: '420px', margin: '0 auto', fontSize: '0.9rem', lineHeight: '1.5' }}>
                Puppeteer browser sandbox is active. The chatbot is listening to incoming chats and responding in real-time according to your System Prompt.
              </p>
            </div>
          )}

          {status === 'qr' && (
            <div style={{ textAlign: 'center' }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 600, marginBottom: '8px' }}>Scan QR Code with WhatsApp</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', maxWidth: '380px', margin: '0 auto 16px' }}>
                Open WhatsApp on your phone → Settings / Menu → Linked Devices → Link a Device. Focus your camera on the code below.
              </p>
              
              <div className="qr-container">
                {qrDataUrl ? (
                  <img src={qrDataUrl} alt="WhatsApp Auth QR Code" className="qr-image" />
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                    <Loader2 size={32} style={{ color: 'var(--accent)', animation: 'spin 1s infinite' }} />
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Generating QR session...</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {(status === 'initializing' || status === 'authenticated') && (
            <div style={{ textAlign: 'center', padding: '24px' }}>
              <Loader2 size={48} style={{ color: 'var(--accent)', animation: 'spin 2s infinite', margin: '0 auto 16px' }} />
              <h3 style={{ fontSize: '1.15rem', fontWeight: 600, marginBottom: '10px' }}>
                {status === 'authenticated' ? 'WhatsApp Linked, Finalizing Session' : 'Booting Chromium Headless Browser'}
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', maxWidth: '360px', margin: '0 auto' }}>
                {status === 'authenticated'
                  ? 'Your WhatsApp account has authenticated successfully. The session is finishing setup before the bot goes fully live.'
                  : 'Launching isolated session client environment. Generating QR authentication socket momentarily...'}
              </p>
            </div>
          )}

          {(status === 'stopped' || status === 'disconnected') && (
            <div style={{ textAlign: 'center', padding: '24px' }}>
              <Radio size={48} style={{ color: 'var(--text-muted)', margin: '0 auto 16px' }} />
              <h3 style={{ fontSize: '1.15rem', fontWeight: 600, marginBottom: '10px', color: 'var(--text-secondary)' }}>Session is Offline</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', maxWidth: '340px', margin: '0 auto 20px' }}>
                Boot up the Puppeteer client daemon above to scan the pairing QR code and activate auto-reply messaging.
              </p>
              <button className="btn btn-primary" onClick={handleStart} disabled={loading}>
                <span>Boot and Activate</span>
              </button>
            </div>
          )}

          {status === 'error' && (
            <div style={{ textAlign: 'center', padding: '24px' }}>
              <AlertTriangle size={48} style={{ color: 'var(--danger)', margin: '0 auto 16px' }} />
              <h3 style={{ fontSize: '1.15rem', fontWeight: 600, marginBottom: '10px', color: 'var(--danger)' }}>Session Crashed</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', maxWidth: '340px', margin: '0 auto 20px' }}>
                Please review your environment variables, check system resources, or click the restart button below.
              </p>
              <button className="btn btn-secondary" onClick={handleStart}>
                <span>Restart Session</span>
              </button>
            </div>
          )}
        </div>

        {/* Active Session Stats */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          <div className="stat-card" style={{ padding: '20px' }}>
            <div className="stat-icon" style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)', width: '38px', height: '38px' }}>
              <MessageSquare size={18} />
            </div>
            <div className="stat-info">
              <span className="stat-label" style={{ fontSize: '0.7rem' }}>Session Replies</span>
              <span className="stat-value" style={{ fontSize: '1.25rem' }}>{stats.messageCount}</span>
            </div>
          </div>

          <div className="stat-card" style={{ padding: '20px' }}>
            <div className="stat-icon" style={{ backgroundColor: 'rgba(37, 211, 102, 0.1)', color: 'var(--accent)', width: '38px', height: '38px' }}>
              <Clock size={18} />
            </div>
            <div className="stat-info">
              <span className="stat-label" style={{ fontSize: '0.7rem' }}>Uptime (Current Boot)</span>
              <span className="stat-value" style={{ fontSize: '1.2rem' }}>{status === 'ready' ? getUptimeStr() : '—'}</span>
            </div>
          </div>

          {/* Toggle AutoReply */}
          <div className="card" style={{ padding: '20px' }}>
            <div className="switch-wrapper" style={{ justifyContent: 'space-between' }}>
              <div>
                <span style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600 }}>Auto-Reply Logic</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  {autoReplyEnabled ? 'Listening & Replying' : 'Ignoring Messages'}
                </span>
              </div>
              <label className="switch">
                <input 
                  type="checkbox" 
                  checked={autoReplyEnabled}
                  onChange={(e) => handleToggleAutoReply(e.target.checked)}
                />
                <span className="slider"></span>
              </label>
            </div>
          </div>

          <div className="card" style={{ padding: '20px' }}>
            <div className="switch-wrapper" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ paddingRight: '16px' }}>
                <span style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600 }}>Reply In Group Chats</span>
                <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginTop: '4px' }}>
                  {respondToGroups
                    ? 'Group auto-replies are enabled for this bot.'
                    : 'Private chats only. Group auto-replies stay blocked by default.'}
                </span>
              </div>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={respondToGroups}
                  onChange={(e) => handleToggleRespondToGroups(e.target.checked)}
                />
                <span className="slider"></span>
              </label>
            </div>

            <div style={{
              marginTop: '14px',
              padding: '12px 14px',
              borderRadius: '12px',
              backgroundColor: respondToGroups ? 'rgba(245, 158, 11, 0.1)' : 'rgba(16, 185, 129, 0.08)',
              border: respondToGroups ? '1px solid rgba(245, 158, 11, 0.2)' : '1px solid rgba(16, 185, 129, 0.16)',
              color: respondToGroups ? 'var(--warning)' : 'var(--success)',
              fontSize: '0.78rem',
              lineHeight: 1.6
            }}>
              {respondToGroups
                ? 'Warning: when this is on, the bot can reply inside WhatsApp groups. Use it only if you intentionally want automated group responses.'
                : 'Recommended: keep this off unless you explicitly want the bot to answer in WhatsApp groups.'}
            </div>
          </div>
        </div>
      </div>

      {/* Live Human Handoff Panel */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div className="card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Bot size={20} style={{ color: 'var(--success)' }} />
            <span>Live Human Handoff & Cooldowns</span>
          </div>
          <span className="badge badge-muted" style={{ padding: '4px 8px' }}>
            {pausedContacts.length} Paused Chats
          </span>
        </div>
        <p className="card-description" style={{ marginTop: '-12px' }}>
          When you reply to a contact from your WhatsApp device, the AI automatically pauses for 30 minutes to let you converse. If the AI detects a handover request (marked by 🚨), it pauses indefinitely until you resume it here.
        </p>

        {pausedContacts.length === 0 ? (
          <div style={{
            border: '1px dashed rgba(16, 185, 129, 0.2)',
            borderRadius: '8px',
            padding: '24px',
            textAlign: 'center',
            backgroundColor: 'rgba(16, 185, 129, 0.03)'
          }}>
            <span style={{ color: 'var(--success)', fontWeight: 600, fontSize: '0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              ✅ AI is actively handling all customer conversations
            </span>
          </div>
        ) : (
          <div style={{ overflowX: 'auto', marginTop: '16px' }}>
            <table className="client-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr>
                  <th style={{ padding: '12px 16px' }}>Contact</th>
                  <th style={{ padding: '12px 16px' }}>Reason</th>
                  <th style={{ padding: '12px 16px' }}>Last Message</th>
                  <th style={{ padding: '12px 16px' }}>Status / Time Remaining</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pausedContacts.map((contact) => {
                  const timeRemaining = contact.expiresAt && nowTs
                    ? Math.max(0, Math.round((contact.expiresAt - nowTs) / 1000 / 60))
                    : null;

                  return (
                    <tr key={contact.contactId}>
                      <td style={{ padding: '16px', fontWeight: 600 }}>
                        {contact.contactName}
                      </td>
                      <td style={{ padding: '16px' }}>
                        {contact.reason === 'handover' ? (
                          <span className="badge badge-danger" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            🚨 Handover
                          </span>
                        ) : (
                          <span className="badge badge-warning" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            🤝 Human Took Over
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '16px', color: 'var(--text-secondary)', maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={contact.lastMessage}>
                        {contact.lastMessage || <span style={{ fontStyle: 'italic', opacity: 0.5 }}>None</span>}
                      </td>
                      <td style={{ padding: '16px', color: 'var(--text-secondary)' }}>
                        {contact.reason === 'handover' ? (
                          <span style={{ color: 'var(--danger)' }}>Indefinite</span>
                        ) : (
                          <span>
                            Auto-resumes in <strong>{timeRemaining !== null ? timeRemaining : '?'} min</strong>
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '16px', textAlign: 'right' }}>
                        <button 
                          className="btn btn-primary" 
                          style={{ 
                            backgroundColor: 'var(--success)', 
                            borderColor: 'var(--success)', 
                            padding: '6px 12px', 
                            fontSize: '0.75rem',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                          onClick={() => handleResumeContact(contact.contactId)}
                        >
                          Resume AI
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 📡 Telegram Lead Notifications */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '1.2rem' }}>📡</span>
          <span>Telegram Lead Alerts</span>
        </div>
        <p className="card-description" style={{ marginTop: '-12px' }}>
          Get instant Telegram DMs when a customer places an order, shares contact info, or requests a handover. 
          Create a free bot at <strong>@BotFather</strong> on Telegram, then enter the token and your chat ID below.
        </p>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-end' }}>
          <div className="form-group" style={{ flex: 1 }}>
            <label className="form-label">Bot Token (from @BotFather)</label>
            <input
              className="form-input"
              type="password"
              placeholder="1234567890:ABCdefGHIjklMNOpqrsTUVwxyz"
              value={config?.telegramBotToken || ''}
              onChange={(e) => setConfig(prev => prev ? { ...prev, telegramBotToken: e.target.value } : prev)}
            />
          </div>
          <div className="form-group" style={{ flex: 1 }}>
            <label className="form-label">Your Telegram Chat ID</label>
            <input
              className="form-input"
              type="text"
              placeholder="123456789"
              value={config?.telegramChatId || ''}
              onChange={(e) => setConfig(prev => prev ? { ...prev, telegramChatId: e.target.value } : prev)}
            />
          </div>
          <button
            className="btn btn-primary"
            style={{ padding: '8px 16px', fontSize: '0.8rem', whiteSpace: 'nowrap', marginBottom: '4px' }}
            onClick={async () => {
              if (!config) return;
              try {
                const res = await fetch(`/api/clients/${clientId}/config`, {
                  method: 'PUT',
                  headers: jsonAuthHeaders,
                  body: JSON.stringify({ config })
                });
                const data = await res.json();
                if (data.success) alert('✅ Telegram settings saved!');
                else alert('❌ Failed to save: ' + (data.message || 'unknown error'));
              } catch (err) {
                alert('❌ Error saving: ' + err.message);
              }
            }}
          >
            Save
          </button>
        </div>
      </div>

      {/* Dynamic Inline AI Prompt Editor */}
      <div className="card">
        <div className="card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Settings size={20} style={{ color: 'var(--accent)' }} />
            <span>AI Brain Settings (System Instruction Prompt)</span>
          </div>
          <button 
            className="btn btn-primary" 
            style={{ padding: '8px 16px', fontSize: '0.8rem' }}
            onClick={handleSavePrompt}
            disabled={savingPrompt}
          >
            {savingPrompt ? <Loader2 size={14} style={{ animation: 'spin 1s infinite' }} /> : <Save size={14} />}
            <span>Update System Prompt</span>
          </button>
        </div>
        <p className="card-description" style={{ marginTop: '-12px' }}>
          Below is the actual system prompt directing the AI's personality, catalog data, and tone of voice. Modify it directly to train or adjust the chatbot on the fly.
        </p>

        <div className="form-group">
          <textarea 
            className="form-textarea" 
            style={{ fontFamily: 'monospace', fontSize: '0.85rem', lineHeight: '1.4' }}
            rows={12}
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
          />
        </div>
      </div>
    </div>
  )
}
