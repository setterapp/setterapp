import { useState, useEffect } from 'react'
import { Plus, Trash2, MoreVertical, MessageSquare, Bot, ArrowLeft, Save, Calendar, UserCheck, Headphones, Briefcase } from 'lucide-react'
import Logo from '../components/Logo'
import SectionHeader from '../components/SectionHeader'
import { useAgents, type AgentConfig, type Agent, type AgentType } from '../hooks/useAgents'
import { Switch } from '../components/ui/switch'
import Modal from '../components/common/Modal'
import AgentTestChat from '../components/AgentTestChat'
import WhatsAppIcon from '../components/icons/WhatsAppIcon'
import InstagramIcon from '../components/icons/InstagramIcon'
import { formatDate, formatFullDate } from '../utils/date'
import { Checkbox } from '../components/ui/checkbox'

// Configuraciones predefinidas para cada tipo de agente
const AGENT_PRESETS: Record<AgentType, { name: string; icon: any; description: string; basePrompt: string }> = {
    setter: {
        name: 'Appointment Setter',
        icon: Calendar,
        description: 'Especializado en calificar leads y agendar reuniones con prospectos interesados.',
        basePrompt: `Eres un appointment setter profesional. Tu objetivo principal es:
1. Generar rapport y conexión con el prospecto
2. Calificar si el prospecto es ideal para nuestro servicio
3. Agendar una llamada/reunión con el equipo de ventas

REGLAS DE COMUNICACIÓN:
- Escribe mensajes cortos y naturales, como un humano real
- Usa un tono amigable pero profesional
- No seas robótico ni uses respuestas genéricas
- Haz preguntas abiertas para entender las necesidades
- No presiones, genera curiosidad genuina
- Valida las objeciones antes de responderlas`,
    },
    support: {
        name: 'Customer Support',
        icon: Headphones,
        description: 'Especializado en resolver dudas y problemas de clientes actuales.',
        basePrompt: `Eres un agente de soporte al cliente excepcional. Tu objetivo es:
1. Resolver problemas y dudas de forma rápida y eficiente
2. Asegurar la satisfacción del cliente
3. Escalar casos complejos cuando sea necesario

REGLAS DE COMUNICACIÓN:
- Sé empático y comprensivo con las frustraciones
- Escribe de forma clara y directa
- Ofrece soluciones concretas
- Si no sabes algo, admítelo y ofrece escalar
- Confirma que el problema quedó resuelto
- Agradece la paciencia del cliente`,
    },
    sales: {
        name: 'Sales Assistant',
        icon: Briefcase,
        description: 'Especializado en presentar productos/servicios y cerrar ventas.',
        basePrompt: `Eres un asistente de ventas consultivo. Tu objetivo es:
1. Entender las necesidades del cliente
2. Presentar soluciones relevantes
3. Manejar objeciones con empatía
4. Guiar hacia la decisión de compra

REGLAS DE COMUNICACIÓN:
- Escucha más de lo que hablas
- Haz preguntas para entender antes de vender
- Presenta beneficios, no características
- Usa historias y ejemplos reales
- No presiones, genera urgencia natural
- Ofrece próximos pasos claros`,
    },
    custom: {
        name: 'Personalizado',
        icon: Bot,
        description: 'Configura el agente desde cero con tu propio prompt.',
        basePrompt: '',
    },
}

