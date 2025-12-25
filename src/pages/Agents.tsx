import { useState, useEffect } from 'react'
import { Brain, Plus, Trash2, MoreVertical, MessageSquare, ArrowRight } from 'lucide-react'
import { useAgents, type AgentConfig, type Agent } from '../hooks/useAgents'
import { Switch } from '../components/ui/switch'
import Modal from '../components/common/Modal'
import AgentTestChat from '../components/AgentTestChat'
import WhatsAppIcon from '../components/icons/WhatsAppIcon'
import InstagramIcon from '../components/icons/InstagramIcon'
import { formatDate, formatFullDate } from '../utils/date'
import { Checkbox } from '../components/ui/checkbox'

function Agents() {
    const { agents, loading, error, createAgent, updateAgent, deleteAgent } = useAgents()
    const [showForm, setShowForm] = useState(false)
    const [editingAgent, setEditingAgent] = useState<string | null>(null)
    const [openMenuId, setOpenMenuId] = useState<string | null>(null)
    const [testingAgent, setTestingAgent] = useState<Agent | null>(null)
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        platform: '' as 'whatsapp' | 'instagram' | '',
        config: {} as AgentConfig,
    })
    const [currentStep, setCurrentStep] = useState(1)
    const [isTransitioning, setIsTransitioning] = useState(false)
    const totalSteps = 7

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        console.log('[Agents] handleSubmit called, currentStep:', currentStep, 'totalSteps:', totalSteps, 'isTransitioning:', isTransitioning)

        // Prevenir submit durante transiciones entre pasos
        if (isTransitioning) {
            console.log('[Agents] Currently transitioning, ignoring submit')
            return
        }

        // Solo permitir submit en el último paso
        if (currentStep !== totalSteps) {
            console.log('[Agents] Not on last step, preventing submit')
            return
        }

        console.log('[Agents] On last step, proceeding with submit')

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
            setCurrentStep(1)
            setIsTransitioning(false) // Resetear flag de transición
            setShowForm(false)
        } catch (err) {
            console.error('Error saving agent:', err)
            alert('Error al guardar el agente. Por favor, intenta de nuevo.')
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
        setCurrentStep(1) // Siempre empezar desde el primer paso
        setIsTransitioning(false) // Resetear flag de transición
        setShowForm(true)
    }

    const nextStep = () => {
        console.log('[Agents] nextStep called, currentStep:', currentStep, 'totalSteps:', totalSteps)
        if (currentStep < totalSteps) {
            setIsTransitioning(true)
            setCurrentStep(currentStep + 1)
            console.log('[Agents] Moving to step:', currentStep + 1)

            // Desactivar la bandera de transición después de un breve delay
            setTimeout(() => {
                setIsTransitioning(false)
                console.log('[Agents] Transition complete')
            }, 300)
        } else {
            console.log('[Agents] Already at last step, not advancing')
        }
    }

    const prevStep = () => {
        console.log('[Agents] prevStep called, currentStep:', currentStep)
        if (currentStep > 1) {
            setCurrentStep(currentStep - 1)
            console.log('[Agents] Moving to step:', currentStep - 1)
        } else {
            console.log('[Agents] Already at first step, not going back')
        }
    }

    const updateConfig = (key: keyof AgentConfig, value: any) => {
        setFormData((prev) => {
            const newConfig = { ...prev.config, [key]: value }

            // Si se está habilitando el agendamiento de reuniones, establecer valores por defecto
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

    // Monitorear cambios en currentStep
    useEffect(() => {
        console.log('[Agents] currentStep changed to:', currentStep)
    }, [currentStep])

    // Cerrar menú al hacer clic fuera
    useEffect(() => {
        const handleClickOutside = () => setOpenMenuId(null)
        if (openMenuId) {
            document.addEventListener('click', handleClickOutside)
            return () => document.removeEventListener('click', handleClickOutside)
        }
    }, [openMenuId])

    if (loading) {
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

    return (
        <div>
            <div style={{ marginBottom: 'var(--spacing-md)', display: 'flex', justifyContent: 'flex-end' }}>
                <button className="btn btn--primary" onClick={() => {
                    setCurrentStep(1) // Siempre empezar desde el primer paso
                    setIsTransitioning(false) // Resetear flag de transición
                    setShowForm(true)
                }}>
                    <Plus size={18} />
                    Crear Agente
                </button>
            </div>

            <Modal
                isOpen={showForm}
                onClose={() => {
                    setShowForm(false)
                    setEditingAgent(null)
                    setFormData({ name: '', description: '', platform: '', config: {} })
                    setCurrentStep(1)
                    setIsTransitioning(false)
                }}
                title={editingAgent ? 'Editar Agente' : 'Nuevo Agente'}
            >
                <form
                    onSubmit={handleSubmit}
                    style={{ display: 'flex', flexDirection: 'column', height: '100%', maxHeight: '80vh' }}
                >
                    {/* Form Content - Scrollable */}
                    <div style={{
                        flex: 1,
                        overflowY: 'auto',
                        overflowX: 'hidden',
                        padding: 'var(--spacing-lg)',
                        paddingBottom: 'var(--spacing-md)',
                    }}>
                        {/* Progress Indicator */}
                        <div style={{
                            marginBottom: 'var(--spacing-lg)',
                            paddingBottom: 'var(--spacing-md)',
                            borderBottom: '2px solid var(--color-border)'
                        }}>
                            <p style={{
                                margin: 0,
                                fontSize: 'var(--font-size-sm)',
                                fontWeight: 600,
                                color: 'var(--color-primary)'
                            }}>
                                Paso {currentStep} de {totalSteps}
                            </p>
                            <div style={{
                                marginTop: 'var(--spacing-xs)',
                                height: '4px',
                                background: 'var(--color-bg-secondary)',
                                borderRadius: '2px',
                                overflow: 'hidden'
                            }}>
                                <div style={{
                                    height: '100%',
                                    background: 'var(--color-primary)',
                                    width: `${(currentStep / totalSteps) * 100}%`,
                                    transition: 'width 0.3s ease'
                                }} />
                            </div>
                        </div>

                        {/* Step 1: Información Básica */}
                        {currentStep === 1 && (
                            <div>
                                <h3 style={{ marginBottom: 'var(--spacing-lg)', fontSize: 'var(--font-size-xl)', fontWeight: 700 }}>
                                    Información Básica
                                </h3>
                                <div>
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
                                        <label htmlFor="description">Descripción *</label>
                                        <textarea
                                            id="description"
                                            className="input textarea"
                                            value={formData.description}
                                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                            required
                                            placeholder="Describe las capacidades y personalidad del agente..."
                                            rows={3}
                                        />
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
                                            <option value="whatsapp">WhatsApp</option>
                                            <option value="instagram">Instagram</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Step 2: Identidad del Asistente */}
                        {currentStep === 2 && (
                            <div>
                                <h3 style={{ marginBottom: 'var(--spacing-lg)', fontSize: 'var(--font-size-xl)', fontWeight: 700 }}>
                                    Identidad del Asistente
                                </h3>
                                <div>
                                    <div className="form-group">
                                        <label htmlFor="assistantName">Nombre del Asistente (para clientes)</label>
                                        <input
                                            id="assistantName"
                                            type="text"
                                            className="input"
                                            value={formData.config.assistantName || ''}
                                            onChange={(e) => updateConfig('assistantName', e.target.value)}
                                            placeholder="Ej: Juan, María, etc."
                                        />
                                        <small style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-xs)', opacity: 0.9 }}>
                                            Nombre que verán tus clientes al interactuar con el asistente
                                        </small>
                                    </div>
                                    <div className="form-group">
                                        <label htmlFor="companyName">Nombre de la Empresa/Programa</label>
                                        <input
                                            id="companyName"
                                            type="text"
                                            className="input"
                                            value={formData.config.companyName || ''}
                                            onChange={(e) => updateConfig('companyName', e.target.value)}
                                            placeholder="Ej: Mi Empresa, Mi Programa"
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
                            </div>
                        )}

                        {/* Step 3: Información del Negocio */}
                        {currentStep === 3 && (
                            <div>
                                <h3 style={{ marginBottom: 'var(--spacing-lg)', fontSize: 'var(--font-size-xl)', fontWeight: 700 }}>
                                    Información del Negocio
                                </h3>
                                <div>
                                    <div className="form-group">
                                        <label htmlFor="clientGoals">Objetivos del Cliente</label>
                                        <textarea
                                            id="clientGoals"
                                            className="input textarea"
                                            value={formData.config.clientGoals || ''}
                                            onChange={(e) => updateConfig('clientGoals', e.target.value)}
                                            placeholder="¿Qué objetivos ayuda tu servicio/producto a lograr? Sé específico."
                                            rows={3}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label htmlFor="offerDetails">Detalles de la Oferta</label>
                                        <textarea
                                            id="offerDetails"
                                            className="input textarea"
                                            value={formData.config.offerDetails || ''}
                                            onChange={(e) => updateConfig('offerDetails', e.target.value)}
                                            placeholder="¿Qué paquetes o servicios ofreces? ¿Qué incluye cada uno?"
                                            rows={3}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label htmlFor="businessNiche">Nicho de Negocio</label>
                                        <input
                                            id="businessNiche"
                                            type="text"
                                            className="input"
                                            value={formData.config.businessNiche || ''}
                                            onChange={(e) => updateConfig('businessNiche', e.target.value)}
                                            placeholder="Ej: Bienes Raíces, Coaching, Fitness, E-commerce"
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label htmlFor="importantLinks">Enlaces Importantes</label>
                                        <textarea
                                            id="importantLinks"
                                            className="input textarea"
                                            value={(formData.config.importantLinks || []).join('\n')}
                                            onChange={(e) => updateConfig('importantLinks', e.target.value.split('\n').filter(l => l.trim()))}
                                            placeholder="Un enlace por línea&#10;https://www.ejemplo.com&#10;https://www.otro-ejemplo.com"
                                            rows={3}
                                        />
                                        <small style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-xs)', opacity: 0.9 }}>
                                            Un enlace por línea. Recursos importantes que el asistente debe conocer.
                                        </small>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Step 4: Comportamiento */}
                        {currentStep === 4 && (
                            <div>
                                <h3 style={{ marginBottom: 'var(--spacing-lg)', fontSize: 'var(--font-size-xl)', fontWeight: 700 }}>
                                    Comportamiento y Horarios
                                </h3>
                                <div>
                                    <div className="form-group">
                                        <label htmlFor="openingQuestion">Pregunta de Apertura</label>
                                        <textarea
                                            id="openingQuestion"
                                            className="input textarea"
                                            value={formData.config.openingQuestion || ''}
                                            onChange={(e) => updateConfig('openingQuestion', e.target.value)}
                                            placeholder="Primera pregunta que hará el asistente. Debe ser abierta y permitir que el cliente comparta sus necesidades."
                                            rows={2}
                                        />
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 'var(--spacing-md)' }}>
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
                            </div>
                        )}

                        {/* Step 5: Calificación de Leads */}
                        {currentStep === 5 && (
                            <div>
                                <h3 style={{ marginBottom: 'var(--spacing-lg)', fontSize: 'var(--font-size-xl)', fontWeight: 700 }}>
                                    Calificación de Leads
                                </h3>
                                <div>
                                    <div className="form-group">
                                        <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', cursor: 'pointer' }}>
                                            <Checkbox
                                                checked={formData.config.enableQualification || false}
                                                onCheckedChange={(checked) => updateConfig('enableQualification', checked)}
                                            />
                                            <span style={{ color: 'var(--color-text)' }}>Habilitar calificación de leads</span>
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
                                                    placeholder="Pregunta para determinar si el lead está calificado"
                                                    rows={2}
                                                />
                                            </div>
                                            <div className="form-group">
                                                <label htmlFor="qualificationCriteria">Criterios de Calificación</label>
                                                <textarea
                                                    id="qualificationCriteria"
                                                    className="input textarea"
                                                    value={formData.config.qualificationCriteria || ''}
                                                    onChange={(e) => updateConfig('qualificationCriteria', e.target.value)}
                                                    placeholder="Ej: Mínimo $5000 disponible para invertir"
                                                    rows={2}
                                                />
                                            </div>
                                            <div className="form-group">
                                                <label htmlFor="disqualifyMessage">Mensaje para Descalificados</label>
                                                <textarea
                                                    id="disqualifyMessage"
                                                    className="input textarea"
                                                    value={formData.config.disqualifyMessage || ''}
                                                    onChange={(e) => updateConfig('disqualifyMessage', e.target.value)}
                                                    placeholder="Mensaje o enlace a recursos gratuitos para leads no calificados"
                                                    rows={2}
                                                />
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Step 6: Personalización */}
                        {currentStep === 6 && (
                            <div>
                                <h3 style={{ marginBottom: 'var(--spacing-lg)', fontSize: 'var(--font-size-xl)', fontWeight: 700 }}>
                                    Personalización Avanzada
                                </h3>
                                <div>
                                    <div className="form-group">
                                        <label htmlFor="toneGuidelines">Guías de Tono</label>
                                        <textarea
                                            id="toneGuidelines"
                                            className="input textarea"
                                            value={formData.config.toneGuidelines || ''}
                                            onChange={(e) => updateConfig('toneGuidelines', e.target.value)}
                                            placeholder="Instrucciones sobre el tono y estilo de comunicación del asistente"
                                            rows={3}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label htmlFor="additionalContext">Contexto Adicional</label>
                                        <textarea
                                            id="additionalContext"
                                            className="input textarea"
                                            value={formData.config.additionalContext || ''}
                                            onChange={(e) => updateConfig('additionalContext', e.target.value)}
                                            placeholder="Cualquier información adicional que el asistente deba conocer"
                                            rows={3}
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Step 7: Configuración de Reuniones */}
                        {currentStep === 7 && (
                            <div>
                                <h3 style={{ marginBottom: 'var(--spacing-lg)', fontSize: 'var(--font-size-xl)', fontWeight: 700 }}>
                                    Generación de Reuniones (Opcional)
                                </h3>
                                <div style={{
                                    background: 'var(--color-bg-secondary)',
                                    padding: 'var(--spacing-md)',
                                    borderRadius: 'var(--border-radius)',
                                    marginBottom: 'var(--spacing-lg)',
                                    border: '2px solid var(--color-border)'
                                }}>
                                    <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                                        🎉 <strong>¡Último paso!</strong> Esta configuración es opcional. Si no deseas habilitar reuniones automáticas,
                                        puedes hacer clic en "{editingAgent ? 'Guardar Cambios' : 'Crear Agente'}" para finalizar.
                                    </p>
                                </div>
                                <div>
                                    <div className="form-group">
                                        <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', cursor: 'pointer' }}>
                                            <Checkbox
                                                checked={formData.config.enableMeetingScheduling || false}
                                                onCheckedChange={(checked) => updateConfig('enableMeetingScheduling', checked)}
                                            />
                                            <span style={{ color: 'var(--color-text)' }}>Habilitar generación automática de reuniones con Google Calendar</span>
                                        </label>
                                        <small style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-xs)', opacity: 0.9, display: 'block', marginTop: 'var(--spacing-xs)' }}>
                                            Cuando un lead esté calificado, el agente podrá crear automáticamente una reunión en tu calendario
                                        </small>
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
                                                    required
                                                />
                                                <small style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-xs)', opacity: 0.9 }}>
                                                    Este es el email donde recibirás las invitaciones de las reuniones agendadas
                                                </small>
                                            </div>

                                            <div className="form-group">
                                                <label htmlFor="meetingTitle">Título de la Reunión</label>
                                                <input
                                                    id="meetingTitle"
                                                    type="text"
                                                    className="input"
                                                    value={formData.config.meetingTitle || ''}
                                                    onChange={(e) => updateConfig('meetingTitle', e.target.value)}
                                                    placeholder="Ej: Llamada de Consultoría con {nombre}"
                                                />
                                                <small style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-xs)', opacity: 0.9 }}>
                                                    Usa {'{nombre}'} para incluir el nombre del lead
                                                </small>
                                            </div>

                                            <div className="form-group">
                                                <label htmlFor="meetingDescription">Descripción de la Reunión</label>
                                                <textarea
                                                    id="meetingDescription"
                                                    className="input textarea"
                                                    value={formData.config.meetingDescription || ''}
                                                    onChange={(e) => updateConfig('meetingDescription', e.target.value)}
                                                    placeholder="Describe el propósito de la reunión"
                                                    rows={2}
                                                />
                                            </div>

                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 'var(--spacing-md)' }}>
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
                                                    <small style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-xs)', opacity: 0.9 }}>
                                                        Tiempo entre reuniones
                                                    </small>
                                                </div>
                                            </div>

                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-md)' }}>
                                                <div className="form-group">
                                                    <label htmlFor="meetingAvailableHoursStart">Horario Disponible - Inicio</label>
                                                    <input
                                                        id="meetingAvailableHoursStart"
                                                        type="time"
                                                        className="input"
                                                        value={formData.config.meetingAvailableHoursStart || '09:00'}
                                                        onChange={(e) => updateConfig('meetingAvailableHoursStart', e.target.value)}
                                                    />
                                                </div>

                                                <div className="form-group">
                                                    <label htmlFor="meetingAvailableHoursEnd">Horario Disponible - Fin</label>
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
                                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: 'var(--spacing-sm)' }}>
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
                        )}
                    </div>

                    {/* Navigation Buttons */}
                    <div style={{
                        display: 'flex',
                        gap: 'var(--spacing-md)',
                        justifyContent: 'space-between',
                        padding: 'var(--spacing-lg)',
                        paddingTop: 'var(--spacing-md)',
                        borderTop: '2px solid #000',
                        flexShrink: 0,
                        background: 'var(--color-bg)',
                    }}>
                        <button
                            type="button"
                            className="btn btn--secondary"
                            onClick={() => {
                                setShowForm(false)
                                setEditingAgent(null)
                                setFormData({ name: '', description: '', platform: '', config: {} })
                                setCurrentStep(1)
                            }}
                        >
                            Cancelar
                        </button>
                        <div style={{ display: 'flex', gap: 'var(--spacing-md)' }}>
                            {currentStep > 1 && (
                                <button
                                    type="button"
                                    className="btn btn--secondary"
                                    onClick={prevStep}
                                >
                                    Atrás
                                </button>
                            )}
                            {currentStep < totalSteps ? (
                                <button
                                    type="button"
                                    className="btn btn--primary"
                                    onClick={nextStep}
                                >
                                    Continuar
                                    <ArrowRight size={18} />
                                </button>
                            ) : (
                                <button
                                    type="submit"
                                    className="btn btn--primary"
                                    disabled={isTransitioning}
                                    style={{
                                        opacity: isTransitioning ? 0.5 : 1,
                                        cursor: isTransitioning ? 'not-allowed' : 'pointer'
                                    }}
                                >
                                    <Plus size={18} />
                                    {editingAgent ? 'Guardar Cambios' : 'Crear Agente'}
                                </button>
                            )}
                        </div>
                    </div>
                </form>
            </Modal>

            {agents.length === 0 ? (
                <div className="card" style={{ border: '2px solid #000' }}>
                    <div className="empty-state">
                        <Brain size={48} style={{ margin: '0 auto var(--spacing-md)', opacity: 0.5 }} />
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
                                    // No abrir edición si se hace clic en el menú o el toggle
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
                                    e.currentTarget.style.borderColor = 'var(--color-border)'
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
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            flexShrink: 0,
                                        }}
                                    >
                                        <Brain size={24} color="var(--color-primary)" />
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
                                    {/* Platform Badge (WhatsApp/Instagram) */}
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
                                                // Si se activa y no tiene plataforma, asignar WhatsApp por defecto
                                                handleAssignPlatform(agent.id, 'whatsapp')
                                            } else if (!checked && agent.platform) {
                                                // Si se desactiva, quitar plataforma
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
                                                    <>
                                                        <button
                                                            onClick={() => {
                                                                handleAssignPlatform(agent.id, 'whatsapp')
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
                                                            <WhatsAppIcon size={16} color="#a6e3a1" />
                                                            Asignar WhatsApp
                                                        </button>
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
                                                    </>
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
