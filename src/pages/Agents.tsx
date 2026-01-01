import { useState, useEffect } from 'react'
import { Plus, Trash2, MoreVertical, MessageSquare, Bot, ArrowLeft, Save, Calendar, UserCheck, Headphones, Briefcase, FileText, X } from 'lucide-react'
import Logo from '../components/Logo'
import SectionHeader from '../components/SectionHeader'
import { useAgents, type AgentConfig, type Agent, type AgentType } from '../hooks/useAgents'
import { useKnowledgeBases } from '../hooks/useKnowledgeBases'
import { useIntegrations } from '../hooks/useIntegrations'
import { Switch } from '../components/ui/switch'
import Modal from '../components/common/Modal'
import AgentTestChat from '../components/AgentTestChat'
import GoogleCalendarMiniCard from '../components/GoogleCalendarMiniCard'
import WhatsAppIcon from '../components/icons/WhatsAppIcon'
import InstagramIcon from '../components/icons/InstagramIcon'
import { formatDate, formatFullDate } from '../utils/date'
import { Checkbox } from '../components/ui/checkbox'

// Predefined configurations for each agent type
const AGENT_PRESETS: Record<AgentType, { name: string; icon: any; description: string; basePrompt: string }> = {
    setter: {
        name: 'Appointment Setter',
        icon: Calendar,
        description: 'Specialized in qualifying leads and scheduling meetings with interested prospects.',
        basePrompt: `You are a professional appointment setter. Your main objective is:
1. Build rapport and connection with the prospect
2. Qualify if the prospect is ideal for our service
3. Schedule a call/meeting with the sales team

COMMUNICATION RULES:
- Write short, natural messages like a real human
- Use a friendly but professional tone
- Don't be robotic or use generic responses
- Ask open-ended questions to understand needs
- Don't pressure, create genuine curiosity
- Validate objections before responding to them`,
    },
    support: {
        name: 'Customer Support',
        icon: Headphones,
        description: 'Specialized in solving questions and problems from current customers.',
        basePrompt: `You are an exceptional customer support agent. Your objective is:
1. Solve problems and questions quickly and efficiently
2. Ensure customer satisfaction
3. Escalate complex cases when necessary

COMMUNICATION RULES:
- Be empathetic and understanding with frustrations
- Write clearly and directly
- Offer concrete solutions
- If you don't know something, admit it and offer to escalate
- Confirm that the problem was resolved
- Thank the customer for their patience`,
    },
    sales: {
        name: 'Sales Assistant',
        icon: Briefcase,
        description: 'Specialized in presenting products/services and closing sales.',
        basePrompt: `You are a consultative sales assistant. Your objective is:
1. Understand the customer's needs
2. Present relevant solutions
3. Handle objections with empathy
4. Guide towards purchase decision

COMMUNICATION RULES:
- Listen more than you talk
- Ask questions to understand before selling
- Present benefits, not features
- Use real stories and examples
- Don't pressure, create natural urgency
- Offer clear next steps`,
    },
    custom: {
        name: 'Custom',
        icon: Bot,
        description: 'Configure the agent from scratch with your own prompt.',
        basePrompt: '',
    },
}