// Lista completa de zonas horarias por continente
const TIMEZONES = {
    'América del Norte': [
        { value: 'America/New_York', label: 'Nueva York (EST/EDT)' },
        { value: 'America/Chicago', label: 'Chicago (CST/CDT)' },
        { value: 'America/Denver', label: 'Denver (MST/MDT)' },
        { value: 'America/Los_Angeles', label: 'Los Ángeles (PST/PDT)' },
        { value: 'America/Phoenix', label: 'Phoenix (MST)' },
        { value: 'America/Toronto', label: 'Toronto (EST/EDT)' },
        { value: 'America/Vancouver', label: 'Vancouver (PST/PDT)' },
        { value: 'America/Mexico_City', label: 'Ciudad de México (CST)' },
        { value: 'America/Monterrey', label: 'Monterrey (CST)' },
        { value: 'America/Tijuana', label: 'Tijuana (PST/PDT)' },
    ],
    'América del Sur': [
        { value: 'America/Argentina/Buenos_Aires', label: 'Argentina (Buenos Aires)' },
        { value: 'America/Sao_Paulo', label: 'Brasil (São Paulo)' },
        { value: 'America/Santiago', label: 'Chile (Santiago)' },
        { value: 'America/Bogota', label: 'Colombia (Bogotá)' },
        { value: 'America/Lima', label: 'Perú (Lima)' },
        { value: 'America/Caracas', label: 'Venezuela (Caracas)' },
        { value: 'America/Guayaquil', label: 'Ecuador (Guayaquil)' },
        { value: 'America/La_Paz', label: 'Bolivia (La Paz)' },
        { value: 'America/Montevideo', label: 'Uruguay (Montevideo)' },
        { value: 'America/Asuncion', label: 'Paraguay (Asunción)' },
    ],
    'América Central y Caribe': [
        { value: 'America/Guatemala', label: 'Guatemala' },
        { value: 'America/El_Salvador', label: 'El Salvador' },
        { value: 'America/Tegucigalpa', label: 'Honduras (Tegucigalpa)' },
        { value: 'America/Managua', label: 'Nicaragua (Managua)' },
        { value: 'America/Costa_Rica', label: 'Costa Rica' },
        { value: 'America/Panama', label: 'Panamá' },
        { value: 'America/Havana', label: 'Cuba (La Habana)' },
        { value: 'America/Santo_Domingo', label: 'República Dominicana' },
        { value: 'America/Puerto_Rico', label: 'Puerto Rico' },
    ],
    'Europa Occidental': [
        { value: 'Europe/London', label: 'Reino Unido (Londres)' },
        { value: 'Europe/Dublin', label: 'Irlanda (Dublín)' },
        { value: 'Europe/Lisbon', label: 'Portugal (Lisboa)' },
        { value: 'Atlantic/Canary', label: 'España (Islas Canarias)' },
    ],
    'Europa Central': [
        { value: 'Europe/Madrid', label: 'España (Madrid)' },
        { value: 'Europe/Paris', label: 'Francia (París)' },
        { value: 'Europe/Berlin', label: 'Alemania (Berlín)' },
        { value: 'Europe/Rome', label: 'Italia (Roma)' },
        { value: 'Europe/Amsterdam', label: 'Países Bajos (Ámsterdam)' },
        { value: 'Europe/Brussels', label: 'Bélgica (Bruselas)' },
        { value: 'Europe/Vienna', label: 'Austria (Viena)' },
        { value: 'Europe/Zurich', label: 'Suiza (Zúrich)' },
        { value: 'Europe/Warsaw', label: 'Polonia (Varsovia)' },
        { value: 'Europe/Prague', label: 'República Checa (Praga)' },
        { value: 'Europe/Stockholm', label: 'Suecia (Estocolmo)' },
        { value: 'Europe/Oslo', label: 'Noruega (Oslo)' },
        { value: 'Europe/Copenhagen', label: 'Dinamarca (Copenhague)' },
    ],
    'Europa Oriental': [
        { value: 'Europe/Moscow', label: 'Rusia (Moscú)' },
        { value: 'Europe/Kiev', label: 'Ucrania (Kiev)' },
        { value: 'Europe/Bucharest', label: 'Rumania (Bucarest)' },
        { value: 'Europe/Athens', label: 'Grecia (Atenas)' },
        { value: 'Europe/Istanbul', label: 'Turquía (Estambul)' },
        { value: 'Europe/Helsinki', label: 'Finlandia (Helsinki)' },
    ],
    'Asia': [
        { value: 'Asia/Dubai', label: 'Emiratos Árabes (Dubái)' },
        { value: 'Asia/Riyadh', label: 'Arabia Saudita (Riad)' },
        { value: 'Asia/Jerusalem', label: 'Israel (Jerusalén)' },
        { value: 'Asia/Kolkata', label: 'India (Calcuta/Mumbai)' },
        { value: 'Asia/Bangkok', label: 'Tailandia (Bangkok)' },
        { value: 'Asia/Singapore', label: 'Singapur' },
        { value: 'Asia/Hong_Kong', label: 'Hong Kong' },
        { value: 'Asia/Shanghai', label: 'China (Shanghái)' },
        { value: 'Asia/Tokyo', label: 'Japón (Tokio)' },
        { value: 'Asia/Seoul', label: 'Corea del Sur (Seúl)' },
        { value: 'Asia/Manila', label: 'Filipinas (Manila)' },
        { value: 'Asia/Jakarta', label: 'Indonesia (Yakarta)' },
        { value: 'Asia/Kuala_Lumpur', label: 'Malasia (Kuala Lumpur)' },
        { value: 'Asia/Ho_Chi_Minh', label: 'Vietnam (Ho Chi Minh)' },
    ],
    'Oceanía': [
        { value: 'Australia/Sydney', label: 'Australia (Sídney)' },
        { value: 'Australia/Melbourne', label: 'Australia (Melbourne)' },
        { value: 'Australia/Brisbane', label: 'Australia (Brisbane)' },
        { value: 'Australia/Perth', label: 'Australia (Perth)' },
        { value: 'Pacific/Auckland', label: 'Nueva Zelanda (Auckland)' },
        { value: 'Pacific/Fiji', label: 'Fiyi' },
    ],
    'África': [
        { value: 'Africa/Cairo', label: 'Egipto (El Cairo)' },
        { value: 'Africa/Johannesburg', label: 'Sudáfrica (Johannesburgo)' },
        { value: 'Africa/Lagos', label: 'Nigeria (Lagos)' },
        { value: 'Africa/Nairobi', label: 'Kenia (Nairobi)' },
        { value: 'Africa/Casablanca', label: 'Marruecos (Casablanca)' },
    ],
}

