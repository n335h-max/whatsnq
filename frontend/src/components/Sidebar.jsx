import { PlusCircle, LayoutDashboard, Bot, Radio, Shield } from 'lucide-react'

export default function Sidebar({ clients, clientStatuses, selectedClient, currentPage, canAccessAdmin, onNavigate, onSelectClient }) {
  const getStatus = (client) => clientStatuses[client.clientId] || client.status || 'stopped'

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <img src="/whatsnyq-mark.svg" alt="Whatsnyq logo" className="brand-logo-image" />
        <div>
          <div className="logo-text">Whatsnyq</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '3px' }}>
            Premium WhatsApp bot control
          </div>
        </div>
      </div>
      
      <div className="sidebar-nav">
        <div className="nav-section-title">Navigation</div>
        
        <div 
          className={`nav-link ${currentPage === 'dashboard' ? 'active' : ''}`}
          onClick={() => onNavigate('dashboard')}
        >
          <LayoutDashboard size={18} />
          <span>Dashboard Overview</span>
        </div>
        
        <div 
          className={`nav-link ${currentPage === 'onboard' ? 'active' : ''}`}
          onClick={() => onNavigate('onboard')}
        >
          <PlusCircle size={18} />
          <span>Create New Bot</span>
        </div>

        {canAccessAdmin && (
          <div 
            className={`nav-link ${currentPage === 'admin' ? 'active' : ''}`}
            onClick={() => onNavigate('admin')}
            style={{ marginTop: '4px' }}
          >
            <Shield size={18} style={{ color: currentPage === 'admin' ? 'var(--danger)' : undefined }} />
            <span>Admin Panel</span>
          </div>
        )}

        <div className="nav-section-title" style={{ marginTop: '24px' }}>Active Instances</div>
        <div className="client-list-nav">
          {clients.length === 0 ? (
            <div style={{ padding: '0 8px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              No bots configured yet.
            </div>
          ) : (
            clients.map((client) => {
              const status = getStatus(client)
              const isActive = currentPage === 'client' && selectedClient === client.clientId
              
              return (
                <div 
                  key={client.clientId}
                  className={`client-nav-item ${isActive ? 'active' : ''}`}
                  onClick={() => {
                    onSelectClient(client.clientId)
                    onNavigate('client', client.clientId)
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Bot size={16} style={{ color: isActive ? 'var(--accent)' : 'var(--text-secondary)' }} />
                    <span style={{ fontWeight: isActive ? '600' : '400', textTransform: 'capitalize' }}>
                      {client.clientId}
                    </span>
                  </div>
                  <span className={`status-dot ${status}`}></span>
                </div>
              )
            })
          )}
        </div>
      </div>

      <div className="sidebar-footer">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px', borderRadius: '14px', backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)' }}>
          <Radio size={16} className="status-dot ready" style={{ animation: 'pulse 2s infinite' }} />
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Live System</span>
            <span style={{ fontSize: '0.7rem', color: 'var(--success)' }}>Bots and services online</span>
          </div>
        </div>
      </div>
    </aside>
  )
}