// Complete list of timezones by continent
const TIMEZONES = {
    'North America': [
        { value: 'America/New_York', label: 'New York (EST/EDT)' },
        { value: 'America/Chicago', label: 'Chicago (CST/CDT)' },
        { value: 'America/Denver', label: 'Denver (MST/MDT)' },
        { value: 'America/Los_Angeles', label: 'Los Angeles (PST/PDT)' },
        { value: 'America/Phoenix', label: 'Phoenix (MST)' },
        { value: 'America/Toronto', label: 'Toronto (EST/EDT)' },
        { value: 'America/Vancouver', label: 'Vancouver (PST/PDT)' },
        { value: 'America/Mexico_City', label: 'Mexico City (CST)' },
        { value: 'America/Monterrey', label: 'Monterrey (CST)' },
        { value: 'America/Tijuana', label: 'Tijuana (PST/PDT)' },
    ],
    'South America': [
        { value: 'America/Argentina/Buenos_Aires', label: 'Argentina (Buenos Aires)' },
        { value: 'America/Sao_Paulo', label: 'Brazil (São Paulo)' },
        { value: 'America/Santiago', label: 'Chile (Santiago)' },
        { value: 'America/Bogota', label: 'Colombia (Bogotá)' },
        { value: 'America/Lima', label: 'Peru (Lima)' },
        { value: 'America/Caracas', label: 'Venezuela (Caracas)' },
        { value: 'America/Guayaquil', label: 'Ecuador (Guayaquil)' },
        { value: 'America/La_Paz', label: 'Bolivia (La Paz)' },
        { value: 'America/Montevideo', label: 'Uruguay (Montevideo)' },
        { value: 'America/Asuncion', label: 'Paraguay (Asunción)' },
    ],
    'Central America & Caribbean': [
        { value: 'America/Guatemala', label: 'Guatemala' },
        { value: 'America/El_Salvador', label: 'El Salvador' },
        { value: 'America/Tegucigalpa', label: 'Honduras (Tegucigalpa)' },
        { value: 'America/Managua', label: 'Nicaragua (Managua)' },
        { value: 'America/Costa_Rica', label: 'Costa Rica' },
        { value: 'America/Panama', label: 'Panama' },
        { value: 'America/Havana', label: 'Cuba (Havana)' },
        { value: 'America/Santo_Domingo', label: 'Dominican Republic' },
        { value: 'America/Puerto_Rico', label: 'Puerto Rico' },
    ],
    'Western Europe': [
        { value: 'Europe/London', label: 'United Kingdom (London)' },
        { value: 'Europe/Dublin', label: 'Ireland (Dublin)' },
        { value: 'Europe/Lisbon', label: 'Portugal (Lisbon)' },
        { value: 'Atlantic/Canary', label: 'Spain (Canary Islands)' },
    ],
    'Central Europe': [
        { value: 'Europe/Madrid', label: 'Spain (Madrid)' },
        { value: 'Europe/Paris', label: 'France (Paris)' },
        { value: 'Europe/Berlin', label: 'Germany (Berlin)' },
        { value: 'Europe/Rome', label: 'Italy (Rome)' },
        { value: 'Europe/Amsterdam', label: 'Netherlands (Amsterdam)' },
        { value: 'Europe/Brussels', label: 'Belgium (Brussels)' },
        { value: 'Europe/Vienna', label: 'Austria (Vienna)' },
        { value: 'Europe/Zurich', label: 'Switzerland (Zurich)' },
        { value: 'Europe/Warsaw', label: 'Poland (Warsaw)' },
        { value: 'Europe/Prague', label: 'Czech Republic (Prague)' },
        { value: 'Europe/Stockholm', label: 'Sweden (Stockholm)' },
        { value: 'Europe/Oslo', label: 'Norway (Oslo)' },
        { value: 'Europe/Copenhagen', label: 'Denmark (Copenhagen)' },
    ],
    'Eastern Europe': [
        { value: 'Europe/Moscow', label: 'Russia (Moscow)' },
        { value: 'Europe/Kiev', label: 'Ukraine (Kyiv)' },
        { value: 'Europe/Bucharest', label: 'Romania (Bucharest)' },
        { value: 'Europe/Athens', label: 'Greece (Athens)' },
        { value: 'Europe/Istanbul', label: 'Turkey (Istanbul)' },
        { value: 'Europe/Helsinki', label: 'Finland (Helsinki)' },
    ],
    'Asia': [
        { value: 'Asia/Dubai', label: 'UAE (Dubai)' },
        { value: 'Asia/Riyadh', label: 'Saudi Arabia (Riyadh)' },
        { value: 'Asia/Jerusalem', label: 'Israel (Jerusalem)' },
        { value: 'Asia/Kolkata', label: 'India (Kolkata/Mumbai)' },
        { value: 'Asia/Bangkok', label: 'Thailand (Bangkok)' },
        { value: 'Asia/Singapore', label: 'Singapore' },
        { value: 'Asia/Hong_Kong', label: 'Hong Kong' },
        { value: 'Asia/Shanghai', label: 'China (Shanghai)' },
        { value: 'Asia/Tokyo', label: 'Japan (Tokyo)' },
        { value: 'Asia/Seoul', label: 'South Korea (Seoul)' },
        { value: 'Asia/Manila', label: 'Philippines (Manila)' },
        { value: 'Asia/Jakarta', label: 'Indonesia (Jakarta)' },
        { value: 'Asia/Kuala_Lumpur', label: 'Malaysia (Kuala Lumpur)' },
        { value: 'Asia/Ho_Chi_Minh', label: 'Vietnam (Ho Chi Minh)' },
    ],
    'Oceania': [
        { value: 'Australia/Sydney', label: 'Australia (Sydney)' },
        { value: 'Australia/Melbourne', label: 'Australia (Melbourne)' },
        { value: 'Australia/Brisbane', label: 'Australia (Brisbane)' },
        { value: 'Australia/Perth', label: 'Australia (Perth)' },
        { value: 'Pacific/Auckland', label: 'New Zealand (Auckland)' },
        { value: 'Pacific/Fiji', label: 'Fiji' },
    ],
    'Africa': [
        { value: 'Africa/Cairo', label: 'Egypt (Cairo)' },
        { value: 'Africa/Johannesburg', label: 'South Africa (Johannesburg)' },
        { value: 'Africa/Lagos', label: 'Nigeria (Lagos)' },
        { value: 'Africa/Nairobi', label: 'Kenya (Nairobi)' },
        { value: 'Africa/Casablanca', label: 'Morocco (Casablanca)' },
    ],
}