function Agents() {
    const { agents, loading, error, createAgent, updateAgent, deleteAgent } = useAgents()
    const [showForm, setShowForm] = useState(false)
    const [editingAgent, setEditingAgent] = useState<string | null>(null)
    const [openMenuId, setOpenMenuId] = useState<string | null>(null)
    const [testingAgent, setTestingAgent] = useState<Agent | null>(null)
    const [saving, setSaving] = useState(false)
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        platform: '' as 'whatsapp' | 'instagram' | '',
        config: {} as AgentConfig,
    })

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setSaving(true)

        try {
            const agentData = {
                name: formData.name,
                description: formData.description,
                platform: (formData.platform as 'whatsapp' | 'instagram' | '') || null,
                config: Object.keys(formData.config).length > 0 ? formData.config : undefined,
            }

            if (editingAgent) {
                await updateAgent(editingAgent, agentData)
                setEditingAgent(null)
            } else {
                await createAgent(agentData)
            }
            setFormData({ name: '', description: '', platform: '', config: {} })
            setShowForm(false)
        } catch (err) {
            console.error('Error saving agent:', err)
            alert('Error al guardar el agente. Por favor, intenta de nuevo.')
        } finally {
            setSaving(false)
        }
    }

    const handleEdit = (agent: any) => {
        setFormData({
            name: agent.name,
            description: agent.description,
            platform: agent.platform || '',
            config: agent.config || {},
        })
        setEditingAgent(agent.id)
        setShowForm(true)
    }

    const handleBack = () => {
        setShowForm(false)
        setEditingAgent(null)
        setFormData({ name: '', description: '', platform: '', config: {} })
    }

    const updateConfig = (key: keyof AgentConfig, value: any) => {
        setFormData((prev) => {
            const newConfig = { ...prev.config, [key]: value }

            if (key === 'enableMeetingScheduling' && value === true) {
                newConfig.meetingDuration = newConfig.meetingDuration ?? 30
                newConfig.meetingBufferMinutes = newConfig.meetingBufferMinutes ?? 0
                newConfig.meetingAvailableHoursStart = newConfig.meetingAvailableHoursStart ?? '09:00'
                newConfig.meetingAvailableHoursEnd = newConfig.meetingAvailableHoursEnd ?? '18:00'
                newConfig.meetingAvailableDays = newConfig.meetingAvailableDays ?? ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
            }

            return {
                ...prev,
                config: newConfig,
            }
        })
    }

    const handleAgentTypeChange = (agentType: AgentType) => {
        const preset = AGENT_PRESETS[agentType]
        setFormData((prev) => ({
            ...prev,
            description: agentType === 'custom' ? prev.description : preset.basePrompt,
            config: {
                ...prev.config,
                agentType,
                enableHumanStyle: agentType !== 'custom' ? true : prev.config.enableHumanStyle,
            },
        }))
    }

    const handleAssignPlatform = async (agentId: string, platform: 'whatsapp' | 'instagram') => {
        try {
            await updateAgent(agentId, { platform })
        } catch (err) {
            console.error('Error updating agent:', err)
        }
    }

    const handleDelete = async (agentId: string) => {
        if (!confirm('¿Estás seguro de que quieres eliminar este agente?')) return
        try {
            await deleteAgent(agentId)
        } catch (err) {
            console.error('Error deleting agent:', err)
        }
    }

    useEffect(() => {
        const handleClickOutside = () => setOpenMenuId(null)
        if (openMenuId) {
            document.addEventListener('click', handleClickOutside)
            return () => document.removeEventListener('click', handleClickOutside)
        }
    }, [openMenuId])

    if (loading && agents.length === 0) {
        return (
            <div className="card" style={{ border: '2px solid #000' }}>
                <div className="empty-state">
                    <div className="spinner"></div>
                    <p>Cargando agentes...</p>
                </div>
            </div>
        )
    }

    if (error) {
        return (
            <div className="card" style={{ border: '2px solid #000' }}>
                <div className="empty-state">
                    <h3>Error</h3>
                    <p>{error}</p>
                </div>
            </div>
        )
    }

    // Vista de formulario de agente (página completa con scroll)
    if (showForm) {
        return (
            <div>
                {/* Header con botón de volver */}
                <SectionHeader
                    title={editingAgent ? 'Editar Agente' : 'Nuevo Agente'}
                    icon={
                        <button
                            onClick={handleBack}
                            style={{
                                background: 'transparent',
                                border: 'none',
                                cursor: 'pointer',
                                padding: 0,
                                display: 'flex',
                                alignItems: 'center',
                                color: 'var(--color-text)',
                            }}
                        >
                            <ArrowLeft size={24} />
                        </button>
                    }
                >
                    <button
                        type="submit"
                        form="agent-form"
                        className="btn btn--primary"
                        disabled={saving}
                        style={{ opacity: saving ? 0.7 : 1 }}
                    >
                        <Save size={18} />
                        {saving ? 'Guardando...' : (editingAgent ? 'Guardar' : 'Crear Agente')}
                    </button>
                </SectionHeader>

                {/* Formulario con scroll - todo vertical */}
                <form id="agent-form" onSubmit={handleSubmit}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
                        {/* Tipo de Agente */}
                        <div className="card" style={{ border: '2px solid #000', padding: 'var(--spacing-lg)' }}>
                            <h3 style={{ marginBottom: 'var(--spacing-lg)', fontSize: 'var(--font-size-lg)', fontWeight: 700 }}>
                                Tipo de Agente
                            </h3>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--spacing-md)' }}>
                                {(Object.keys(AGENT_PRESETS) as AgentType[]).map((type) => {
                                    const preset = AGENT_PRESETS[type]
                                    const IconComponent = preset.icon
                                    const isSelected = formData.config.agentType === type
                                    return (
                                        <button
                                            key={type}
                                            type="button"
                                            onClick={() => handleAgentTypeChange(type)}
                                            style={{
                                                padding: 'var(--spacing-md)',
                                                border: `2px solid ${isSelected ? 'var(--color-primary)' : 'var(--color-border)'}`,
                                                borderRadius: 'var(--border-radius)',
                                                background: isSelected ? 'var(--color-primary-light)' : 'var(--color-bg)',
                                                cursor: 'pointer',
                                                textAlign: 'left',
                                                transition: 'var(--transition)',
                                            }}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-xs)' }}>
                                                <IconComponent size={20} style={{ color: isSelected ? 'var(--color-primary)' : 'var(--color-text-secondary)' }} />
                                                <span style={{ fontWeight: 600, color: isSelected ? 'var(--color-primary)' : 'var(--color-text)' }}>
                                                    {preset.name}
                                                </span>
                                            </div>
                                            <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                                                {preset.description}
                                            </p>
                                        </button>
                                    )
                                })}
                            </div>
                        </div>

                        {/* Información Básica */}
                        <div className="card" style={{ border: '2px solid #000', padding: 'var(--spacing-lg)' }}>
                            <h3 style={{ marginBottom: 'var(--spacing-lg)', fontSize: 'var(--font-size-lg)', fontWeight: 700 }}>
                                Información Básica
                            </h3>
                            <div className="form-group">
                                <label htmlFor="name">Nombre del Agente *</label>
                                <input
                                    id="name"
                                    type="text"
                                    className="input"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    required
                                    placeholder="Ej: Asistente de Ventas"
                                />
                            </div>
                            <div className="form-group">
                                <label htmlFor="description">
                                    Prompt Base / Descripción *
                                    {formData.config.agentType && formData.config.agentType !== 'custom' && (
                                        <span style={{ fontWeight: 400, fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginLeft: 'var(--spacing-sm)' }}>
                                            (Pre-configurado para {AGENT_PRESETS[formData.config.agentType].name})
                                        </span>
                                    )}
                                </label>
                                <textarea
                                    id="description"
                                    className="input textarea"
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    required
                                    placeholder="Describe las capacidades y personalidad del agente..."
                                    rows={6}
                                    style={{ fontFamily: 'monospace', fontSize: 'var(--font-size-sm)' }}
                                />
                                <small style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-xs)' }}>
                                    Este es el prompt base que define la personalidad y comportamiento del agente.
                                </small>
                            </div>
                            <div className="form-group">
                                <label htmlFor="platform">Plataforma</label>
                                <select
                                    id="platform"
                                    className="input select"
                                    value={formData.platform}
                                    onChange={(e) => setFormData({ ...formData, platform: e.target.value as 'whatsapp' | 'instagram' | '' })}
                                >
                                    <option value="">Sin asignar</option>
                                    <option value="instagram">Instagram</option>
                                </select>
                            </div>
                        </div>

                        {/* Identidad del Asistente */}
                        <div className="card" style={{ border: '2px solid #000', padding: 'var(--spacing-lg)' }}>
                            <h3 style={{ marginBottom: 'var(--spacing-lg)', fontSize: 'var(--font-size-lg)', fontWeight: 700 }}>
                                Identidad del Asistente
                            </h3>
                            <div className="form-group">
                                <label htmlFor="assistantName">Nombre del Asistente</label>
                                <input
                                    id="assistantName"
                                    type="text"
                                    className="input"
                                    value={formData.config.assistantName || ''}
                                    onChange={(e) => updateConfig('assistantName', e.target.value)}
                                    placeholder="Ej: Juan, María, etc."
                                />
                                <small style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-xs)' }}>
                                    Nombre que verán tus clientes
                                </small>
                            </div>
                            <div className="form-group">
                                <label htmlFor="companyName">Nombre de la Empresa</label>
                                <input
                                    id="companyName"
                                    type="text"
                                    className="input"
                                    value={formData.config.companyName || ''}
                                    onChange={(e) => updateConfig('companyName', e.target.value)}
                                    placeholder="Ej: Mi Empresa"
                                />
                            </div>
                            <div className="form-group">
                                <label htmlFor="ownerName">Nombre del Propietario</label>
                                <input
                                    id="ownerName"
                                    type="text"
                                    className="input"
                                    value={formData.config.ownerName || ''}
                                    onChange={(e) => updateConfig('ownerName', e.target.value)}
                                    placeholder="Tu nombre"
                                />
                            </div>
                        </div>

                        {/* Información del Negocio */}
                        <div className="card" style={{ border: '2px solid #000', padding: 'var(--spacing-lg)' }}>
                            <h3 style={{ marginBottom: 'var(--spacing-lg)', fontSize: 'var(--font-size-lg)', fontWeight: 700 }}>
                                Información del Negocio
                            </h3>
                            <div className="form-group">
                                <label htmlFor="businessNiche">Nicho de Negocio</label>
                                <input
                                    id="businessNiche"
                                    type="text"
                                    className="input"
                                    value={formData.config.businessNiche || ''}
                                    onChange={(e) => updateConfig('businessNiche', e.target.value)}
                                    placeholder="Ej: Coaching, Fitness, E-commerce"
                                />
                            </div>
                            <div className="form-group">
                                <label htmlFor="clientGoals">Objetivos del Cliente</label>
                                <textarea
                                    id="clientGoals"
                                    className="input textarea"
                                    value={formData.config.clientGoals || ''}
                                    onChange={(e) => updateConfig('clientGoals', e.target.value)}
                                    placeholder="¿Qué objetivos ayuda tu servicio a lograr?"
                                    rows={2}
                                />
                            </div>
                            <div className="form-group">
                                <label htmlFor="offerDetails">Detalles de la Oferta</label>
                                <textarea
                                    id="offerDetails"
                                    className="input textarea"
                                    value={formData.config.offerDetails || ''}
                                    onChange={(e) => updateConfig('offerDetails', e.target.value)}
                                    placeholder="¿Qué paquetes o servicios ofreces?"
                                    rows={2}
                                />
                            </div>
                            <div className="form-group">
                                <label htmlFor="importantLinks">Enlaces Importantes</label>
                                <textarea
                                    id="importantLinks"
                                    className="input textarea"
                                    value={(formData.config.importantLinks || []).join('\n')}
                                    onChange={(e) => updateConfig('importantLinks', e.target.value.split('\n').filter(l => l.trim()))}
                                    placeholder="Un enlace por línea"
                                    rows={2}
                                />
                            </div>
                        </div>

                        {/* Comportamiento y Horarios */}
                        <div className="card" style={{ border: '2px solid #000', padding: 'var(--spacing-lg)' }}>
                            <h3 style={{ marginBottom: 'var(--spacing-lg)', fontSize: 'var(--font-size-lg)', fontWeight: 700 }}>
                                Comportamiento
                            </h3>
                            <div className="form-group">
                                <label htmlFor="openingQuestion">Pregunta de Apertura</label>
                                <textarea
                                    id="openingQuestion"
                                    className="input textarea"
                                    value={formData.config.openingQuestion || ''}
                                    onChange={(e) => updateConfig('openingQuestion', e.target.value)}
                                    placeholder="Primera pregunta que hará el asistente"
                                    rows={2}
                                />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--spacing-md)' }}>
                                <div className="form-group">
                                    <label htmlFor="activeHoursStart">Hora Inicio</label>
                                    <input
                                        id="activeHoursStart"
                                        type="time"
                                        className="input"
                                        value={formData.config.activeHoursStart || '09:00'}
                                        onChange={(e) => updateConfig('activeHoursStart', e.target.value)}
                                    />
                                </div>
                                <div className="form-group">
                                    <label htmlFor="activeHoursEnd">Hora Fin</label>
                                    <input
                                        id="activeHoursEnd"
                                        type="time"
                                        className="input"
                                        value={formData.config.activeHoursEnd || '18:00'}
                                        onChange={(e) => updateConfig('activeHoursEnd', e.target.value)}
                                    />
                                </div>
                                <div className="form-group">
                                    <label htmlFor="responseInterval">Intervalo (min)</label>
                                    <input
                                        id="responseInterval"
                                        type="number"
                                        className="input"
                                        min="1"
                                        value={formData.config.responseInterval || 3}
                                        onChange={(e) => updateConfig('responseInterval', parseInt(e.target.value) || 3)}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Calificación de Leads */}
                        <div className="card" style={{ border: '2px solid #000', padding: 'var(--spacing-lg)' }}>
                            <h3 style={{ marginBottom: 'var(--spacing-lg)', fontSize: 'var(--font-size-lg)', fontWeight: 700 }}>
                                <UserCheck size={20} style={{ display: 'inline', marginRight: 'var(--spacing-sm)', verticalAlign: 'middle' }} />
                                Calificación de Leads
                            </h3>
                            <p style={{ marginBottom: 'var(--spacing-md)', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                                Configura criterios para que el agente determine si un lead es ideal para tu servicio antes de agendar una llamada.
                            </p>
                            <div className="form-group" style={{ background: 'var(--color-bg-secondary)', padding: 'var(--spacing-md)', borderRadius: 'var(--border-radius)', marginBottom: 'var(--spacing-md)' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', cursor: 'pointer' }}>
                                    <Checkbox
                                        checked={formData.config.enableQualification || false}
                                        onCheckedChange={(checked) => updateConfig('enableQualification', checked)}
                                    />
                                    <span style={{ fontWeight: 600 }}>Habilitar calificación automática</span>
                                </label>
                            </div>
                            {formData.config.enableQualification && (
                                <>
                                    <div className="form-group">
                                        <label htmlFor="qualifyingQuestion">Pregunta de Calificación</label>
                                        <textarea
                                            id="qualifyingQuestion"
                                            className="input textarea"
                                            value={formData.config.qualifyingQuestion || ''}
                                            onChange={(e) => updateConfig('qualifyingQuestion', e.target.value)}
                                            placeholder="Ej: ¿Cuánto estás dispuesto a invertir en mejorar esto?"
                                            rows={2}
                                        />
                                        <small style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-xs)' }}>
                                            La pregunta clave que el agente usará para determinar si el lead califica.
                                        </small>
                                    </div>
                                    <div className="form-group">
                                        <label htmlFor="qualificationCriteria">Criterios de Calificación</label>
                                        <textarea
                                            id="qualificationCriteria"
                                            className="input textarea"
                                            value={formData.config.qualificationCriteria || ''}
                                            onChange={(e) => updateConfig('qualificationCriteria', e.target.value)}
                                            placeholder={`Ej:
- Presupuesto mínimo: $500 USD
- Tiene un negocio activo
- Dispuesto a empezar en los próximos 30 días
- No busca resultados "mágicos" o inmediatos`}
                                            rows={4}
                                        />
                                        <small style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-xs)' }}>
                                            Lista los criterios que el lead debe cumplir para calificar. Sé específico.
                                        </small>
                                    </div>
                                    <div className="form-group">
                                        <label htmlFor="disqualifyMessage">Mensaje para Leads No Calificados</label>
                                        <textarea
                                            id="disqualifyMessage"
                                            className="input textarea"
                                            value={formData.config.disqualifyMessage || ''}
                                            onChange={(e) => updateConfig('disqualifyMessage', e.target.value)}
                                            placeholder="Ej: Entiendo perfectamente, parece que en este momento no sería el mejor fit para lo que ofrecemos. Te deseo mucho éxito y si en el futuro cambia tu situación, aquí estaremos!"
                                            rows={3}
                                        />
                                        <small style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-xs)' }}>
                                            Mensaje amable para leads que no cumplen los criterios. Mantén la puerta abierta.
                                        </small>
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Personalización */}
                        <div className="card" style={{ border: '2px solid #000', padding: 'var(--spacing-lg)' }}>
                            <h3 style={{ marginBottom: 'var(--spacing-lg)', fontSize: 'var(--font-size-lg)', fontWeight: 700 }}>
                                Personalización
                            </h3>

                            {/* Estilo Humano */}
                            <div className="form-group" style={{ background: 'var(--color-bg-secondary)', padding: 'var(--spacing-md)', borderRadius: 'var(--border-radius)', marginBottom: 'var(--spacing-lg)' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', cursor: 'pointer', marginBottom: 'var(--spacing-xs)' }}>
                                    <Checkbox
                                        checked={formData.config.enableHumanStyle !== false}
                                        onCheckedChange={(checked) => updateConfig('enableHumanStyle', checked)}
                                    />
                                    <span style={{ fontWeight: 600 }}>Estilo de Mensajes Humano</span>
                                </label>
                                <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                                    Cuando está activo, el agente envía múltiples mensajes cortos como una persona real,
                                    en lugar de un solo mensaje largo. Por ejemplo: "Hola!" seguido de "¿Cómo estás?"
                                    en mensajes separados. Esto hace la conversación más natural.
                                </p>
                            </div>

                            <div className="form-group">
                                <label htmlFor="toneGuidelines">Guías de Tono</label>
                                <textarea
                                    id="toneGuidelines"
                                    className="input textarea"
                                    value={formData.config.toneGuidelines || ''}
                                    onChange={(e) => updateConfig('toneGuidelines', e.target.value)}
                                    placeholder="Ej: Usa un tono casual y amigable. Tutea al cliente. Usa expresiones locales de España."
                                    rows={3}
                                />
                                <small style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-xs)' }}>
                                    Describe cómo debe comunicarse el agente: formal/informal, expresiones, idioma, etc.
                                </small>
                            </div>

                            <div className="form-group">
                                <label htmlFor="additionalContext">Contexto Adicional</label>
                                <textarea
                                    id="additionalContext"
                                    className="input textarea"
                                    value={formData.config.additionalContext || ''}
                                    onChange={(e) => updateConfig('additionalContext', e.target.value)}
                                    placeholder="Información adicional que el agente debe conocer..."
                                    rows={3}
                                />
                            </div>
                        </div>

                        {/* Ejemplos de Conversación */}
                        <div className="card" style={{ border: '2px solid #000', padding: 'var(--spacing-lg)' }}>
                            <h3 style={{ marginBottom: 'var(--spacing-lg)', fontSize: 'var(--font-size-lg)', fontWeight: 700 }}>
                                Ejemplos de Conversación
                            </h3>
                            <p style={{ marginBottom: 'var(--spacing-md)', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                                Proporciona ejemplos de cómo debería responder el agente. Esto ayuda a la IA a entender mejor el estilo y tono que quieres.
                            </p>
                            <div className="form-group">
                                <label htmlFor="conversationExamples">Ejemplos</label>
                                <textarea
                                    id="conversationExamples"
                                    className="input textarea"
                                    value={formData.config.conversationExamples || ''}
                                    onChange={(e) => updateConfig('conversationExamples', e.target.value)}
                                    placeholder={`Ejemplo de formato:

Lead: Hola, me interesa saber más sobre el servicio
Agente: Hey! 👋
Agente: Qué bueno que escribes
Agente: ¿Qué te llamó la atención de lo que viste?

Lead: Vi tu anuncio de coaching
Agente: Genial!
Agente: Cuéntame un poco más, ¿qué es lo que estás buscando mejorar?

Lead: Quiero mejorar mis ventas
Agente: Perfecto, eso es justo lo que ayudamos a lograr
Agente: ¿Tienes un negocio propio o trabajas en ventas?`}
                                    rows={12}
                                    style={{ fontFamily: 'monospace', fontSize: 'var(--font-size-sm)' }}
                                />
                                <small style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-xs)' }}>
                                    Usa "Lead:" para los mensajes del cliente y "Agente:" para las respuestas del agente.
                                    Puedes poner múltiples líneas de "Agente:" seguidas para mostrar mensajes separados.
                                </small>
                            </div>
                        </div>

                        {/* Generación de Reuniones */}
                        <div className="card" style={{ border: '2px solid #000', padding: 'var(--spacing-lg)' }}>
                            <h3 style={{ marginBottom: 'var(--spacing-lg)', fontSize: 'var(--font-size-lg)', fontWeight: 700 }}>
                                Generación de Reuniones
                            </h3>
                            <div className="form-group">
                                <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', cursor: 'pointer' }}>
                                    <Checkbox
                                        checked={formData.config.enableMeetingScheduling || false}
                                        onCheckedChange={(checked) => updateConfig('enableMeetingScheduling', checked)}
                                    />
                                    <span>Habilitar generación automática de reuniones con Google Calendar</span>
                                </label>
                            </div>

                            {formData.config.enableMeetingScheduling && (
                                <>
                                    <div className="form-group">
                                        <label htmlFor="meetingEmail">Email para Reuniones *</label>
                                        <input
                                            id="meetingEmail"
                                            type="email"
                                            className="input"
                                            value={formData.config.meetingEmail || ''}
                                            onChange={(e) => updateConfig('meetingEmail', e.target.value)}
                                            placeholder="tu-email@ejemplo.com"
                                            required={formData.config.enableMeetingScheduling}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label htmlFor="meetingTitle">Título de la Reunión</label>
                                        <input
                                            id="meetingTitle"
                                            type="text"
                                            className="input"
                                            value={formData.config.meetingTitle || ''}
                                            onChange={(e) => updateConfig('meetingTitle', e.target.value)}
                                            placeholder="Ej: Llamada con {nombre}"
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label htmlFor="meetingDescription">Descripción</label>
                                        <textarea
                                            id="meetingDescription"
                                            className="input textarea"
                                            value={formData.config.meetingDescription || ''}
                                            onChange={(e) => updateConfig('meetingDescription', e.target.value)}
                                            placeholder="Propósito de la reunión"
                                            rows={2}
                                        />
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-md)' }}>
                                        <div className="form-group">
                                            <label htmlFor="meetingDuration">Duración (min)</label>
                                            <input
                                                id="meetingDuration"
                                                type="number"
                                                className="input"
                                                min="15"
                                                step="15"
                                                value={formData.config.meetingDuration || 30}
                                                onChange={(e) => updateConfig('meetingDuration', parseInt(e.target.value) || 30)}
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label htmlFor="meetingBufferMinutes">Buffer (min)</label>
                                            <input
                                                id="meetingBufferMinutes"
                                                type="number"
                                                className="input"
                                                min="0"
                                                step="5"
                                                value={formData.config.meetingBufferMinutes || 0}
                                                onChange={(e) => updateConfig('meetingBufferMinutes', parseInt(e.target.value) || 0)}
                                            />
                                        </div>
                                    </div>
                                    <div className="form-group">
                                        <label htmlFor="meetingTimezone">Zona Horaria</label>
                                        <select
                                            id="meetingTimezone"
                                            className="input select"
                                            value={formData.config.meetingTimezone || 'America/Argentina/Buenos_Aires'}
                                            onChange={(e) => updateConfig('meetingTimezone', e.target.value)}
                                        >
                                            {Object.entries(TIMEZONES).map(([region, zones]) => (
                                                <optgroup key={region} label={region}>
                                                    {zones.map((tz) => (
                                                        <option key={tz.value} value={tz.value}>
                                                            {tz.label}
                                                        </option>
                                                    ))}
                                                </optgroup>
                                            ))}
                                        </select>
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-md)' }}>
                                        <div className="form-group">
                                            <label htmlFor="meetingAvailableHoursStart">Horario Inicio</label>
                                            <input
                                                id="meetingAvailableHoursStart"
                                                type="time"
                                                className="input"
                                                value={formData.config.meetingAvailableHoursStart || '09:00'}
                                                onChange={(e) => updateConfig('meetingAvailableHoursStart', e.target.value)}
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label htmlFor="meetingAvailableHoursEnd">Horario Fin</label>
                                            <input
                                                id="meetingAvailableHoursEnd"
                                                type="time"
                                                className="input"
                                                value={formData.config.meetingAvailableHoursEnd || '18:00'}
                                                onChange={(e) => updateConfig('meetingAvailableHoursEnd', e.target.value)}
                                            />
                                        </div>
                                    </div>
                                    <div className="form-group">
                                        <label>Días Disponibles</label>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--spacing-md)' }}>
                                            {['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'].map((day, index) => {
                                                const dayValue = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'][index]
                                                const availableDays = formData.config.meetingAvailableDays || ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
                                                return (
                                                    <label key={dayValue} style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)', cursor: 'pointer' }}>
                                                        <Checkbox
                                                            checked={availableDays.includes(dayValue)}
                                                            onCheckedChange={(checked) => {
                                                                const newDays = checked
                                                                    ? [...availableDays, dayValue]
                                                                    : availableDays.filter(d => d !== dayValue)
                                                                updateConfig('meetingAvailableDays', newDays)
                                                            }}
                                                        />
                                                        <span style={{ fontSize: 'var(--font-size-sm)' }}>{day}</span>
                                                    </label>
                                                )
                                            })}
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </form>
            </div>
        )
    }

    // Vista de lista de agentes
    return (
        <div>
            <SectionHeader title="Agentes" icon={<Bot size={24} />}>
                <button className="btn btn--primary" onClick={() => setShowForm(true)}>
                    <Plus size={18} />
                    Crear Agente
                </button>
            </SectionHeader>

            {agents.length === 0 ? (
                <div className="card" style={{ border: '2px solid #000' }}>
                    <div className="empty-state">
                        <div style={{ margin: '0 auto var(--spacing-md)', opacity: 0.5 }}>
                            <Logo size={48} variant="stroke" />
                        </div>
                        <h3>No hay agentes creados</h3>
                        <p>Crea tu primer agente de IA para comenzar</p>
                    </div>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
                    {agents.map((agent) => {
                        const isActive = !!agent.platform

                        return (
                            <div
                                key={agent.id}
                                onClick={(e) => {
                                    if ((e.target as HTMLElement).closest('button, label')) return
                                    handleEdit(agent)
                                }}
                                style={{
                                    background: 'var(--color-bg)',
                                    border: '2px solid #000',
                                    borderRadius: 'var(--border-radius-lg)',
                                    padding: 'var(--spacing-lg)',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    transition: 'var(--transition)',
                                    cursor: 'pointer',
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.borderColor = 'var(--color-primary)'
                                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(35, 131, 226, 0.1)'
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.borderColor = '#000'
                                    e.currentTarget.style.boxShadow = 'none'
                                }}
                            >
                                {/* Left: Title and metadata */}
                                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)' }}>
                                    <div
                                        style={{
                                            width: '48px',
                                            height: '48px',
                                            borderRadius: 'var(--border-radius)',
                                            background: 'var(--color-bg-secondary)',
                                            border: '2px solid #000',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            flexShrink: 0,
                                            color: 'var(--color-primary)',
                                        }}
                                    >
                                        <Logo size={24} variant="stroke" />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <h3 style={{ margin: 0, marginBottom: 'var(--spacing-xs)', fontSize: 'var(--font-size-lg)', fontWeight: 600, color: 'var(--color-text)' }}>
                                            {agent.name}
                                        </h3>
                                        <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                                            {agent.updated_at && (
                                                <>Última actualización {formatDate(agent.updated_at)}</>
                                            )}
                                            {agent.created_at && agent.updated_at && ' | '}
                                            {agent.created_at && (
                                                <>Creado {formatFullDate(agent.created_at)}</>
                                            )}
                                        </p>
                                    </div>
                                </div>

                                {/* Right: Controls */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)' }}>
                                    {/* Platform Badge */}
                                    {agent.platform ? (
                                        <span
                                            style={{
                                                backgroundColor: agent.platform === 'whatsapp'
                                                    ? '#a6e3a1'
                                                    : '#f38ba8',
                                                color: '#000',
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '6px',
                                                padding: '4px 8px',
                                                borderRadius: 'var(--border-radius-sm)',
                                                fontSize: 'var(--font-size-sm)',
                                                fontWeight: 600,
                                                border: '2px solid #000',
                                            }}
                                        >
                                            {agent.platform === 'whatsapp' ? (
                                                <>
                                                    <WhatsAppIcon size={14} color="#000" />
                                                    WhatsApp
                                                </>
                                            ) : (
                                                <>
                                                    <InstagramIcon size={14} color="#000" />
                                                    Instagram
                                                </>
                                            )}
                                        </span>
                                    ) : (
                                        <span style={{ background: 'var(--color-bg-tertiary)', color: 'var(--color-text-secondary)', display: 'inline-flex', alignItems: 'center', gap: '6px', border: '2px solid var(--color-border)', padding: '4px 8px', borderRadius: 'var(--border-radius-sm)', fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>
                                            Sin asignar
                                        </span>
                                    )}

                                    {/* Active Label */}
                                    {isActive && (
                                        <span
                                            style={{
                                                fontSize: 'var(--font-size-sm)',
                                                fontWeight: 600,
                                                color: 'var(--color-success)',
                                                minWidth: '60px',
                                                textAlign: 'right',
                                            }}
                                        >
                                            Activo
                                        </span>
                                    )}

                                    {/* Toggle Switch */}
                                    <Switch
                                        checked={isActive}
                                        onCheckedChange={(checked) => {
                                            if (checked && !agent.platform) {
                                                handleAssignPlatform(agent.id, 'instagram')
                                            } else if (!checked && agent.platform) {
                                                updateAgent(agent.id, { platform: null })
                                            }
                                        }}
                                    />

                                    {/* Menu Icon */}
                                    <div style={{ position: 'relative' }}>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                setOpenMenuId(openMenuId === agent.id ? null : agent.id)
                                            }}
                                            style={{
                                                background: 'transparent',
                                                border: 'none',
                                                cursor: 'pointer',
                                                padding: 'var(--spacing-xs)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                color: 'var(--color-text)',
                                                opacity: 0.7,
                                                borderRadius: 'var(--border-radius-sm)',
                                            }}
                                        >
                                            <MoreVertical size={20} />
                                        </button>
                                        {openMenuId === agent.id && (
                                            <div
                                                style={{
                                                    position: 'absolute',
                                                    right: 0,
                                                    top: '100%',
                                                    marginTop: 'var(--spacing-xs)',
                                                    background: 'var(--color-bg)',
                                                    border: '1px solid var(--color-border)',
                                                    borderRadius: 'var(--border-radius)',
                                                    boxShadow: 'var(--shadow-md)',
                                                    padding: 'var(--spacing-xs)',
                                                    zIndex: 100,
                                                    minWidth: '150px',
                                                }}
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                {!agent.platform && (
                                                    <button
                                                        onClick={() => {
                                                            handleAssignPlatform(agent.id, 'instagram')
                                                            setOpenMenuId(null)
                                                        }}
                                                        style={{
                                                            width: '100%',
                                                            textAlign: 'left',
                                                            padding: 'var(--spacing-sm)',
                                                            background: 'transparent',
                                                            border: 'none',
                                                            cursor: 'pointer',
                                                            fontSize: 'var(--font-size-sm)',
                                                            color: 'var(--color-text)',
                                                            borderRadius: 'var(--border-radius-sm)',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: 'var(--spacing-sm)',
                                                        }}
                                                        onMouseEnter={(e) => {
                                                            e.currentTarget.style.background = 'var(--color-bg-secondary)'
                                                        }}
                                                        onMouseLeave={(e) => {
                                                            e.currentTarget.style.background = 'transparent'
                                                        }}
                                                    >
                                                        <InstagramIcon size={16} color="#f38ba8" />
                                                        Asignar Instagram
                                                    </button>
                                                )}
                                                <div style={{ height: '1px', background: 'var(--color-border)', margin: 'var(--spacing-xs) 0' }} />
                                                <button
                                                    onClick={() => {
                                                        setTestingAgent(agent)
                                                        setOpenMenuId(null)
                                                    }}
                                                    style={{
                                                        width: '100%',
                                                        textAlign: 'left',
                                                        padding: 'var(--spacing-sm)',
                                                        background: 'transparent',
                                                        border: 'none',
                                                        cursor: 'pointer',
                                                        fontSize: 'var(--font-size-sm)',
                                                        color: 'var(--color-text)',
                                                        borderRadius: 'var(--border-radius-sm)',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: 'var(--spacing-sm)',
                                                    }}
                                                    onMouseEnter={(e) => {
                                                        e.currentTarget.style.background = 'var(--color-bg-secondary)'
                                                    }}
                                                    onMouseLeave={(e) => {
                                                        e.currentTarget.style.background = 'transparent'
                                                    }}
                                                >
                                                    <MessageSquare size={16} />
                                                    Probar Agente
                                                </button>
                                                <div style={{ height: '1px', background: 'var(--color-border)', margin: 'var(--spacing-xs) 0' }} />
                                                <button
                                                    onClick={() => {
                                                        handleDelete(agent.id)
                                                        setOpenMenuId(null)
                                                    }}
                                                    style={{
                                                        width: '100%',
                                                        textAlign: 'left',
                                                        padding: 'var(--spacing-sm)',
                                                        background: 'transparent',
                                                        border: 'none',
                                                        cursor: 'pointer',
                                                        fontSize: 'var(--font-size-sm)',
                                                        color: 'var(--color-danger)',
                                                        borderRadius: 'var(--border-radius-sm)',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: 'var(--spacing-sm)',
                                                    }}
                                                    onMouseEnter={(e) => {
                                                        e.currentTarget.style.background = 'var(--color-bg-secondary)'
                                                    }}
                                                    onMouseLeave={(e) => {
                                                        e.currentTarget.style.background = 'transparent'
                                                    }}
                                                >
                                                    <Trash2 size={16} />
                                                    Eliminar
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}

            {/* Modal de prueba de agente */}
            <Modal
                isOpen={!!testingAgent}
                onClose={() => setTestingAgent(null)}
            >
                {testingAgent && (
                    <AgentTestChat
                        agent={testingAgent}
                        onClose={() => setTestingAgent(null)}
                    />
                )}
            </Modal>
        </div>
    )
}

export default Agents
