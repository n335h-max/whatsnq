import { Crown, Layers, Bot, MessageSquare, ShieldCheck, ArrowRight, CreditCard, Sparkles } from 'lucide-react'

export default function Dashboard({
  clients,
  clientStatuses,
  trialStatus,
  appName,
  onSelectClient,
  onNavigate,
  onStartBilling,
  onManageBilling
}) {
  const getStatus = (client) => clientStatuses[client.clientId] || client.status || 'stopped'
  
  const totalBots = clients.length
  const activeBots = clients.filter(c => getStatus(c) === 'ready').length
  const totalMessages = clients.reduce((acc, c) => acc + (c.messageCount || 0), 0)
  const plan = trialStatus?.plan
  const subscriptionLabel =
    trialStatus?.subscriptionStatus === 'active'
      ? 'Active subscription'
      : trialStatus?.subscriptionStatus === 'trialing'
        ? 'Stripe trial running'
        : trialStatus?.trialExpired
          ? 'Trial expired'
          : 'Free trial'
  
  const getStatusBadge = (status) => {
    switch (status) {
      case 'ready':
        return <span className="badge badge-success">Active</span>
      case 'qr':
        return <span className="badge badge-warning">Waiting for Scan</span>
      case 'initializing':
        return <span className="badge badge-warning">Initializing</span>
      case 'stopped':
        return <span className="badge badge-muted">Stopped</span>
      case 'error':
      case 'auth_failure':
        return <span className="badge badge-danger">Connection Error</span>
      default:
        return <span className="badge badge-muted">{status}</span>
    }
  }

  return (
    <div className="page-container">
      <div className="premium-hero-card" style={{ marginBottom: '28px' }}>
        <div>
          <div className="premium-eyebrow">Founder Workspace</div>
          <h2 style={{ fontSize: '2.1rem', fontWeight: 700, marginBottom: '10px', letterSpacing: '-0.03em' }}>
            Run your WhatsApp bot business from one premium control center.
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.96rem', lineHeight: 1.7, maxWidth: '700px' }}>
            {appName} gives you one place to launch client bots, manage billing, watch bot status, and control the customer experience across every active number.
          </p>
        </div>

        <div className="premium-hero-actions">
          <button className="btn btn-primary" onClick={() => onNavigate('onboard')}>
            <span>Create New Bot</span>
            <ArrowRight size={16} />
          </button>
          <button
            className="btn btn-secondary"
            onClick={trialStatus?.stripeCustomerId ? onManageBilling : onStartBilling}
          >
            <CreditCard size={16} />
            <span>{trialStatus?.stripeCustomerId ? 'Manage Billing' : 'Start Subscription'}</span>
          </button>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon" style={{ backgroundColor: 'rgba(37, 211, 102, 0.1)', color: 'var(--accent)' }}>
            <Layers size={22} />
          </div>
          <div className="stat-info">
            <span className="stat-label">Total Bot Slots</span>
            <span className="stat-value">{totalBots}</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)' }}>
            <Bot size={22} />
          </div>
          <div className="stat-info">
            <span className="stat-label">Active Bots</span>
            <span className="stat-value">{activeBots}</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)', color: 'var(--warning)' }}>
            <MessageSquare size={22} />
          </div>
          <div className="stat-info">
            <span className="stat-label">Total Replies Sent</span>
            <span className="stat-value">{totalMessages}</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)' }}>
            <ShieldCheck size={22} />
          </div>
          <div className="stat-info">
            <span className="stat-label">API Health</span>
            <span className="stat-value" style={{ fontSize: '1.2rem', color: 'var(--success)' }}>Excellent</span>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '20px', marginBottom: '24px' }}>
        <div className="card premium-card" style={{ margin: 0 }}>
          <div className="card-title">
            <Crown size={20} style={{ color: 'var(--accent)' }} />
            <span>Current Plan</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
            <div className="premium-info-block">
              <span className="premium-label">Package</span>
              <strong>{plan?.name || 'Business'}</strong>
              <span>{subscriptionLabel}</span>
            </div>
            <div className="premium-info-block">
              <span className="premium-label">Bot Limit</span>
              <strong>{plan?.botLimit ?? 'Custom'}</strong>
              <span>{totalBots} used</span>
            </div>
            <div className="premium-info-block">
              <span className="premium-label">Team Seats</span>
              <strong>{plan?.teamSeats ?? 'Custom'}</strong>
              <span>Owner workspace</span>
            </div>
            <div className="premium-info-block">
              <span className="premium-label">Analytics</span>
              <strong>{plan?.analytics || 'Core analytics'}</strong>
              <span>{plan?.support || 'Standard support'}</span>
            </div>
          </div>
        </div>

        <div className="card premium-card" style={{ margin: 0 }}>
          <div className="card-title">
            <Sparkles size={20} style={{ color: 'var(--success)' }} />
            <span>Billing Actions</span>
          </div>
          <p className="card-description">
            Business plan is `RM50/month` with a `7-day Stripe trial`, automatic renewal, and one live bot slot.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <button className="btn btn-primary" onClick={onStartBilling}>
              <span>Start Business Subscription</span>
            </button>
            <button className="btn btn-secondary" onClick={onManageBilling} disabled={!trialStatus?.stripeCustomerId}>
              <span>Open Billing Portal</span>
            </button>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-title">
          <Bot size={20} style={{ color: 'var(--accent)' }} />
          <span>Configured WhatsApp Clients</span>
        </div>
        
        {clients.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '20px' }}>
              No WhatsApp client slots have been configured yet.
            </p>
            <button className="btn btn-primary" onClick={() => onNavigate('onboard')}>
              Create Your First Bot
            </button>
          </div>
        ) : (
          <table className="client-table">
            <thead>
              <tr>
                <th>Client Session ID</th>
                <th>Status</th>
                <th>Uptime</th>
                <th>Messages Sent</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((client) => {
                const status = getStatus(client)
                const uptimeMins = Math.floor(client.uptime / 60)
                const uptimeStr = uptimeMins > 60 
                  ? `${Math.floor(uptimeMins / 60)}h ${uptimeMins % 60}m` 
                  : `${uptimeMins}m`

                return (
                  <tr key={client.clientId}>
                    <td style={{ fontWeight: 600, textTransform: 'capitalize' }}>
                      {client.clientId}
                    </td>
                    <td>{getStatusBadge(status)}</td>
                    <td>{status === 'ready' ? uptimeStr : '—'}</td>
                    <td>{client.messageCount || 0}</td>
                    <td style={{ textAlign: 'right' }}>
                      <button 
                        className="btn btn-secondary" 
                        style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                        onClick={() => {
                          onSelectClient(client.clientId)
                          onNavigate('client', client.clientId)
                        }}
                      >
                        <span>Manage</span>
                        <ArrowRight size={14} />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
