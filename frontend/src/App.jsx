import { useState, useEffect, useCallback } from 'react'
import { io } from 'socket.io-client'
import Sidebar from './components/Sidebar'
import AuthModal from './components/AuthModal'
import Dashboard from './pages/Dashboard'
import OnboardPage from './pages/OnboardPage'
import ClientPage from './pages/ClientPage'
import LandingPage from './pages/LandingPage'
import PaywallBlock from './pages/PaywallBlock'
import AdminPanel from './pages/AdminPanel'
import { Clock, LogOut, CreditCard } from 'lucide-react'

let socket = null
const OWNER_ADMIN_EMAIL = 'n33sh07@gmail.com'
const API_URL = import.meta.env.VITE_API_URL || ''

// ─── Session Helpers ────────────────────────────────────────────
function saveSession(user) {
  localStorage.setItem('wa_user', JSON.stringify(user))
}
function loadSession() {
  try {
    const session = JSON.parse(localStorage.getItem('wa_user'))
    if (session && !session.token) return null
    return session
  } catch {
    return null
  }
}
function clearSession() {
  localStorage.removeItem('wa_user')
}

export default function App() {
  const appName = 'Whatsnyq'
  // ─── Auth State ────────────────────────────────────────────────
  const [currentUser, setCurrentUser] = useState(() => loadSession())
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [trialStatus, setTrialStatus] = useState(null)   // { trialExpired, isPaid, trialTimeRemainingMs }
  const [nowTs, setNowTs] = useState(0)

  // ─── App State ─────────────────────────────────────────────────
  const [currentPage, setCurrentPage] = useState(() => loadSession() ? 'dashboard' : 'landing')
  const [selectedClient, setSelectedClient] = useState(null)
  const [clients, setClients] = useState([])
  const [clientStatuses, setClientStatuses] = useState({})
  const isOwnerAdmin = currentUser?.email?.toLowerCase() === OWNER_ADMIN_EMAIL

  // ─── Build auth headers for all protected API calls ────────────
  const authHeaders = useCallback(() => {
    if (!currentUser?.token) return { 'Content-Type': 'application/json' }
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${currentUser.token}`
    }
  }, [currentUser])

  // ─── Fetch trial status from backend ──────────────────────────
  const fetchTrialStatus = useCallback(async () => {
    if (!currentUser) return
    try {
      const res = await fetch(`/api/users/${currentUser.userId}/status`, { headers: authHeaders() })
      const data = await res.json()
      if (data.success) setTrialStatus(data.status)
    } catch (err) {
      console.error('[App] Failed to fetch trial status:', err)
    }
  }, [currentUser, authHeaders])

  // ─── Fetch registered client list ─────────────────────────────
  const fetchClients = useCallback(async () => {
    if (!currentUser) return
    try {
      const response = await fetch('/api/clients', { headers: authHeaders() })
      const data = await response.json()
      if (data.success && data.clients) {
        setClients(data.clients)
        const initialStatuses = {}
        data.clients.forEach(c => {
          initialStatuses[c.clientId] = c.status || 'stopped'
        })
        setClientStatuses(prev => ({ ...prev, ...initialStatuses }))
      }
    } catch (err) {
      console.error('[App] Failed to fetch clients list:', err)
    }
  }, [currentUser, authHeaders])

  // ─── Init socket and load data when user logs in ──────────────
  useEffect(() => {
    socket = io(API_URL, { transports: ['websocket', 'polling'] })
    socket.on('connect', () => {
      console.log('[Socket] Connected:', socket.id)
    })
    return () => { if (socket) socket.disconnect() }
  }, [])

  useEffect(() => {
    if (!currentUser) return
    const timeoutId = setTimeout(() => {
      fetchClients()
      fetchTrialStatus()
      setNowTs(Date.now())
    }, 0)
    // Poll trial status every 60 seconds
    const interval = setInterval(() => {
      fetchTrialStatus()
      setNowTs(Date.now())
    }, 60000)
    return () => {
      clearTimeout(timeoutId)
      clearInterval(interval)
    }
  }, [currentUser, fetchClients, fetchTrialStatus])

  // ─── Socket status listeners for each client ──────────────────
  useEffect(() => {
    if (!socket || clients.length === 0) return
    clients.forEach((client) => {
      socket.on(`client:${client.clientId}:status`, (data) => {
        setClientStatuses(prev => ({ ...prev, [client.clientId]: data.status }))
      })
    })
    return () => {
      clients.forEach((client) => {
        socket.off(`client:${client.clientId}:status`)
      })
    }
  }, [clients])

  // ─── Handlers ─────────────────────────────────────────────────
  const handleNavigate = (page, clientId = null) => {
    if (page !== 'landing' && !currentUser) {
      setShowAuthModal(true)
      return
    }
    if (page === 'admin' && !isOwnerAdmin) {
      setCurrentPage('dashboard')
      return
    }
    if (currentUser && page === 'landing') {
      setCurrentPage('dashboard')
    } else {
      setCurrentPage(page)
    }
    if (clientId) setSelectedClient(clientId)
  }

  useEffect(() => {
    if (currentPage === 'admin' && !isOwnerAdmin) {
      const timeoutId = setTimeout(() => {
        setCurrentPage(currentUser ? 'dashboard' : 'landing')
      }, 0)
      return () => clearTimeout(timeoutId)
    }
  }, [currentPage, currentUser, isOwnerAdmin])

  const handleOnboardComplete = (newClientId) => {
    fetchClients()
    setSelectedClient(newClientId)
    setCurrentPage('client')
  }

  const handleAuthSuccess = (user) => {
    saveSession(user)
    setCurrentUser(user)
    setCurrentPage('dashboard')
  }

  const handleLogout = () => {
    clearSession()
    setCurrentUser(null)
    setTrialStatus(null)
    setClients([])
    setCurrentPage('landing')
    setSelectedClient(null)
  }

  const handlePaymentSuccess = (updatedUser) => {
    saveSession(updatedUser)
    setCurrentUser(updatedUser)
    fetchTrialStatus()
  }

  const handleStartBilling = useCallback(async () => {
    if (!currentUser) return

    try {
      const response = await fetch('/api/billing/checkout-session', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ planId: 'business' })
      })
      const data = await response.json()
      if (!data.success || !data.url) {
        window.alert(data.message || 'Could not start Stripe checkout.')
        return
      }
      window.location.href = data.url
    } catch (err) {
      console.error('[Billing] Failed to start checkout:', err)
      window.alert('Could not connect to Stripe checkout.')
    }
  }, [currentUser, authHeaders])

  const handleManageBilling = useCallback(async () => {
    if (!currentUser) return

    try {
      const response = await fetch('/api/billing/portal-session', {
        method: 'POST',
        headers: authHeaders()
      })
      const data = await response.json()
      if (!data.success || !data.url) {
        window.alert(data.message || 'Billing portal is not available yet.')
        return
      }
      window.location.href = data.url
    } catch (err) {
      console.error('[Billing] Failed to open portal:', err)
      window.alert('Could not open the billing portal.')
    }
  }, [currentUser, authHeaders])

  // ─── Trial banner helpers ──────────────────────────────────────
  const formatRemaining = (ms) => {
    const totalHours = Math.floor(ms / 1000 / 3600)
    const days = Math.floor(totalHours / 24)
    const hours = totalHours % 24
    if (days > 0) return `${days}d ${hours}h`
    return `${Math.max(totalHours, 0)}h`
  }

  const getTrialLabel = () => {
    if (!trialStatus) return null
    if (trialStatus.isOwnerAdmin) return null

    if (trialStatus.subscriptionStatus === 'trialing' && trialStatus.subscriptionCurrentPeriodEnd) {
      if (!nowTs) return null
      return `${formatRemaining(Math.max(0, trialStatus.subscriptionCurrentPeriodEnd - nowTs))} left in Stripe trial`
    }
    if (trialStatus.isPaid || trialStatus.subscriptionStatus === 'active') return null
    if (trialStatus.trialExpired) return null
    return `${formatRemaining(trialStatus.trialTimeRemainingMs)} remaining in free trial`
  }

  const isBlocked = trialStatus && !trialStatus.hasAccess && trialStatus.trialExpired
  const trialLabel = getTrialLabel()

  // ─── Derive if we show sidebar (only when logged in) ──────────
  const showSidebar = !!currentUser
  const showTopBar = !(currentPage === 'landing' && !currentUser)

  return (
    <>
      {/* Auth Modal */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onSuccess={handleAuthSuccess}
      />

      {/* Sidebar — only visible when logged in */}
      {showSidebar && (
        <Sidebar
          clients={clients}
          clientStatuses={clientStatuses}
          selectedClient={selectedClient}
          currentPage={currentPage}
          canAccessAdmin={isOwnerAdmin}
          onNavigate={handleNavigate}
          onSelectClient={setSelectedClient}
        />
      )}

      <main className="main-content" style={{ marginLeft: showSidebar ? undefined : 0 }}>
        {showTopBar && (
          <div className="top-bar">
            <h1 className="page-title">
              {currentPage === 'landing'    && appName}
              {currentPage === 'dashboard'  && 'Control Center'}
              {currentPage === 'onboard'    && 'Create New Bot'}
              {currentPage === 'client'     && `Manage Agent: ${selectedClient}`}
              {currentPage === 'admin'      && 'Admin Panel'}
            </h1>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {currentUser && trialLabel && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  backgroundColor: 'rgba(245, 158, 11, 0.1)',
                  border: '1px solid rgba(245, 158, 11, 0.2)',
                  padding: '4px 12px',
                  borderRadius: '99px',
                  fontSize: '0.75rem',
                  color: 'var(--warning)',
                  fontWeight: 600
                }}>
                  <Clock size={12} />
                  <span>{trialLabel}</span>
                </div>
              )}

              {currentUser && trialStatus?.subscriptionStatus === 'trialing' && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  backgroundColor: 'rgba(37, 211, 102, 0.1)',
                  border: '1px solid rgba(37, 211, 102, 0.18)',
                  padding: '4px 12px',
                  borderRadius: '99px',
                  fontSize: '0.75rem',
                  color: 'var(--accent-soft)',
                  fontWeight: 600
                }}>
                  <CreditCard size={12} />
                  <span>Stripe Trial Active</span>
                </div>
              )}

              {currentUser && isBlocked && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.2)',
                  padding: '4px 12px',
                  borderRadius: '99px',
                  fontSize: '0.75rem',
                  color: 'var(--danger)',
                  fontWeight: 600
                }}>
                  <CreditCard size={12} />
                  <span>Trial Expired</span>
                </div>
              )}

              {currentUser && (trialStatus?.isPaid || trialStatus?.subscriptionStatus === 'active') && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  backgroundColor: 'rgba(16, 185, 129, 0.1)',
                  border: '1px solid rgba(16, 185, 129, 0.2)',
                  padding: '4px 12px',
                  borderRadius: '99px',
                  fontSize: '0.75rem',
                  color: 'var(--success)',
                  fontWeight: 600
                }}>
                  ✓ Subscription Active
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span className="status-dot ready"></span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  {currentUser ? currentUser.email : 'Gateway Connected'}
                </span>
              </div>

              {currentUser && (
                <button
                  onClick={handleLogout}
                  className="btn btn-secondary"
                  style={{ padding: '6px 12px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                  title="Sign out"
                >
                  <LogOut size={14} />
                  <span>Sign Out</span>
                </button>
              )}

              {!currentUser && (
                <button
                  className="btn btn-primary"
                  style={{ padding: '6px 16px', fontSize: '0.85rem' }}
                  onClick={() => setShowAuthModal(true)}
                >
                  Sign In
                </button>
              )}
            </div>
          </div>
        )}

        {/* ─── Pages ─────────────────────────────────────────────── */}

        {currentPage === 'landing' && (
          <LandingPage
            onNavigate={handleNavigate}
            onOpenAuth={() => setShowAuthModal(true)}
            currentUser={currentUser}
          />
        )}

        {currentUser && currentPage === 'dashboard' && (
          <Dashboard
            clients={clients}
            clientStatuses={clientStatuses}
            trialStatus={trialStatus}
            appName={appName}
            onSelectClient={setSelectedClient}
            onNavigate={handleNavigate}
            onStartBilling={handleStartBilling}
            onManageBilling={handleManageBilling}
          />
        )}

        {currentUser && currentPage === 'onboard' && (
          <OnboardPage
            onComplete={handleOnboardComplete}
            userId={currentUser.userId}
            token={currentUser.token}
          />
        )}

        {currentUser && currentPage === 'client' && selectedClient && (
          <ClientPage
            key={selectedClient}
            clientId={selectedClient}
            socket={socket}
            userId={currentUser.userId}
            token={currentUser.token}
            onRefresh={fetchClients}
            onDeleteComplete={() => {
              fetchClients()
              setCurrentPage('dashboard')
              setSelectedClient(null)
            }}
          />
        )}

        {currentUser && isOwnerAdmin && currentPage === 'admin' && (
          <AdminPanel onBack={() => setCurrentPage('dashboard')} />
        )}

        {/* ─── Paywall Overlay ────────────────────────────────────── */}
        {currentUser && isBlocked && currentPage !== 'landing' && (
          <PaywallBlock
            userId={currentUser.userId}
            trialStatus={trialStatus}
            onStartCheckout={handleStartBilling}
            onPaymentSuccess={handlePaymentSuccess}
          />
        )}
      </main>
    </>
  )
}
