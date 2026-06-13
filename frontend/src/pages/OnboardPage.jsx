import { useState } from 'react'
import { Bot, Sparkles, Send, CheckCircle, ArrowRight, ArrowLeft, Loader2 } from 'lucide-react'

const STEPS = ['Business Info', 'Review Generated AI Prompt', 'Ready to Connect']

export default function OnboardPage({ onComplete, token }) {
  const [currentStep, setCurrentStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  
  // Form State
  const [clientId, setClientId] = useState('')
  const [businessInfo, setBusinessInfo] = useState({
    name: '',
    product: '',
    priceRegular: '',
    pricePromo: '',
    rawContext: '',
  })
  
  // Resulting Generated Prompt
  const [generatedPrompt, setGeneratedPrompt] = useState('')

  const authHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`
  }

  const handleInputChange = (field, value) => {
    setBusinessInfo(prev => ({ ...prev, [field]: value }))
  }

  // Step 1: Submit Form to Generate AI Prompt
  const handleGeneratePrompt = async () => {
    if (!clientId) {
      setError('Please provide a Client Session ID.')
      return
    }
    if (!businessInfo.name) {
      setError('Please provide a Business Name.')
      return
    }

    setLoading(true)
    setError(null)
    
    try {
      const response = await fetch('/api/clients/onboard', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          clientId: clientId.trim().toLowerCase().replace(/\s+/g, '-'),
          businessInfo
        })
      })
      
      const data = await response.json()
      if (data.success) {
        setGeneratedPrompt(data.generatedPrompt)
        setCurrentStep(1) // Move to Step 2: Prompt review
      } else {
        setError(data.message || 'Failed to generate prompt.')
      }
    } catch (err) {
      setError('Network error, please check if your server is running.')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  // Step 2: Save Prompt direct modification
  const handleSavePrompt = async () => {
    setLoading(true)
    setError(null)
    
    const formattedId = clientId.trim().toLowerCase().replace(/\s+/g, '-')
    try {
      const response = await fetch(`/api/clients/${formattedId}/prompt`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ systemPrompt: generatedPrompt })
      })
      
      const data = await response.json()
      if (data.success) {
        setCurrentStep(2) // Move to Step 3: Deployment
      } else {
        setError(data.message || 'Failed to save prompt.')
      }
    } catch (err) {
      setError('Network error saving the prompt.')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  // Step 3: Trigger WhatsApp Connection and Complete Onboarding
  const handleConnectWhatsApp = async () => {
    setLoading(true)
    setError(null)
    
    const formattedId = clientId.trim().toLowerCase().replace(/\s+/g, '-')
    try {
      const response = await fetch(`/api/clients/${formattedId}/connect`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      })
      
      const data = await response.json()
      if (data.success) {
        // Successful onboarding! Direct user back to Client page
        onComplete(formattedId)
      } else {
        setError(data.message || 'Failed to trigger WhatsApp connection.')
      }
    } catch (err) {
      setError('Failed to connect to WhatsApp daemon.')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page-container" style={{ maxWidth: '800px' }}>
      <div style={{ marginBottom: '40px', textAlign: 'center' }}>
        <h2 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '6px' }}>Configure Your AI Agent</h2>
        <p style={{ color: 'var(--text-secondary)' }}>
          Create a bespoke, fine-tuned agent for your customer in under 2 minutes.
        </p>
      </div>

      {/* Wizard Step Indicator */}
      <div className="wizard-steps">
        {STEPS.map((label, idx) => (
          <div 
            key={idx} 
            className={`wizard-step ${currentStep === idx ? 'active' : ''} ${currentStep > idx ? 'completed' : ''}`}
          >
            <div className="wizard-circle">
              {currentStep > idx ? '✓' : idx + 1}
            </div>
            <div className="wizard-label">{label}</div>
          </div>
        ))}
      </div>

      {error && (
        <div style={{
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.2)',
          color: 'var(--danger)',
          padding: '12px 16px',
          borderRadius: '8px',
          fontSize: '0.9rem',
          marginBottom: '24px'
        }}>
          ⚠️ {error}
        </div>
      )}

      {/* STEP 1: BUSINESS FORM */}
      {currentStep === 0 && (
        <div className="card">
          <div className="card-title">
            <Bot size={20} style={{ color: 'var(--accent)' }} />
            <span>Step 1: Raw Customer & Business Data</span>
          </div>
          
          <div className="form-group">
            <label className="form-label">Client Session ID (Unique Name, lowercase no spaces)</label>
            <input 
              type="text"
              placeholder="e.g. smile-dental, elite-laundry, realestate-agent"
              className="form-input"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Business Name</label>
            <input 
              type="text"
              placeholder="e.g. Smile & Co. Dental Clinic"
              className="form-input"
              value={businessInfo.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Core Offerings (Products / Services)</label>
            <input 
              type="text"
              placeholder="e.g. teeth whitening, root canal, dental implants, checkups"
              className="form-input"
              value={businessInfo.product}
              onChange={(e) => handleInputChange('product', e.target.value)}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="form-group">
              <label className="form-label">Standard Pricing</label>
              <input 
                type="text"
                placeholder="e.g. Consultation $50, Whitening $299"
                className="form-input"
                value={businessInfo.priceRegular}
                onChange={(e) => handleInputChange('priceRegular', e.target.value)}
              />
            </div>
            
            <div className="form-group">
              <label className="form-label">Current Deals / Promos</label>
              <input 
                type="text"
                placeholder="e.g. 20% off teeth whitening for new clients this month"
                className="form-input"
                value={businessInfo.pricePromo}
                onChange={(e) => handleInputChange('pricePromo', e.target.value)}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Additional Knowledge, Guidelines, or FAQs</label>
            <textarea 
              placeholder="Paste any context here. E.g. Booking link is smileco.com/book. Closed Sundays. Dr. Smith is the lead surgeon. We only accept cash/visa. Cancellations must be 24h prior."
              className="form-textarea"
              rows={4}
              value={businessInfo.rawContext}
              onChange={(e) => handleInputChange('rawContext', e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '32px' }}>
            <button 
              className="btn btn-primary" 
              onClick={handleGeneratePrompt}
              disabled={loading || !clientId || !businessInfo.name}
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="status-dot qr" style={{ animation: 'pulse 1s infinite' }} />
                  <span>AI Generating Prompt...</span>
                </>
              ) : (
                <>
                  <span>Generate AI System Prompt</span>
                  <Sparkles size={16} />
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: REVIEW SYSTEM PROMPT */}
      {currentStep === 1 && (
        <div className="card">
          <div className="card-title">
            <Sparkles size={20} style={{ color: '#f59e0b' }} />
            <span>Step 2: AI-Generated Persona Instruction Draft</span>
          </div>
          
          <p className="card-description">
            The AI analyzed the customer data and compiled the following robust instruction set. You can customize, delete, or add custom rules directly.
          </p>

          <div className="form-group">
            <label className="form-label">Fine-Tuned Instruction System Prompt</label>
            <textarea 
              className="form-textarea"
              style={{ fontFamily: 'monospace', fontSize: '0.85rem', lineHeight: '1.4' }}
              rows={14}
              value={generatedPrompt}
              onChange={(e) => setGeneratedPrompt(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '32px' }}>
            <button 
              className="btn btn-secondary" 
              onClick={() => setCurrentStep(0)}
              disabled={loading}
            >
              <ArrowLeft size={16} />
              <span>Back</span>
            </button>

            <button 
              className="btn btn-primary" 
              onClick={handleSavePrompt}
              disabled={loading || !generatedPrompt}
            >
              {loading ? (
                <>
                  <Loader2 size={16} style={{ animation: 'spin 1s infinite' }} />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <span>Approve & Continue</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: CONFIRM CONNECT */}
      {currentStep === 2 && (
        <div className="card" style={{ textAlign: 'center', padding: '48px 32px' }}>
          <div className="logo-icon" style={{ margin: '0 auto 24px', width: '64px', height: '64px', borderRadius: '16px' }}>
            <CheckCircle size={32} />
          </div>

          <h3 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '12px' }}>Prompt Configured Successfully!</h3>
          <p style={{ color: 'var(--text-secondary)', maxWidth: '500px', margin: '0 auto 32px', fontSize: '0.95rem', lineHeight: '1.5' }}>
            The AI persona for <strong style={{ color: 'white' }}>{businessInfo.name}</strong> is primed. Now, let's boot up the WhatsApp client session to generate your QR Code.
          </p>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '16px' }}>
            <button 
              className="btn btn-secondary" 
              onClick={() => setCurrentStep(1)}
              disabled={loading}
            >
              <span>Review Prompt</span>
            </button>

            <button 
              className="btn btn-primary" 
              onClick={handleConnectWhatsApp}
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="status-dot qr" />
                  <span>Initializing WhatsApp daemon...</span>
                </>
              ) : (
                <>
                  <span>Spawn Bot & Generate QR</span>
                  <Send size={16} />
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