// Language/Accent options
const LANGUAGE_ACCENTS = [
    { value: 'es-ES', label: 'Spanish (Spain)' },
    { value: 'es-MX', label: 'Spanish (Mexico)' },
    { value: 'es-AR', label: 'Spanish (Argentina)' },
    { value: 'es-CO', label: 'Spanish (Colombia)' },
    { value: 'es-CL', label: 'Spanish (Chile)' },
    { value: 'es-PE', label: 'Spanish (Peru)' },
    { value: 'en-US', label: 'English (USA)' },
    { value: 'en-GB', label: 'English (UK)' },
    { value: 'pt-BR', label: 'Portuguese (Brazil)' },
    { value: 'pt-PT', label: 'Portuguese (Portugal)' },
    { value: 'fr-FR', label: 'French (France)' },
    { value: 'de-DE', label: 'German (Germany)' },
    { value: 'it-IT', label: 'Italian (Italy)' },
]

function Agents() {
    const { agents, loading, error, createAgent, updateAgent, deleteAgent } = useAgents()
    const { knowledgeBases, createKnowledgeBase, deleteKnowledgeBase } = useKnowledgeBases()
    const { integrations, refetch: refetchIntegrations } = useIntegrations()
    const googleCalendarIntegration = integrations.find(i => i.type === 'google-calendar') || null
    const [showForm, setShowForm] = useState(false)
    const [editingAgent, setEditingAgent] = useState<string | null>(null)
    const [openMenuId, setOpenMenuId] = useState<string | null>(null)
    const [testingAgent, setTestingAgent] = useState<Agent | null>(null)
    const [saving, setSaving] = useState(false)
    const [showKnowledgeBaseForm, setShowKnowledgeBaseForm] = useState(false)
    const [newKnowledgeBase, setNewKnowledgeBase] = useState({ name: '', content: '' })
    const [savingKB, setSavingKB] = useState(false)
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

    // Agent form view (full page with scroll)
    if (showForm) {
        return (
            <div>
                {/* Header with back button */}
                <SectionHeader
                    title={editingAgent ? 'Edit Agent' : 'New Agent'}
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
                        {saving ? 'Saving...' : (editingAgent ? 'Save' : 'Create Agent')}
                    </button>
                </SectionHeader>

                {/* Form with scroll - all vertical */}
                <form id="agent-form" onSubmit={handleSubmit}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
                        {/* Agent Type */}
                        <div className="card" style={{ border: '2px solid #000', padding: 'var(--spacing-lg)' }}>
                            <h3 style={{ marginBottom: 'var(--spacing-lg)', fontSize: 'var(--font-size-lg)', fontWeight: 700 }}>
                                Agent Type
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

                        {/* Basic Information */}
                        <div className="card" style={{ border: '2px solid #000', padding: 'var(--spacing-lg)' }}>
                            <h3 style={{ marginBottom: 'var(--spacing-lg)', fontSize: 'var(--font-size-lg)', fontWeight: 700 }}>
                                Basic Information
                            </h3>
                            <div className="form-group">
                                <label htmlFor="name">Agent Name *</label>
                                <input
                                    id="name"
                                    type="text"
                                    className="input"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    required
                                    placeholder="E.g.: Sales Assistant"
                                />
                            </div>
                            <div className="form-group">
                                <label htmlFor="description">
                                    Base Prompt / Description *
                                    {formData.config.agentType && formData.config.agentType !== 'custom' && (
                                        <span style={{ fontWeight: 400, fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginLeft: 'var(--spacing-sm)' }}>
                                            (Pre-configured for {AGENT_PRESETS[formData.config.agentType].name})
                                        </span>
                                    )}
                                </label>
                                <textarea
                                    id="description"
                                    className="input textarea"
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    required
                                    placeholder="Describe the agent's capabilities and personality..."
                                    rows={6}
                                    style={{ fontFamily: 'monospace', fontSize: 'var(--font-size-sm)' }}
                                />
                                <small style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-xs)' }}>
                                    This is the base prompt that defines the agent's personality and behavior.
                                </small>
                            </div>
                            <div className="form-group">
                                <label htmlFor="platform">Platform</label>
                                <select
                                    id="platform"
                                    className="input select"
                                    value={formData.platform}
                                    onChange={(e) => setFormData({ ...formData, platform: e.target.value as 'whatsapp' | 'instagram' | '' })}
                                >
                                    <option value="">Not assigned</option>
                                    <option value="instagram">Instagram</option>
                                </select>
                            </div>
                        </div>

                        {/* Assistant Identity */}
                        <div className="card" style={{ border: '2px solid #000', padding: 'var(--spacing-lg)' }}>
                            <h3 style={{ marginBottom: 'var(--spacing-lg)', fontSize: 'var(--font-size-lg)', fontWeight: 700 }}>
                                Assistant Identity
                            </h3>
                            <div className="form-group">
                                <label htmlFor="assistantName">Assistant Name</label>
                                <input
                                    id="assistantName"
                                    type="text"
                                    className="input"
                                    value={formData.config.assistantName || ''}
                                    onChange={(e) => updateConfig('assistantName', e.target.value)}
                                    placeholder="E.g.: John, Sarah, etc."
                                />
                                <small style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-xs)' }}>
                                    Name your customers will see
                                </small>
                            </div>
                            <div className="form-group">
                                <label htmlFor="companyName">Company Name</label>
                                <input
                                    id="companyName"
                                    type="text"
                                    className="input"
                                    value={formData.config.companyName || ''}
                                    onChange={(e) => updateConfig('companyName', e.target.value)}
                                    placeholder="E.g.: My Company"
                                />
                            </div>
                            <div className="form-group">
                                <label htmlFor="ownerName">Owner Name</label>
                                <input
                                    id="ownerName"
                                    type="text"
                                    className="input"
                                    value={formData.config.ownerName || ''}
                                    onChange={(e) => updateConfig('ownerName', e.target.value)}
                                    placeholder="Your name"
                                />
                            </div>
                        </div>

                        {/* Business Information */}
                        <div className="card" style={{ border: '2px solid #000', padding: 'var(--spacing-lg)' }}>
                            <h3 style={{ marginBottom: 'var(--spacing-lg)', fontSize: 'var(--font-size-lg)', fontWeight: 700 }}>
                                Business Information
                            </h3>
                            <div className="form-group">
                                <label htmlFor="businessNiche">Business Niche</label>
                                <input
                                    id="businessNiche"
                                    type="text"
                                    className="input"
                                    value={formData.config.businessNiche || ''}
                                    onChange={(e) => updateConfig('businessNiche', e.target.value)}
                                    placeholder="E.g.: Coaching, Fitness, E-commerce"
                                />
                            </div>
                            <div className="form-group">
                                <label htmlFor="clientGoals">Client Goals</label>
                                <textarea
                                    id="clientGoals"
                                    className="input textarea"
                                    value={formData.config.clientGoals || ''}
                                    onChange={(e) => updateConfig('clientGoals', e.target.value)}
                                    placeholder="What goals does your service help achieve?"
                                    rows={2}
                                />
                            </div>
                            <div className="form-group">
                                <label htmlFor="offerDetails">Offer Details</label>
                                <textarea
                                    id="offerDetails"
                                    className="input textarea"
                                    value={formData.config.offerDetails || ''}
                                    onChange={(e) => updateConfig('offerDetails', e.target.value)}
                                    placeholder="What packages or services do you offer?"
                                    rows={2}
                                />
                            </div>
                            <div className="form-group">
                                <label htmlFor="importantLinks">Important Links</label>
                                <textarea
                                    id="importantLinks"
                                    className="input textarea"
                                    value={(formData.config.importantLinks || []).join('\n')}
                                    onChange={(e) => updateConfig('importantLinks', e.target.value.split('\n').filter(l => l.trim()))}
                                    placeholder="One link per line"
                                    rows={2}
                                />
                            </div>
                        </div>

                        {/* Behavior and Schedule */}
                        <div className="card" style={{ border: '2px solid #000', padding: 'var(--spacing-lg)' }}>
                            <h3 style={{ marginBottom: 'var(--spacing-lg)', fontSize: 'var(--font-size-lg)', fontWeight: 700 }}>
                                Behavior
                            </h3>
                            <div className="form-group">
                                <label htmlFor="openingQuestion">Opening Question</label>
                                <textarea
                                    id="openingQuestion"
                                    className="input textarea"
                                    value={formData.config.openingQuestion || ''}
                                    onChange={(e) => updateConfig('openingQuestion', e.target.value)}
                                    placeholder="First question the assistant will ask"
                                    rows={2}
                                />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--spacing-md)' }}>
                                <div className="form-group">
                                    <label htmlFor="activeHoursStart">Start Time</label>
                                    <input
                                        id="activeHoursStart"
                                        type="time"
                                        className="input"
                                        value={formData.config.activeHoursStart || '09:00'}
                                        onChange={(e) => updateConfig('activeHoursStart', e.target.value)}
                                    />
                                </div>
                                <div className="form-group">
                                    <label htmlFor="activeHoursEnd">End Time</label>
                                    <input
                                        id="activeHoursEnd"
                                        type="time"
                                        className="input"
                                        value={formData.config.activeHoursEnd || '18:00'}
                                        onChange={(e) => updateConfig('activeHoursEnd', e.target.value)}
                                    />
                                </div>
                                <div className="form-group">
                                    <label htmlFor="responseInterval">Interval (min)</label>
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

                        {/* Lead Qualification */}
                        <div className="card" style={{ border: '2px solid #000', padding: 'var(--spacing-lg)' }}>
                            <h3 style={{ marginBottom: 'var(--spacing-lg)', fontSize: 'var(--font-size-lg)', fontWeight: 700 }}>
                                <UserCheck size={20} style={{ display: 'inline', marginRight: 'var(--spacing-sm)', verticalAlign: 'middle' }} />
                                Lead Qualification
                            </h3>
                            <p style={{ marginBottom: 'var(--spacing-md)', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                                Configure criteria for the agent to determine if a lead is ideal for your service before scheduling a call.
                            </p>
                            <div className="form-group" style={{ background: 'var(--color-bg-secondary)', padding: 'var(--spacing-md)', borderRadius: 'var(--border-radius)', marginBottom: 'var(--spacing-md)' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', cursor: 'pointer' }}>
                                    <Checkbox
                                        checked={formData.config.enableQualification || false}
                                        onCheckedChange={(checked) => updateConfig('enableQualification', checked)}
                                    />
                                    <span style={{ fontWeight: 600 }}>Enable automatic qualification</span>
                                </label>
                            </div>
                            {formData.config.enableQualification && (
                                <>
                                    <div className="form-group">
                                        <label htmlFor="qualifyingQuestion">Qualifying Question</label>
                                        <textarea
                                            id="qualifyingQuestion"
                                            className="input textarea"
                                            value={formData.config.qualifyingQuestion || ''}
                                            onChange={(e) => updateConfig('qualifyingQuestion', e.target.value)}
                                            placeholder="E.g.: How much are you willing to invest in improving this?"
                                            rows={2}
                                        />
                                        <small style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-xs)' }}>
                                            The key question the agent will use to determine if the lead qualifies.
                                        </small>
                                    </div>
                                    <div className="form-group">
                                        <label htmlFor="qualificationCriteria">Qualification Criteria</label>
                                        <textarea
                                            id="qualificationCriteria"
                                            className="input textarea"
                                            value={formData.config.qualificationCriteria || ''}
                                            onChange={(e) => updateConfig('qualificationCriteria', e.target.value)}
                                            placeholder={`E.g.:
- Minimum budget: $500 USD
- Has an active business
- Willing to start within 30 days
- Not looking for "magic" or immediate results`}
                                            rows={4}
                                        />
                                        <small style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-xs)' }}>
                                            List the criteria the lead must meet to qualify. Be specific.
                                        </small>
                                    </div>
                                    <div className="form-group">
                                        <label htmlFor="disqualifyMessage">Message for Unqualified Leads</label>
                                        <textarea
                                            id="disqualifyMessage"
                                            className="input textarea"
                                            value={formData.config.disqualifyMessage || ''}
                                            onChange={(e) => updateConfig('disqualifyMessage', e.target.value)}
                                            placeholder="E.g.: I completely understand, it seems like right now wouldn't be the best fit for what we offer. I wish you the best of luck and if things change in the future, we'll be here!"
                                            rows={3}
                                        />
                                        <small style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-xs)' }}>
                                            Friendly message for leads who don't meet the criteria. Keep the door open.
                                        </small>
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Personalization */}
                        <div className="card" style={{ border: '2px solid #000', padding: 'var(--spacing-lg)' }}>
                            <h3 style={{ marginBottom: 'var(--spacing-lg)', fontSize: 'var(--font-size-lg)', fontWeight: 700 }}>
                                Personalization
                            </h3>

                            {/* Human Style */}
                            <div className="form-group" style={{ background: 'var(--color-bg-secondary)', padding: 'var(--spacing-md)', borderRadius: 'var(--border-radius)', marginBottom: 'var(--spacing-lg)' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', cursor: 'pointer', marginBottom: 'var(--spacing-xs)' }}>
                                    <Checkbox
                                        checked={formData.config.enableHumanStyle !== false}
                                        onCheckedChange={(checked) => updateConfig('enableHumanStyle', checked)}
                                    />
                                    <span style={{ fontWeight: 600 }}>Human-Style Messaging</span>
                                </label>
                                <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                                    When active, the agent sends multiple short messages like a real person,
                                    instead of one long message. For example: "Hey!" followed by "How are you?"
                                    in separate messages. This makes the conversation more natural.
                                </p>
                            </div>

                            <div className="form-group">
                                <label htmlFor="languageAccent">Language & Accent</label>
                                <select
                                    id="languageAccent"
                                    className="input select"
                                    value={formData.config.languageAccent || 'es-ES'}
                                    onChange={(e) => updateConfig('languageAccent', e.target.value)}
                                >
                                    {LANGUAGE_ACCENTS.map((lang) => (
                                        <option key={lang.value} value={lang.value}>
                                            {lang.label}
                                        </option>
                                    ))}
                                </select>
                                <small style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-xs)' }}>
                                    The AI will use expressions and accent from this region.
                                </small>
                            </div>

                            <div className="form-group">
                                <label htmlFor="toneGuidelines">Tone Guidelines</label>
                                <textarea
                                    id="toneGuidelines"
                                    className="input textarea"
                                    value={formData.config.toneGuidelines || ''}
                                    onChange={(e) => updateConfig('toneGuidelines', e.target.value)}
                                    placeholder="E.g.: Use a casual and friendly tone. Use local expressions. Be conversational."
                                    rows={3}
                                />
                                <small style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-xs)' }}>
                                    Describe how the agent should communicate: formal/informal, expressions, language, etc.
                                </small>
                            </div>

                            <div className="form-group">
                                <label htmlFor="additionalContext">Additional Context</label>
                                <textarea
                                    id="additionalContext"
                                    className="input textarea"
                                    value={formData.config.additionalContext || ''}
                                    onChange={(e) => updateConfig('additionalContext', e.target.value)}
                                    placeholder="Additional information the agent should know..."
                                    rows={3}
                                />
                            </div>
                        </div>

                        {/* Conversation Examples */}
                        <div className="card" style={{ border: '2px solid #000', padding: 'var(--spacing-lg)' }}>
                            <h3 style={{ marginBottom: 'var(--spacing-lg)', fontSize: 'var(--font-size-lg)', fontWeight: 700 }}>
                                Conversation Examples
                            </h3>
                            <p style={{ marginBottom: 'var(--spacing-md)', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                                Provide examples of how the agent should respond. This helps the AI understand the style and tone you want.
                            </p>
                            <div className="form-group">
                                <label htmlFor="conversationExamples">Examples</label>
                                <textarea
                                    id="conversationExamples"
                                    className="input textarea"
                                    value={formData.config.conversationExamples || ''}
                                    onChange={(e) => updateConfig('conversationExamples', e.target.value)}
                                    placeholder={`Example format:

Lead: Hi, I'm interested in learning more about the service
Agent: Hey! 👋
Agent: Great to hear from you
Agent: What caught your attention about what you saw?

Lead: I saw your coaching ad
Agent: Awesome!
Agent: Tell me a bit more, what are you looking to improve?

Lead: I want to improve my sales
Agent: Perfect, that's exactly what we help with
Agent: Do you have your own business or work in sales?`}
                                    rows={12}
                                    style={{ fontFamily: 'monospace', fontSize: 'var(--font-size-sm)' }}
                                />
                                <small style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-xs)' }}>
                                    Use "Lead:" for customer messages and "Agent:" for agent responses.
                                    You can use multiple "Agent:" lines in a row to show separate messages.
                                </small>
                            </div>
                        </div>

                        {/* Knowledge Bases */}
                        <div className="card" style={{ border: '2px solid #000', padding: 'var(--spacing-lg)' }}>
                            <h3 style={{ marginBottom: 'var(--spacing-lg)', fontSize: 'var(--font-size-lg)', fontWeight: 700 }}>
                                <FileText size={20} style={{ display: 'inline', marginRight: 'var(--spacing-sm)', verticalAlign: 'middle' }} />
                                Knowledge Bases
                            </h3>
                            <p style={{ marginBottom: 'var(--spacing-md)', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                                Add documents that the AI can reference when answering questions. Great for FAQs, product catalogs, pricing info, etc.
                            </p>

                            {/* Existing knowledge bases */}
                            {knowledgeBases.filter(kb => kb.agent_id === editingAgent).length > 0 && (
                                <div style={{ marginBottom: 'var(--spacing-lg)' }}>
                                    {knowledgeBases.filter(kb => kb.agent_id === editingAgent).map((kb) => (
                                        <div
                                            key={kb.id}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                padding: 'var(--spacing-md)',
                                                background: 'var(--color-bg-secondary)',
                                                borderRadius: 'var(--border-radius)',
                                                marginBottom: 'var(--spacing-sm)',
                                                border: '1px solid var(--color-border)',
                                            }}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                                                <FileText size={18} style={{ color: 'var(--color-primary)' }} />
                                                <div>
                                                    <div style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>{kb.name}</div>
                                                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                                                        {Math.round(kb.content.length / 1000)}KB
                                                    </div>
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => deleteKnowledgeBase(kb.id)}
                                                style={{
                                                    background: 'transparent',
                                                    border: 'none',
                                                    cursor: 'pointer',
                                                    color: 'var(--color-danger)',
                                                    padding: 'var(--spacing-xs)',
                                                }}
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Add new knowledge base form */}
                            {showKnowledgeBaseForm ? (
                                <div style={{ background: 'var(--color-bg-secondary)', padding: 'var(--spacing-md)', borderRadius: 'var(--border-radius)', border: '1px solid var(--color-border)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-md)' }}>
                                        <h4 style={{ margin: 0, fontSize: 'var(--font-size-base)', fontWeight: 600 }}>Add Knowledge Base</h4>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setShowKnowledgeBaseForm(false)
                                                setNewKnowledgeBase({ name: '', content: '' })
                                            }}
                                            style={{
                                                background: 'transparent',
                                                border: 'none',
                                                cursor: 'pointer',
                                                padding: 'var(--spacing-xs)',
                                            }}
                                        >
                                            <X size={18} />
                                        </button>
                                    </div>
                                    <div className="form-group">
                                        <label htmlFor="kbName">Document Name</label>
                                        <input
                                            id="kbName"
                                            type="text"
                                            className="input"
                                            value={newKnowledgeBase.name}
                                            onChange={(e) => setNewKnowledgeBase({ ...newKnowledgeBase, name: e.target.value })}
                                            placeholder="E.g.: Pricing FAQ, Product Catalog"
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label htmlFor="kbContent">Content</label>
                                        <textarea
                                            id="kbContent"
                                            className="input textarea"
                                            value={newKnowledgeBase.content}
                                            onChange={(e) => setNewKnowledgeBase({ ...newKnowledgeBase, content: e.target.value })}
                                            placeholder="Paste the content here... The AI will use this information to answer questions."
                                            rows={8}
                                            style={{ fontFamily: 'monospace', fontSize: 'var(--font-size-sm)' }}
                                        />
                                    </div>
                                    <button
                                        type="button"
                                        className="btn btn--primary"
                                        disabled={!newKnowledgeBase.name || !newKnowledgeBase.content || savingKB}
                                        onClick={async () => {
                                            if (!editingAgent) return
                                            setSavingKB(true)
                                            try {
                                                await createKnowledgeBase({
                                                    agent_id: editingAgent,
                                                    name: newKnowledgeBase.name,
                                                    content: newKnowledgeBase.content,
                                                    file_type: 'text',
                                                    file_size: newKnowledgeBase.content.length,
                                                })
                                                setNewKnowledgeBase({ name: '', content: '' })
                                                setShowKnowledgeBaseForm(false)
                                            } catch (err) {
                                                console.error('Error creating knowledge base:', err)
                                            } finally {
                                                setSavingKB(false)
                                            }
                                        }}
                                    >
                                        {savingKB ? 'Saving...' : 'Save Knowledge Base'}
                                    </button>
                                </div>
                            ) : (
                                <button
                                    type="button"
                                    className="btn btn--secondary"
                                    onClick={() => setShowKnowledgeBaseForm(true)}
                                    disabled={!editingAgent}
                                    style={{ opacity: editingAgent ? 1 : 0.5 }}
                                >
                                    <Plus size={16} />
                                    Add Knowledge Base
                                </button>
                            )}

                            {!editingAgent && (
                                <p style={{ marginTop: 'var(--spacing-sm)', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                                    Save the agent first to add knowledge bases.
                                </p>
                            )}
                        </div>

                        {/* Meeting Scheduling */}
                        <div className="card" style={{ border: '2px solid #000', padding: 'var(--spacing-lg)' }}>
                            <h3 style={{ marginBottom: 'var(--spacing-lg)', fontSize: 'var(--font-size-lg)', fontWeight: 700 }}>
                                Meeting Scheduling
                            </h3>
                            <div className="form-group">
                                <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', cursor: 'pointer' }}>
                                    <Checkbox
                                        checked={formData.config.enableMeetingScheduling || false}
                                        onCheckedChange={(checked) => updateConfig('enableMeetingScheduling', checked)}
                                    />
                                    <span>Enable automatic meeting scheduling with Google Calendar</span>
                                </label>
                            </div>

                            {formData.config.enableMeetingScheduling && (
                                <>
                                    {/* Google Calendar Integration Mini Card */}
                                    <GoogleCalendarMiniCard
                                        integration={googleCalendarIntegration}
                                        onConnect={() => refetchIntegrations()}
                                        onDisconnect={() => refetchIntegrations()}
                                    />

                                    <div className="form-group" style={{ marginTop: 'var(--spacing-lg)' }}>
                                        <label htmlFor="meetingEmail">Meeting Email *</label>
                                        <input
                                            id="meetingEmail"
                                            type="email"
                                            className="input"
                                            value={formData.config.meetingEmail || ''}
                                            onChange={(e) => updateConfig('meetingEmail', e.target.value)}
                                            placeholder="your-email@example.com"
                                            required={formData.config.enableMeetingScheduling}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label htmlFor="meetingTitle">Meeting Title</label>
                                        <input
                                            id="meetingTitle"
                                            type="text"
                                            className="input"
                                            value={formData.config.meetingTitle || ''}
                                            onChange={(e) => updateConfig('meetingTitle', e.target.value)}
                                            placeholder="E.g.: Call with {name}"
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label htmlFor="meetingDescription">Description</label>
                                        <textarea
                                            id="meetingDescription"
                                            className="input textarea"
                                            value={formData.config.meetingDescription || ''}
                                            onChange={(e) => updateConfig('meetingDescription', e.target.value)}
                                            placeholder="Purpose of the meeting"
                                            rows={2}
                                        />
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-md)' }}>
                                        <div className="form-group">
                                            <label htmlFor="meetingDuration">Duration (min)</label>
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
                                        <label htmlFor="meetingTimezone">Timezone</label>
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
                                            <label htmlFor="meetingAvailableHoursStart">Start Time</label>
                                            <input
                                                id="meetingAvailableHoursStart"
                                                type="time"
                                                className="input"
                                                value={formData.config.meetingAvailableHoursStart || '09:00'}
                                                onChange={(e) => updateConfig('meetingAvailableHoursStart', e.target.value)}
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label htmlFor="meetingAvailableHoursEnd">End Time</label>
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
                                        <label>Available Days</label>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--spacing-md)' }}>
                                            {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day, index) => {
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

    // Agent list view
    return (
        <div>
            <SectionHeader title="Agents" icon={<Bot size={24} />}>
                <button className="btn btn--primary" onClick={() => setShowForm(true)}>
                    <Plus size={18} />
                    Create Agent
                </button>
            </SectionHeader>

            {agents.length === 0 ? (
                <div className="card" style={{ border: '2px solid #000' }}>
                    <div className="empty-state">
                        <div style={{ margin: '0 auto var(--spacing-md)', opacity: 0.5 }}>
                            <Logo size={48} variant="stroke" />
                        </div>
                        <h3>No agents created</h3>
                        <p>Create your first AI agent to get started</p>
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
                                            color: '#000',
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
                                                <>Last updated {formatDate(agent.updated_at)}</>
                                            )}
                                            {agent.created_at && agent.updated_at && ' | '}
                                            {agent.created_at && (
                                                <>Created {formatFullDate(agent.created_at)}</>
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
                                            Not assigned
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
                                            Active
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
                                                    Test Agent
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
                                                    Delete
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

            {/* Agent test modal */}
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
