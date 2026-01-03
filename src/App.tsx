import { BrowserRouter, Routes, Route, Link, useLocation, Outlet } from 'react-router-dom'
import { Plug, BarChart3, MessageSquare, MessageCircle, Settings, Menu, X, Users, Calendar as CalendarIcon } from 'lucide-react'
import { useState, useEffect } from 'react'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Register from './pages/Register'
import PrivacyPolicy from './pages/PrivacyPolicy'
import TermsOfService from './pages/TermsOfService'
import DeletionStatus from './pages/DeletionStatus'
import Agents from './pages/Agents'
import Integrations from './pages/Integrations'
import Analytics from './pages/Analytics'
import Conversations from './pages/Conversations'
import Comments from './pages/Comments'
import Contacts from './pages/Contacts'
import Calendar from './pages/Calendar'
import Meetings from './pages/Meetings'
import SettingsPage from './pages/Settings'
import AuthCallback from './pages/AuthCallback'
import InstagramCallback from './pages/InstagramCallback'
import GoogleCalendarCallback from './pages/GoogleCalendarCallback'
import ProtectedRoute from './components/ProtectedRoute'
import PublicRoute from './components/PublicRoute'
import Logo from './components/Logo'
import Pricing from './pages/Pricing'
import { useSupabaseWakeUp } from './hooks/useSupabaseWakeUp'
import { useSubscription } from './hooks/useSubscription'
import './App.css'

function Layout() {
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [pressedButton, setPressedButton] = useState<string | null>(null)

  // Hook global para "despertar" Supabase cuando el usuario vuelve a la pestaña
  useSupabaseWakeUp()

  // Check subscription status
  const { hasAccess, loading: subLoading } = useSubscription()

  const navItems = [
    { path: '/analytics', label: 'Analytics', icon: BarChart3 },
    { path: '/conversations', label: 'Conversations', icon: MessageSquare },
    { path: '/comments', label: 'Comments', icon: MessageCircle },
    { path: '/contacts', label: 'Contacts', icon: Users },
    { path: '/agents', label: 'Setters', icon: Logo, isLogo: true },
    { path: '/meetings', label: 'Meetings', icon: CalendarIcon },
    { path: '/integrations', label: 'Integrations', icon: Plug },
    { path: '/settings', label: 'Settings', icon: Settings },
  ]

  // Cerrar sidebar cuando cambia la ruta en móvil
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSidebarOpen(false)
  }, [location.pathname])

  // Resetear botón presionado cuando cambia la ruta
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPressedButton(null)
  }, [location.pathname])

  // Prevenir scroll del body cuando el sidebar está abierto en móvil
  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [sidebarOpen])

  const handleLinkClick = (path: string) => {
    setPressedButton(path)
    setSidebarOpen(false)
  }

  // Show loading while checking subscription
  if (subLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <div className="spinner" />
      </div>
    )
  }

  // Show pricing page if no access
  if (!hasAccess) {
    return <Pricing />
  }

  return (
    <div className="app-container">
      {/* Mobile menu button */}
      <button
        className="mobile-menu-button"
        onClick={() => setSidebarOpen(!sidebarOpen)}
        aria-label="Toggle menu"
      >
        {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="sidebar-overlay"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <nav className={`sidebar ${sidebarOpen ? 'sidebar--open' : ''}`}>
        <div className="sidebar-header">
          <Logo size={32} />
          <button
            className="sidebar-close-button"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
        </div>
        <ul className="nav-list">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = location.pathname === item.path || location.pathname.startsWith(item.path + '/')
            const isPressed = pressedButton === item.path
            const isLogo = 'isLogo' in item && item.isLogo
            return (
              <li key={item.path}>
                <Link
                  to={item.path}
                  className={`${isActive ? 'active' : ''} ${isPressed ? 'pressed' : ''}`}
                  onClick={() => handleLinkClick(item.path)}
                >
                  {isLogo ? <Icon size={18} variant="stroke" /> : <Icon size={18} />}
                  {item.label}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  )
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<PublicRoute><Landing /></PublicRoute>} />
        <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
        <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route path="/terms" element={<TermsOfService />} />
        <Route path="/deletion-status" element={<DeletionStatus />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/auth/instagram/callback" element={<InstagramCallback />} />
        <Route path="/auth/google-calendar/callback" element={<GoogleCalendarCallback />} />
        <Route
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/conversations" element={<Conversations />} />
          <Route path="/comments" element={<Comments />} />
          <Route path="/contacts" element={<Contacts />} />
          <Route path="/agents" element={<Agents />} />
          <Route path="/meetings" element={<Meetings />} />
          <Route path="/calendar" element={<Calendar />} />
          <Route path="/integrations" element={<Integrations />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
