import { useMemo, useState } from 'react'
import {
  MessageSquare,
  Check,
  Sparkles,
  Smartphone,
  ArrowRight,
  Lock,
  RefreshCw,
  Zap,
  ShieldAlert,
  Send
} from 'lucide-react'

const appName = 'Whatsnyq'

const copy = {
  en: {
    brandTagline: 'WhatsApp sales automation for local businesses',
    navFeatures: 'Features',
    navDemo: 'Demo',
    navPricing: 'Pricing',
    signIn: 'Sign In',
    openDashboard: 'Open Dashboard',
    startTrial: 'Start 7-Day Trial',
    eyebrow: 'Clear hook, simple pricing, fast onboarding',
    heroTitle: 'Turn every WhatsApp enquiry into a reply, booking, or sale.',
    heroBody:
      'Whatsnyq helps businesses reply automatically on WhatsApp, answer common questions, capture leads, and hand over to a real human when needed. Set it up, scan the QR, and start serving customers 24/7.',
    heroCtaLoggedIn: 'Create New Bot',
    heroCtaLoggedOut: 'Start 7-Day Free Trial',
    heroSecondary: 'See Live Demo',
    miniFastTitle: 'Fast replies',
    miniFastBody: 'Answers customers automatically around the clock.',
    miniLaunchTitle: 'Easy launch',
    miniLaunchBody: 'Go live with one QR scan and simple setup.',
    miniWhatsTitle: 'Built for WhatsApp',
    miniWhatsBody: 'Made for lead capture, FAQs, and follow-ups.',
    trustEyebrow: 'Why Businesses Choose Us',
    trustTitle: 'Built to win leads on WhatsApp',
    pricingLabel: 'Pricing',
    pricingPrice: 'RM50 / month',
    pricingNote: 'Week 1 is free',
    googleLabel: 'Google Sign-In',
    googleReady: 'Ready',
    googleNote: 'Works once client ID is added',
    demoEyebrow: 'Live Demo',
    demoTitle: 'See how your bot feels before it goes live.',
    demoBody: 'Use this demo during your sales pitch. It makes the value obvious: customers ask questions, the bot responds instantly, and handover happens when needed.',
    demoPoint1Title: 'Looks useful immediately',
    demoPoint1Body: 'The value is clear: faster replies and higher conversion from WhatsApp enquiries.',
    demoPoint2Title: 'Easy to explain',
    demoPoint2Body: 'Position it as a WhatsApp sales assistant with smooth human handover.',
    demoTypePlaceholder: 'Type a message...',
    featuresEyebrow: 'Core Features',
    featuresTitle: 'Everything needed to run a premium WhatsApp bot service',
    featuresBody: 'Clean onboarding, one control center, clearer pricing, and Google Sign-In support make the whole experience feel more premium.',
    pricingEyebrow: 'Pricing',
    pricingTitle: 'Keep the offer simple and easy to close',
    pricingBody: 'One fixed business plan and one custom plan for larger needs. It stays simple, premium, and easy for customers to understand.',
    footerExplore: 'Explore',
    footerGetStarted: 'Get Started',
    footerLine: 'We build premium WhatsApp bots for local businesses that want faster replies, better lead capture, and 24/7 customer coverage.',
    footerPlanLine: 'Business plan starts at RM50 per month after the first free week.',
    footerCtaLoggedIn: 'Go To Dashboard',
    footerCtaLoggedOut: 'Start 7-Day Trial'
  },
  ms: {
    brandTagline: 'Automasi WhatsApp pintar untuk bisnes tempatan',
    navFeatures: 'Ciri-ciri',
    navDemo: 'Demo',
    navPricing: 'Harga',
    signIn: 'Log Masuk',
    openDashboard: 'Buka Dashboard',
    startTrial: 'Mulakan Percubaan 7 Hari',
    eyebrow: 'Automasi mudah, harga telus, mula dalam beberapa minit',
    heroTitle: 'Tukar setiap pertanyaan WhatsApp kepada peluang jualan.',
    heroBody:
      'Whatsnyq membantu perniagaan membalas mesej secara automatik, menjawab soalan pelanggan, mengumpul prospek, dan menyerahkan perbualan kepada staf apabila diperlukan. Hanya tetapkan, imbas kod QR, dan mula beroperasi 24/7.',
    heroCtaLoggedIn: 'Cipta Bot Baharu',
    heroCtaLoggedOut: 'Mulakan Percubaan 7 Hari',
    heroSecondary: 'Lihat Demo',
    miniFastTitle: 'Balasan Automatik',
    miniFastBody: 'Layan pelanggan dengan pantas pada bila-bila masa.',
    miniLaunchTitle: 'Mula Dengan Cepat',
    miniLaunchBody: 'Aktif dalam beberapa minit dengan satu imbasan QR.',
    miniWhatsTitle: 'Dibina Untuk WhatsApp',
    miniWhatsBody: 'Sesuai untuk prospek, FAQ dan susulan pelanggan.',
    trustEyebrow: 'Mengapa Memilih Whatsnyq',
    trustTitle: 'Direka untuk membantu bisnes berkembang melalui WhatsApp',
    pricingLabel: 'Harga',
    pricingPrice: 'RM50 / bulan',
    pricingNote: '7 hari percuma',
    googleLabel: 'Log Masuk Dengan Google',
    googleReady: 'Tersedia',
    googleNote: 'Berfungsi selepas Google Client ID dikonfigurasikan',
    demoEyebrow: 'Demo Interaktif',
    demoTitle: 'Lihat bagaimana bot anda berfungsi sebelum dilancarkan.',
    demoBody: 'Gunakan demo ini semasa pembentangan atau jualan. Pelanggan bertanya, bot menjawab, dan staf mengambil alih apabila diperlukan.',
    demoPoint1Title: 'Nilai yang jelas',
    demoPoint1Body: 'Respons lebih pantas dan lebih banyak peluang jualan daripada pertanyaan WhatsApp.',
    demoPoint2Title: 'Mudah diterangkan',
    demoPoint2Body: 'Pembantu jualan WhatsApp yang beroperasi secara automatik dengan pemindahan kepada manusia yang lancar.',
    demoTypePlaceholder: 'Taip mesej anda...',
    featuresEyebrow: 'Ciri-ciri Utama',
    featuresTitle: 'Semua yang diperlukan untuk perkhidmatan bot WhatsApp premium',
    featuresBody: 'Onboarding yang mudah, dashboard berpusat, harga yang jelas dan integrasi Google Sign-In untuk pengalaman yang lebih profesional.',
    pricingEyebrow: 'Pelan Harga',
    pricingTitle: 'Pelan mudah difahami dan mudah dijual',
    pricingBody: 'Pilih antara pelan standard untuk kebanyakan bisnes atau pelan tersuai untuk keperluan yang lebih kompleks.',
    footerExplore: 'Teroka',
    footerGetStarted: 'Mula Sekarang',
    footerLine: 'Kami membina penyelesaian automasi WhatsApp untuk membantu bisnes membalas pelanggan dengan lebih pantas, menjana lebih banyak prospek dan beroperasi sepanjang masa.',
    footerPlanLine: 'Pelan Bisnes bermula dari RM50 sebulan selepas tempoh percubaan 7 hari.',
    footerCtaLoggedIn: 'Pergi ke Dashboard',
    footerCtaLoggedOut: 'Mulakan Percubaan 7 Hari'
  }
}

