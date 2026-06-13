import { useCallback, useEffect, useRef, useState } from 'react'
import { Mail, Lock, Loader2, Sparkles, X } from 'lucide-react'

const GOOGLE_SCRIPT_SRC = 'https://accounts.google.com/gsi/client'

let googleScriptPromise = null

function loadGoogleScript() {
  if (window.google?.accounts?.id) return Promise.resolve()
  if (googleScriptPromise) return googleScriptPromise

  googleScriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${GOOGLE_SCRIPT_SRC}"]`)
    if (existing) {
      existing.addEventListener('load', resolve, { once: true })
      existing.addEventListener('error', reject, { once: true })
      return
    }

    const script = document.createElement('script')
    script.src = GOOGLE_SCRIPT_SRC
    script.async = true
    script.defer = true
    script.onload = resolve
    script.onerror = () => reject(new Error('Failed to load Google Sign-In.'))
    document.head.appendChild(script)
  })

  return googleScriptPromise
}

export default function AuthModal({ isOpen, onClose, onSuccess }) {
  const [isSignUp, setIsSignUp] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  
  const [loading, setLoading] = useState(false)
  const [loadingOAuth, setLoadingOAuth] = useState(null)
  const [error, setError] = useState(null)
  const [googleEnabled, setGoogleEnabled] = useState(false)
  const [googleMessage, setGoogleMessage] = useState('')
  const googleButtonRef = useRef(null)

  const handleGoogleCredential = useCallback(async (response) => {
    if (!response?.credential) {
      setError('Google Sign-In did not return a valid credential.')
      return
    }

    setLoadingOAuth('google')
    setError(null)

    try {
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: response.credential })
      })
      const data = await res.json()
      if (data.success) {
        onSuccess({ ...data.user, token: data.token })
        onClose()
      } else {
        setError(data.message || 'Google authentication failed.')
      }
    } catch (err) {
      console.error(err)
      setError('Google Sign-In server connection failed.')
    } finally {
      setLoadingOAuth(null)
    }
  }, [onClose, onSuccess])

  useEffect(() => {
    let cancelled = false
    const buttonEl = googleButtonRef.current

    async function setupGoogle() {
      if (!isOpen) return

      setGoogleEnabled(false)
      setGoogleMessage('')

      try {
        const res = await fetch('/api/auth/google/config')
        const data = await res.json()

        if (cancelled) return

        if (!data.success || !data.enabled || !data.clientId) {
          setGoogleMessage('Google Sign-In will appear after `GOOGLE_CLIENT_ID` is added to `.env`.')
          return
        }

        await loadGoogleScript()
        if (cancelled || !googleButtonRef.current || !window.google?.accounts?.id) return

        window.google.accounts.id.initialize({
          client_id: data.clientId,
          callback: handleGoogleCredential
        })

        googleButtonRef.current.innerHTML = ''
        window.google.accounts.id.renderButton(googleButtonRef.current, {
          theme: 'outline',
          size: 'large',
          shape: 'pill',
          text: 'continue_with',
          width: 348
        })

        setGoogleEnabled(true)
      } catch (err) {
        console.error(err)
        if (!cancelled) {
          setGoogleMessage('Google Sign-In could not be loaded right now.')
        }
      }
    }

    setupGoogle()

    return () => {
      cancelled = true
      if (buttonEl) {
        buttonEl.innerHTML = ''
      }
    }
  }, [isOpen, handleGoogleCredential])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!email || !password) {
      setError('Please fill in all fields.')
      return
    }

    setLoading(true)
    setError(null)

    const endpoint = isSignUp ? '/api/auth/signup' : '/api/auth/login'

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      })
      const data = await res.json()
      if (data.success) {
        onSuccess({ ...data.user, token: data.token })
        onClose()
      } else {
        setError(data.message || 'Authentication failed.')
      }
    } catch (err) {
      console.error(err)
      setError('Could not connect to the authentication server.')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(9, 9, 14, 0.85)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '24px'
    }}>
      <div className="card" style={{
        maxWidth: '420px',
        width: '100%',
        margin: 0,
        padding: '36px',
        position: 'relative',
        boxShadow: '0 20px 50px rgba(37, 211, 102, 0.12)',
        border: '1px solid rgba(255, 255, 255, 0.08)'
      }}>
        {/* Close Button */}
        <button 
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            background: 'none',
            border: 'none',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            padding: '4px'
          }}
        >
          <X size={20} />
        </button>

        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(37, 211, 102, 0.1)',
            width: '48px',
            height: '48px',
            borderRadius: '12px',
            color: 'var(--accent)',
            marginBottom: '16px'
          }}>
            <Sparkles size={24} />
          </div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '6px' }}>
            {isSignUp ? 'Create your account' : 'Welcome back'}
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            {isSignUp ? 'Start your 7-day free trial and launch your first WhatsApp bot' : 'Sign in to manage your WhatsApp automation'}
          </p>
        </div>

        {error && (
          <div style={{
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.15)',
            color: 'var(--danger)',
            padding: '10px 14px',
            borderRadius: '8px',
            fontSize: '0.8rem',
            marginBottom: '20px'
          }}>
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Email Address</label>
            <div style={{ position: 'relative' }}>
              <input 
                type="email" 
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="form-input"
                style={{ paddingLeft: '40px' }}
                disabled={loading || !!loadingOAuth}
              />
              <Mail size={16} style={{
                position: 'absolute',
                left: '14px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-secondary)'
              }} />
            </div>
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Password</label>
            <div style={{ position: 'relative' }}>
              <input 
                type="password" 
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="form-input"
                style={{ paddingLeft: '40px' }}
                disabled={loading || !!loadingOAuth}
              />
              <Lock size={16} style={{
                position: 'absolute',
                left: '14px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-secondary)'
              }} />
            </div>
          </div>

          <button 
            type="submit" 
            className="btn btn-primary"
            style={{ width: '100%', padding: '12px', borderRadius: '8px', marginTop: '8px' }}
            disabled={loading || !!loadingOAuth}
          >
            {loading ? <Loader2 size={16} style={{ animation: 'spin 1s infinite' }} /> : null}
            <span>{isSignUp ? 'Sign Up & Start Trial' : 'Sign In'}</span>
          </button>
        </form>

        {/* Divider */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          textAlign: 'center',
          margin: '24px 0',
          fontSize: '0.75rem',
          color: 'var(--text-muted)'
        }}>
          <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border)' }}></div>
          <span style={{ padding: '0 10px' }}>OR CONTINUE WITH</span>
          <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border)' }}></div>
        </div>

        <div style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'center', minHeight: '44px' }}>
            {loadingOAuth === 'google' ? (
              <button
                className="btn btn-secondary"
                disabled
                style={{ width: '100%', maxWidth: '348px', padding: '10px' }}
              >
                <Loader2 size={14} style={{ animation: 'spin 1s infinite' }} />
                <span>Signing in with Google...</span>
              </button>
            ) : (
              <div ref={googleButtonRef} style={{ width: '100%', maxWidth: '348px' }} />
            )}
          </div>
          {!googleEnabled && googleMessage && (
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: '10px', lineHeight: '1.5' }}>
              {googleMessage}
            </p>
          )}
        </div>

        {/* Toggle link */}
        <div style={{ textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
          <button
            onClick={() => setIsSignUp(!isSignUp)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--accent)',
              cursor: 'pointer',
              fontWeight: 600,
              padding: 0
            }}
          >
            {isSignUp ? 'Sign In' : 'Start 7-Day Trial'}
          </button>
        </div>
      </div>
    </div>
  )
}
