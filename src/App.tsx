import { BrowserRouter, Routes, Route, Link, useLocation, Outlet } from 'react-router-dom'
import { Brain, Plug, BarChart3, MessageSquare, Settings, Menu, X } from 'lucide-react'
import { useState, useEffect } from 'react'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Register from './pages/Register'
import PrivacyPolicy from './pages/PrivacyPolicy'
import Agents from './pages/Agents'
import Integrations from './pages/Integrations'
import Analytics from './pages/Analytics'
import Conversations from './pages/Conversations'
import SettingsPage from './pages/Settings'
import AuthCallback from './pages/AuthCallback'
import ProtectedRoute from './components/ProtectedRoute'
import PublicRoute from './components/PublicRoute'
import Logo from './components/Logo'
import './App.css'

function Layout() {
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const navItems = [
    { path: '/analytics', label: 'Analíticas', icon: BarChart3 },
    { path: '/conversations', label: 'Conversaciones', icon: MessageSquare },
    { path: '/agents', label: 'Agentes', icon: Brain },
    { path: '/integrations', label: 'Integraciones', icon: Plug },
    { path: '/settings', label: 'Ajustes', icon: Settings },
  ]

  // Cerrar sidebar cuando cambia la ruta en móvil
  useEffect(() => {
    setSidebarOpen(false)
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
          <Logo size={24} />
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
            return (
              <li key={item.path}>
                <Link
                  to={item.path}
                  className={isActive ? 'active' : ''}
                  onClick={() => setSidebarOpen(false)}
                >
                  <Icon size={18} />
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
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/conversations" element={<Conversations />} />
          <Route path="/agents" element={<Agents />} />
          <Route path="/integrations" element={<Integrations />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