const businessPointsByLang = {
  en: [
    'Replies to new enquiries automatically',
    'Answers pricing and FAQ questions',
    'Captures leads and booking intent',
    'Works 24/7 on your WhatsApp number'
  ],
  ms: [
    'Membalas pertanyaan pelanggan secara automatik',
    'Menjawab soalan berkaitan harga dan perkhidmatan',
    'Mengumpul prospek dan permintaan tempahan',
    'Beroperasi 24 jam sehari, 7 hari seminggu'
  ]
}

const demoIntroByLang = {
  en: 'Hi, welcome to UrbanBrew. I can help with pricing, menu questions, and orders.',
  ms: 'Hai, selamat datang ke UrbanBrew. Saya boleh membantu anda mengenai harga, menu dan tempahan.'
}

const demoPresetsByLang = {
  en: [
    'What packages do you offer?',
    'How much is your most popular package?',
    'Can I book or order today?',
    'I want to talk to a human'
  ],
  ms: [
    'Apakah pakej yang tersedia?',
    'Berapakah harga pakej yang paling popular?',
    'Bolehkah saya membuat tempahan hari ini?',
    'Saya ingin bercakap dengan staf'
  ]
}

export default function LandingPage({ onNavigate, onOpenAuth, currentUser }) {
  const [lang, setLang] = useState(() => {
    const stored = window.localStorage.getItem('whatsnyq_lang')
    return stored === 'ms' ? 'ms' : 'en'
  })
  const [demoInput, setDemoInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [messages, setMessages] = useState([
    { sender: 'bot', text: demoIntroByLang[lang], time: '10:00 AM' }
  ])
  const presets = demoPresetsByLang[lang]

  const t = useMemo(() => {
    const selected = copy[lang] || copy.en
    return (key) => selected[key] || copy.en[key] || key
  }, [lang])

  const setLanguage = (next) => {
    setLang(next)
    window.localStorage.setItem('whatsnyq_lang', next)
    setDemoInput('')
    setIsTyping(false)
    setMessages([{ sender: 'bot', text: demoIntroByLang[next], time: '10:00 AM' }])
  }

  const featureCards = useMemo(() => {
    if (lang === 'ms') {
      return [
        {
          icon: Sparkles,
          color: 'var(--accent)',
          title: 'Pembina Prompt Pantas',
          description: 'Tukar FAQ, senarai harga, dan nota servis kepada assistant WhatsApp yang siap digunakan dalam beberapa minit.'
        },
        {
          icon: ShieldAlert,
          color: 'var(--success)',
          title: 'Handover Manusia',
          description: 'Bila pelanggan minta manusia, bot berhenti dan serah kepada team anda dengan segera.'
        },
        {
          icon: Lock,
          color: '#148f49',
          title: 'Sesi Selamat',
          description: 'Setiap client guna sesi WhatsApp berasingan supaya akaun kekal terasing dan senang diurus.'
        },
        {
          icon: RefreshCw,
          color: '#1fa45a',
          title: 'Dashboard Live',
          description: 'Pantau status, scan QR, kemas kini prompt, dan urus banyak client dalam satu workspace.'
        }
      ]
    }

    return [
      {
        icon: Sparkles,
        color: 'var(--accent)',
        title: 'Fast Prompt Builder',
        description: 'Turn your FAQ, price list, and service notes into a ready-to-use WhatsApp assistant in minutes.'
      },
      {
        icon: ShieldAlert,
        color: 'var(--success)',
        title: 'Human Handover',
        description: 'When a customer asks for a person, the bot stops and lets your team take over immediately.'
      },
      {
        icon: Lock,
        color: '#148f49',
        title: 'Secure Session Storage',
        description: 'Each client keeps a separate WhatsApp session so accounts stay isolated and easier to manage.'
      },
      {
        icon: RefreshCw,
        color: '#1fa45a',
        title: 'Live Dashboard',
        description: 'Monitor status, scan QR, update prompts, and manage multiple clients from one workspace.'
      }
    ]
  }, [lang])

  const pricingPlans = useMemo(() => {
    if (lang === 'ms') {
      return [
        {
          label: 'Bisnes',
          price: 'RM50',
          suffix: '/ bulan',
          badge: 'Percubaan 7 Hari',
          description: 'Sesuai untuk perniagaan yang ingin mengaktifkan bot WhatsApp dengan cepat dan mudah.',
          features: [
            '1 nombor WhatsApp aktif',
            '1 akaun pengguna',
            'Dashboard analitik asas',
            'Sokongan standard',
            'Percubaan percuma selama 7 hari'
          ],
          cta: 'Mulakan Percubaan 7 Hari',
          primary: true
        },
        {
          label: 'Tersuai',
          price: 'Tersedia',
          suffix: 'untuk dibincangkan',
          badge: 'Penyelesaian Fleksibel',
          description: 'Sesuai untuk agensi, syarikat berskala besar atau perniagaan dengan pelbagai cawangan.',
          features: [
            'Bilangan bot yang fleksibel',
            'Bilangan pengguna yang fleksibel',
            'Analitik lanjutan',
            'Sokongan keutamaan',
            'Konfigurasi dan harga yang boleh disesuaikan'
          ],
          cta: 'Hubungi Kami',
          primary: false
        }
      ]
    }

    return [
      {
        label: 'Business',
        price: 'RM50',
        suffix: '/ month',
        badge: '7-Day Free Trial',
        description: 'For businesses that want one WhatsApp bot live fast, with the first week free before billing starts.',
        features: [
          '1 active WhatsApp number',
          '1 team seat',
          'Core analytics dashboard',
          'Standard support',
          '7-day free trial'
        ],
        cta: 'Start 7-Day Trial',
        primary: true
      },
      {
        label: 'Custom',
        price: 'Available',
        suffix: 'for discussion',
        badge: 'Flexible Setup',
        description: 'For agencies or multi-branch businesses that need a custom arrangement.',
        features: [
          'Custom number of WhatsApp bots',
          'Custom team seats',
          'Advanced analytics options',
          'Priority support',
          'Flexible setup and pricing'
        ],
        cta: 'Discuss Your Setup',
        primary: false
      }
    ]
  }, [lang])

  const handlePrimaryAction = () => {
    if (currentUser) {
      onNavigate('onboard')
      return
    }
    onOpenAuth()
  }

  const handleSendDemoMessage = async (text) => {
    if (!text.trim() || isTyping) return

    const trimmedText = text.trim()

    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    const userMessage = { sender: 'user', text: trimmedText, time: now }
    const nextMessages = [...messages, userMessage]

    setMessages(nextMessages)
    setDemoInput('')
    setIsTyping(true)

    try {
      const response = await fetch('/api/demo/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          lang,
          message: trimmedText,
          history: nextMessages.slice(0, -1)
        })
      })

      const data = await response.json()
      const fallbackReply = lang === 'ms'
        ? 'Maaf, demo sedang sibuk sekarang. Sila cuba lagi sebentar lagi.'
        : 'Sorry, the demo is busy right now. Please try again in a moment.'
      const reply = data?.success && data?.reply ? data.reply : fallbackReply

      setMessages((prev) => [
        ...prev,
        {
          sender: 'bot',
          text: reply,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ])
    } catch (err) {
      console.error('[Landing Demo] Failed to get reply:', err)
      setMessages((prev) => [
        ...prev,
        {
          sender: 'bot',
          text: lang === 'ms'
            ? 'Maaf, demo sedang sibuk sekarang. Sila cuba lagi sebentar lagi.'
            : 'Sorry, the demo is busy right now. Please try again in a moment.',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ])
    } finally {
      setIsTyping(false)
    }
  }

  return (
    <div style={{
      backgroundColor: 'var(--bg-primary)',
      color: 'var(--text-primary)',
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: 'var(--font-sans)'
    }}>
      <header style={{
        position: 'sticky',
        top: 0,
        zIndex: 20,
        backdropFilter: 'blur(14px)',
        backgroundColor: 'rgba(248, 253, 248, 0.84)',
        borderBottom: '1px solid var(--border)'
      }}>
        <div style={{
          maxWidth: '1180px',
          margin: '0 auto',
          padding: '18px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          flexWrap: 'wrap'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <img src="/whatsnyq-mark.svg" alt="Whatsnyq logo" className="brand-logo-image" />
            <div>
              <div className="landing-wordmark">{appName}</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{t('brandTagline')}</div>
            </div>
          </div>

          <nav className="landing-nav-shell">
            <a href="#features" className="landing-nav-link">{t('navFeatures')}</a>
            <a href="#demo" className="landing-nav-link">{t('navDemo')}</a>
            <a href="#pricing" className="landing-nav-link">{t('navPricing')}</a>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button
                type="button"
                onClick={() => setLanguage('en')}
                className="btn btn-secondary"
                style={{
                  padding: '8px 12px',
                  borderRadius: '999px',
                  fontSize: '0.82rem',
                  backgroundColor: lang === 'en' ? 'rgba(37, 211, 102, 0.14)' : undefined,
                  borderColor: lang === 'en' ? 'rgba(37, 211, 102, 0.18)' : undefined
                }}
              >
                EN
              </button>
              <button
                type="button"
                onClick={() => setLanguage('ms')}
                className="btn btn-secondary"
                style={{
                  padding: '8px 12px',
                  borderRadius: '999px',
                  fontSize: '0.82rem',
                  backgroundColor: lang === 'ms' ? 'rgba(37, 211, 102, 0.14)' : undefined,
                  borderColor: lang === 'ms' ? 'rgba(37, 211, 102, 0.18)' : undefined
                }}
              >
                BM
              </button>
            </div>
            <button className="btn btn-secondary" onClick={onOpenAuth}>{t('signIn')}</button>
            <button className="btn btn-primary" onClick={handlePrimaryAction}>
              <span>{currentUser ? t('openDashboard') : t('startTrial')}</span>
              <ArrowRight size={16} />
            </button>
          </nav>
        </div>
      </header>

      <section style={{
        padding: '72px 24px 64px',
        background: 'radial-gradient(circle at 20% 10%, rgba(37, 211, 102, 0.18) 0%, transparent 34%), radial-gradient(circle at 80% 20%, rgba(15, 154, 87, 0.1) 0%, transparent 26%)'
      }}>
        <div style={{
          maxWidth: '1180px',
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '40px',
          alignItems: 'center'
        }}>
          <div>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '7px 14px',
              borderRadius: '999px',
              backgroundColor: 'rgba(37, 211, 102, 0.1)',
              border: '1px solid rgba(37, 211, 102, 0.18)',
              color: 'var(--accent-soft)',
              fontSize: '0.82rem',
              fontWeight: 600,
              marginBottom: '20px'
            }}>
              <Sparkles size={14} />
              <span>{t('eyebrow')}</span>
            </div>

            <h1 style={{
              fontSize: 'clamp(2.6rem, 6vw, 4.4rem)',
              lineHeight: 1.04,
              letterSpacing: '-0.04em',
              fontWeight: 800,
              marginBottom: '18px'
            }}>
              {t('heroTitle')}
            </h1>

            <p style={{
              fontSize: '1.06rem',
              color: 'var(--text-secondary)',
              lineHeight: 1.75,
              maxWidth: '640px',
              marginBottom: '28px'
            }}>
              {t('heroBody')}
            </p>

            <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', marginBottom: '28px' }}>
              <button className="btn btn-primary" style={{ padding: '14px 22px', borderRadius: '10px' }} onClick={handlePrimaryAction}>
                <span>{currentUser ? t('heroCtaLoggedIn') : t('heroCtaLoggedOut')}</span>
                <ArrowRight size={16} />
              </button>
              <a href="#demo" className="btn btn-secondary" style={{ padding: '14px 22px', borderRadius: '10px' }}>
                {t('heroSecondary')}
              </a>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
              <div className="card" style={{ margin: 0, padding: '22px', minHeight: '132px' }}>
                <div style={{ color: 'var(--accent)', marginBottom: '10px' }}><MessageSquare size={18} /></div>
                <div style={{ fontWeight: 700, marginBottom: '4px' }}>{t('miniFastTitle')}</div>
                <div style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{t('miniFastBody')}</div>
              </div>
              <div className="card" style={{ margin: 0, padding: '22px', minHeight: '132px' }}>
                <div style={{ color: 'var(--success)', marginBottom: '10px' }}><Zap size={18} /></div>
                <div style={{ fontWeight: 700, marginBottom: '4px' }}>{t('miniLaunchTitle')}</div>
                <div style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{t('miniLaunchBody')}</div>
              </div>
              <div className="card" style={{ margin: 0, padding: '22px', minHeight: '132px' }}>
                <div style={{ color: 'var(--accent-soft)', marginBottom: '10px' }}><Smartphone size={18} /></div>
                <div style={{ fontWeight: 700, marginBottom: '4px' }}>{t('miniWhatsTitle')}</div>
                <div style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{t('miniWhatsBody')}</div>
              </div>
            </div>
          </div>

          <div className="card" style={{
            margin: 0,
            padding: '28px',
            background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.96) 0%, rgba(242, 251, 245, 0.98) 100%)',
            border: '1px solid rgba(37, 211, 102, 0.12)',
            boxShadow: '0 26px 60px rgba(34, 116, 71, 0.08)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', marginBottom: '24px' }}>
              <div>
                <div style={{ fontSize: '0.78rem', color: 'var(--accent-soft)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>
                  {t('trustEyebrow')}
                </div>
                <h2 style={{ fontSize: '1.6rem', fontWeight: 700 }}>{t('trustTitle')}</h2>
              </div>
              <div style={{
                width: '46px',
                height: '46px',
                borderRadius: '12px',
                backgroundColor: 'rgba(37, 211, 102, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Sparkles size={22} style={{ color: 'var(--accent)' }} />
              </div>
            </div>

            <div style={{ display: 'grid', gap: '12px', marginBottom: '22px' }}>
              {(businessPointsByLang[lang] || businessPointsByLang.en).map((point) => (
                <div key={point} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '12px 14px',
                  borderRadius: '12px',
                  backgroundColor: 'rgba(255, 255, 255, 0.86)',
                  border: '1px solid rgba(17, 138, 67, 0.08)',
                  boxShadow: '0 8px 20px rgba(34, 116, 71, 0.05)'
                }}>
                  <Check size={16} style={{ color: 'var(--success)' }} />
                  <span style={{ fontSize: '0.92rem' }}>{point}</span>
                </div>
              ))}
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
              gap: '12px'
            }}>
              <div style={{ padding: '14px', borderRadius: '12px', backgroundColor: 'rgba(37, 211, 102, 0.08)', border: '1px solid rgba(37, 211, 102, 0.16)' }}>
                <div style={{ fontSize: '0.76rem', color: 'var(--accent-soft)', marginBottom: '6px' }}>{t('pricingLabel')}</div>
                <div style={{ fontSize: '1.15rem', fontWeight: 700 }}>{t('pricingPrice')}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>{t('pricingNote')}</div>
              </div>
              <div style={{ padding: '14px', borderRadius: '12px', backgroundColor: 'rgba(15, 154, 87, 0.08)', border: '1px solid rgba(15, 154, 87, 0.16)' }}>
                <div style={{ fontSize: '0.76rem', color: 'var(--accent-soft)', marginBottom: '6px' }}>{t('googleLabel')}</div>
                <div style={{ fontSize: '1.15rem', fontWeight: 700 }}>{t('googleReady')}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>{t('googleNote')}</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="demo" style={{
        padding: '72px 24px',
        maxWidth: '1180px',
        width: '100%',
        margin: '0 auto',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: '42px',
        alignItems: 'center'
      }}>
        <div>
          <div style={{ fontSize: '0.84rem', color: 'var(--accent-soft)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px' }}>
            {t('demoEyebrow')}
          </div>
          <h2 style={{ fontSize: '2.3rem', fontWeight: 700, letterSpacing: '-0.03em', marginBottom: '18px' }}>
            {t('demoTitle')}
          </h2>
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.75, marginBottom: '24px' }}>
            {t('demoBody')}
          </p>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '28px' }}>
            {presets.map((preset) => (
              <button
                key={preset}
                onClick={() => handleSendDemoMessage(preset)}
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid var(--border)',
                  borderRadius: '999px',
                  padding: '10px 14px',
                  color: 'var(--text-primary)',
                  fontSize: '0.82rem',
                  cursor: 'pointer'
                }}
              >
                {preset}
              </button>
            ))}
          </div>

          <div style={{ display: 'grid', gap: '16px' }}>
            <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
              <div style={{
                width: '42px',
                height: '42px',
                borderRadius: '10px',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--success)'
              }}>
                <Zap size={18} />
              </div>
              <div>
                <div style={{ fontWeight: 600, marginBottom: '6px' }}>{t('demoPoint1Title')}</div>
                <div style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  {t('demoPoint1Body')}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
              <div style={{
                width: '42px',
                height: '42px',
                borderRadius: '10px',
                backgroundColor: 'rgba(37, 211, 102, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--accent)'
              }}>
                <MessageSquare size={18} />
              </div>
              <div>
                <div style={{ fontWeight: 600, marginBottom: '6px' }}>{t('demoPoint2Title')}</div>
                <div style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  {t('demoPoint2Body')}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <div style={{
            width: '340px',
            maxWidth: '100%',
            height: '580px',
            backgroundColor: '#0c0d14',
            borderRadius: '36px',
            border: '8px solid #2e2f3d',
            boxShadow: '0 25px 50px -12px rgba(25, 80, 46, 0.3), 0 0 30px rgba(37, 211, 102, 0.1)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            fontFamily: 'sans-serif'
          }}>
            <div style={{
              backgroundColor: '#075e54',
              padding: '16px 12px 12px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              borderBottom: '1px solid rgba(255,255,255,0.05)'
            }}>
              <div style={{
                width: '34px',
                height: '34px',
                borderRadius: '50%',
                backgroundColor: 'rgba(255,255,255,0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontWeight: 'bold',
                fontSize: '0.85rem'
              }}>
                UB
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ color: '#fff', fontSize: '0.85rem', fontWeight: 600 }}>UrbanBrew Assistant</div>
                <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.65rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ width: '6px', height: '6px', backgroundColor: '#4ade80', borderRadius: '50%' }}></span>
                  <span>Online</span>
                </div>
              </div>
            </div>

            <div style={{
              flex: 1,
              background: 'linear-gradient(180deg, #efeae2 0%, #e6ded1 100%)',
              padding: '16px',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}>
              {messages.map((msg, index) => (
                <div
                  key={`${msg.time}-${index}`}
                  style={{
                    alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                    backgroundColor: msg.sender === 'user' ? '#dcf8c6' : '#fff',
                    color: '#303030',
                    padding: '8px 12px',
                    borderRadius: msg.sender === 'user' ? '12px 0 12px 12px' : '0 12px 12px 12px',
                    maxWidth: '85%',
                    fontSize: '0.8rem',
                    lineHeight: 1.5,
                    boxShadow: '0 1px 1px rgba(0,0,0,0.1)',
                    border: msg.text.includes('[HANDOVER') ? '1px solid rgba(239, 68, 68, 0.45)' : 'none'
                  }}
                >
                  {msg.text.includes('[HANDOVER') ? (
                    <div>
                      <div style={{ color: 'var(--danger)', fontWeight: 700, fontSize: '0.68rem', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}>
                        <ShieldAlert size={12} />
                        <span>HANDOVER SENT TO TEAM</span>
                      </div>
                      <div>{msg.text.replace(' [HANDOVER Triggered]', '')}</div>
                    </div>
                  ) : (
                    msg.text
                  )}
                  <span style={{
                    display: 'block',
                    textAlign: 'right',
                    fontSize: '0.55rem',
                    color: '#8b8b8b',
                    marginTop: '4px'
                  }}>
                    {msg.time}
                  </span>
                </div>
              ))}

              {isTyping && (
                <div style={{
                  alignSelf: 'flex-start',
                  backgroundColor: '#fff',
                  padding: '8px 16px',
                  borderRadius: '0 12px 12px 12px',
                  boxShadow: '0 1px 1px rgba(0,0,0,0.1)',
                  display: 'flex',
                  gap: '4px'
                }}>
                  <span style={{ width: '5px', height: '5px', backgroundColor: '#8b8b8b', borderRadius: '50%', animation: 'pulse 1s infinite' }}></span>
                  <span style={{ width: '5px', height: '5px', backgroundColor: '#8b8b8b', borderRadius: '50%', animation: 'pulse 1s infinite 0.2s' }}></span>
                  <span style={{ width: '5px', height: '5px', backgroundColor: '#8b8b8b', borderRadius: '50%', animation: 'pulse 1s infinite 0.4s' }}></span>
                </div>
              )}
            </div>

            <div style={{
              backgroundColor: '#f0f0f0',
              padding: '8px 12px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <input
                type="text"
                placeholder={t('demoTypePlaceholder')}
                value={demoInput}
                onChange={(e) => setDemoInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendDemoMessage(demoInput)}
                style={{
                  flex: 1,
                  border: 'none',
                  outline: 'none',
                  padding: '8px 14px',
                  borderRadius: '20px',
                  fontSize: '0.8rem',
                  backgroundColor: '#fff',
                  color: '#000'
                }}
              />
              <button
                onClick={() => handleSendDemoMessage(demoInput)}
                style={{
                  border: 'none',
                  backgroundColor: '#075e54',
                  color: '#fff',
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer'
                }}
              >
                <Send size={14} />
              </button>
            </div>
          </div>
        </div>
      </section>

      <section id="features" style={{
        padding: '72px 24px',
        backgroundColor: 'var(--bg-secondary)',
        borderTop: '1px solid var(--border)',
        borderBottom: '1px solid var(--border)'
      }}>
        <div style={{ maxWidth: '1180px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', maxWidth: '720px', margin: '0 auto 42px' }}>
            <div style={{ fontSize: '0.84rem', color: 'var(--accent-soft)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px' }}>
              {t('featuresEyebrow')}
            </div>
            <h2 style={{ fontSize: '2.2rem', fontWeight: 700, letterSpacing: '-0.03em', marginBottom: '14px' }}>
              {t('featuresTitle')}
            </h2>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7 }}>
              {t('featuresBody')}
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '24px' }}>
            {featureCards.map(({ icon: Icon, color, title, description }) => (
              <div key={title} className="card" style={{ margin: 0, padding: '24px' }}>
                <div style={{ color, marginBottom: '16px' }}>
                  <Icon size={24} />
                </div>
                <h3 style={{ fontSize: '1.08rem', fontWeight: 600, marginBottom: '8px' }}>{title}</h3>
                <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                  {description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="pricing" style={{ padding: '72px 24px', maxWidth: '1180px', width: '100%', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', maxWidth: '720px', margin: '0 auto 42px' }}>
          <div style={{ fontSize: '0.84rem', color: 'var(--accent-soft)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px' }}>
            {t('pricingEyebrow')}
          </div>
          <h2 style={{ fontSize: '2.2rem', fontWeight: 700, letterSpacing: '-0.03em', marginBottom: '14px' }}>
            {t('pricingTitle')}
          </h2>
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7 }}>
            {t('pricingBody')}
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '28px' }}>
          {pricingPlans.map((plan) => (
            <div
              key={plan.label}
              className="card"
              style={{
                margin: 0,
                padding: '32px',
                display: 'flex',
                flexDirection: 'column',
                border: plan.primary ? '1px solid rgba(37, 211, 102, 0.28)' : '1px solid var(--border)',
                boxShadow: plan.primary ? '0 0 30px rgba(37, 211, 102, 0.12)' : undefined
              }}
            >
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                width: 'fit-content',
                padding: '6px 10px',
                borderRadius: '999px',
                backgroundColor: plan.primary ? 'rgba(37, 211, 102, 0.1)' : 'rgba(255, 255, 255, 0.72)',
                color: plan.primary ? 'var(--accent-soft)' : 'var(--text-secondary)',
                fontSize: '0.74rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                marginBottom: '16px'
              }}>
                {plan.badge}
              </div>
              <span style={{ fontSize: '0.86rem', fontWeight: 700, color: plan.primary ? 'var(--accent)' : 'var(--text-secondary)', textTransform: 'uppercase' }}>
                {plan.label}
              </span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', margin: '14px 0 12px' }}>
                <span style={{ fontSize: '2.4rem', fontWeight: 800 }}>{plan.price}</span>
                <span style={{ fontSize: '0.92rem', color: 'var(--text-secondary)' }}>{plan.suffix}</span>
              </div>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '22px' }}>
                {plan.description}
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '28px', flex: 1 }}>
                {plan.features.map((feature) => (
                  <div key={feature} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.88rem' }}>
                    <Check size={16} style={{ color: 'var(--success)' }} />
                    <span>{feature}</span>
                  </div>
                ))}
              </div>

              <button
                className={`btn ${plan.primary ? 'btn-primary' : 'btn-secondary'}`}
                style={{ width: '100%', padding: '12px', borderRadius: '10px' }}
                onClick={handlePrimaryAction}
              >
                {plan.cta}
              </button>
            </div>
          ))}
        </div>
      </section>

      <footer style={{
        marginTop: 'auto',
        borderTop: '1px solid var(--border)',
        background: 'linear-gradient(180deg, rgba(244, 251, 246, 0.96) 0%, rgba(236, 248, 239, 0.98) 100%)'
      }}>
        <div style={{
          maxWidth: '1180px',
          margin: '0 auto',
          padding: '28px 24px 34px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '24px',
          alignItems: 'start'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
              <img src="/whatsnyq-mark.svg" alt="Whatsnyq logo" className="brand-logo-image" />
              <div style={{ fontWeight: 700 }}>{appName}</div>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.7, maxWidth: '340px' }}>
              {t('footerLine')}
            </p>
          </div>

          <div>
            <div style={{ fontWeight: 700, marginBottom: '10px' }}>{t('footerExplore')}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <a href="#features" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>{t('navFeatures')}</a>
              <a href="#demo" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>{t('navDemo')}</a>
              <a href="#pricing" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>{t('navPricing')}</a>
            </div>
          </div>

          <div>
            <div style={{ fontWeight: 700, marginBottom: '10px' }}>{t('footerGetStarted')}</div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.7, marginBottom: '14px' }}>
              {t('footerPlanLine')}
            </p>
            <button className="btn btn-primary" onClick={handlePrimaryAction}>
              <span>{currentUser ? t('footerCtaLoggedIn') : t('footerCtaLoggedOut')}</span>
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </footer>
    </div>
  )
}
