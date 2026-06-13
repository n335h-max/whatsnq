import { useState } from 'react'
import { CreditCard, Check, ShieldAlert, Loader2, Sparkles } from 'lucide-react'

export default function PaywallBlock({ trialStatus, onStartCheckout }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleCheckout = async () => {
    setLoading(true)
    setError(null)

    try {
      await onStartCheckout()
    } catch (err) {
      console.error(err)
      setError('Stripe checkout could not be started.')
      setLoading(false)
      return
    }

    setLoading(false)
  }

  return (
    <div style={{
      position: 'fixed',
      top: 72, // Below topbar
      left: 280, // Beside sidebar
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(9, 9, 14, 0.95)',
      backdropFilter: 'blur(12px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 900,
      padding: '40px'
    }}>
      <div style={{
        maxWidth: '750px',
        width: '100%',
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '32px',
        alignItems: 'start'
      }}>
        <div className="card" style={{ height: '100%', display: 'flex', flexDirection: 'column', margin: 0, padding: '32px' }}>
          <div style={{ color: 'var(--danger)', marginBottom: '16px' }}>
            <ShieldAlert size={36} />
          </div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '10px', color: 'var(--text-primary)' }}>
            Free Trial Has Expired
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.5', marginBottom: '24px' }}>
            Your access is paused because the free trial has ended. Start the Business subscription in Stripe to keep bots live, collect payment details automatically, and renew every month without manual follow-up.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1, marginBottom: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem' }}>
              <Check size={14} style={{ color: 'var(--success)' }} />
              <span>1 live WhatsApp bot slot</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem' }}>
              <Check size={14} style={{ color: 'var(--success)' }} />
              <span>1 team seat</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem' }}>
              <Check size={14} style={{ color: 'var(--success)' }} />
              <span>Core analytics dashboard</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem' }}>
              <Check size={14} style={{ color: 'var(--success)' }} />
              <span>Standard support included</span>
            </div>
          </div>

          <div style={{ borderTop: '1px solid var(--border)', paddingTop: '20px' }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
              Business Plan
            </span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
              <span style={{ fontSize: '2rem', fontWeight: 800 }}>RM50</span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>/ month</span>
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '6px' }}>
              7-day Stripe trial, then automatic recurring billing
            </div>
          </div>
        </div>

        <div className="card" style={{ margin: 0, padding: '32px', border: '1px solid rgba(37, 211, 102, 0.18)', boxShadow: '0 10px 30px rgba(37, 211, 102, 0.08)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CreditCard size={18} style={{ color: 'var(--accent)' }} />
              <span>Activate Subscription</span>
            </h3>
          </div>

          {error && (
            <div style={{
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.15)',
              color: 'var(--danger)',
              padding: '10px',
              borderRadius: '6px',
              fontSize: '0.75rem',
              marginBottom: '16px'
            }}>
              ⚠️ {error}
            </div>
          )}

          <div style={{ display: 'grid', gap: '14px' }}>
            <div className="premium-info-block">
              <span className="premium-label">Plan</span>
              <strong>{trialStatus?.plan?.name || 'Business'}</strong>
              <span>RM50 monthly</span>
            </div>
            <div className="premium-info-block">
              <span className="premium-label">Trial</span>
              <strong>7 days</strong>
              <span>Card collected by Stripe for automatic renewal</span>
            </div>
            <div className="premium-info-block">
              <span className="premium-label">Support</span>
              <strong>{trialStatus?.plan?.support || 'Standard support'}</strong>
              <span>{trialStatus?.plan?.analytics || 'Core analytics'}</span>
            </div>
          </div>

          <button
            type="button"
            className="btn btn-primary"
            style={{ width: '100%', padding: '12px', borderRadius: '8px', marginTop: '18px' }}
            disabled={loading}
            onClick={handleCheckout}
          >
            {loading ? (
              <Loader2 size={16} style={{ animation: 'spin 1s infinite' }} />
            ) : (
              <Sparkles size={16} />
            )}
            <span>{loading ? 'Opening Stripe...' : 'Start Stripe Trial'}</span>
          </button>

          <p style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: '12px', lineHeight: '1.4' }}>
            Stripe hosts the checkout and manages recurring billing automatically.
          </p>
        </div>
      </div>
    </div>
  )
}
