import { useState, useEffect } from 'react'
import { MessageCircle, Plus, Settings, MoreVertical, Trash2, X } from 'lucide-react'
import SectionHeader from '../components/SectionHeader'
import Modal from '../components/common/Modal'
import { Switch } from '../components/ui/switch'
import { useInstagramPosts, type InstagramPost } from '../hooks/useInstagramPosts'
import { useCommentAutomations, type CommentAutomation, type CreateCommentAutomationData } from '../hooks/useCommentAutomations'
import { useIntegrations } from '../hooks/useIntegrations'
import InstagramIcon from '../components/icons/InstagramIcon'

function Comments() {
    const { posts, loading: postsLoading, error: postsError } = useInstagramPosts()
    const { automations, loading: automationsLoading, createAutomation, updateAutomation, deleteAutomation, toggleAutomation, refetch: refetchAutomations } = useCommentAutomations()
    const { integrations } = useIntegrations()

    const [selectedPost, setSelectedPost] = useState<InstagramPost | null>(null)
    const [showAutomationModal, setShowAutomationModal] = useState(false)
    const [editingAutomation, setEditingAutomation] = useState<CommentAutomation | null>(null)
    const [openMenuId, setOpenMenuId] = useState<string | null>(null)
    const [saving, setSaving] = useState(false)

    // Form state
    const [formData, setFormData] = useState<CreateCommentAutomationData>({
        name: '',
        trigger_keywords: [],
        trigger_type: 'contains',
        response_type: 'manual',
        comment_reply: '',
        comment_reply_variations: [],
        dm_message: '',
        dm_delay_seconds: 0,
        agent_id: null
    })
    const [keywordInput, setKeywordInput] = useState('')
    const [variationInput, setVariationInput] = useState('')

    const instagramConnected = integrations.some(i => i.type === 'instagram' && i.status === 'connected')

    const loading = postsLoading || automationsLoading

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = () => setOpenMenuId(null)
        if (openMenuId) {
            document.addEventListener('click', handleClickOutside)
            return () => document.removeEventListener('click', handleClickOutside)
        }
    }, [openMenuId])

    const handleOpenAutomationModal = (post: InstagramPost, automation?: CommentAutomation) => {
        setSelectedPost(post)
        setVariationInput('')
        if (automation) {
            setEditingAutomation(automation)
            setFormData({
                post_id: automation.post_id,
                name: automation.name,
                trigger_keywords: automation.trigger_keywords || [],
                trigger_type: automation.trigger_type,
                response_type: 'manual',
                comment_reply: automation.comment_reply || '',
                comment_reply_variations: automation.comment_reply_variations || [],
                dm_message: automation.dm_message || '',
                dm_delay_seconds: automation.dm_delay_seconds || 0,
                agent_id: null
            })
        } else {
            setEditingAutomation(null)
            setFormData({
                post_id: post.id,
                name: `Automation for ${post.caption?.substring(0, 30) || 'post'}...`,
                trigger_keywords: [],
                trigger_type: 'contains',
                response_type: 'manual',
                comment_reply: '',
                comment_reply_variations: ['Sent! 📩', 'Done! Check your DMs', 'Sent to your inbox!', 'Check DMs 🔥'],
                dm_message: 'Hey! Thanks for your interest. Here\'s what you requested...',
                dm_delay_seconds: 0,
                agent_id: null
            })
        }
        setShowAutomationModal(true)
    }

    const handleCloseModal = () => {
        setShowAutomationModal(false)
        setSelectedPost(null)
        setEditingAutomation(null)
        setKeywordInput('')
    }

    const handleAddKeyword = () => {
        if (keywordInput.trim() && !formData.trigger_keywords?.includes(keywordInput.trim().toLowerCase())) {
            setFormData(prev => ({
                ...prev,
                trigger_keywords: [...(prev.trigger_keywords || []), keywordInput.trim().toLowerCase()]
            }))
            setKeywordInput('')
        }
    }

    const handleRemoveKeyword = (keyword: string) => {
        setFormData(prev => ({
            ...prev,
            trigger_keywords: (prev.trigger_keywords || []).filter(k => k !== keyword)
        }))
    }

    const handleAddVariation = () => {
        if (variationInput.trim() && !formData.comment_reply_variations?.includes(variationInput.trim())) {
            setFormData(prev => ({
                ...prev,
                comment_reply_variations: [...(prev.comment_reply_variations || []), variationInput.trim()]
            }))
            setVariationInput('')
        }
    }

    const handleRemoveVariation = (variation: string) => {
        setFormData(prev => ({
            ...prev,
            comment_reply_variations: (prev.comment_reply_variations || []).filter(v => v !== variation)
        }))
    }

    const handleSaveAutomation = async () => {
        try {
            setSaving(true)
            if (editingAutomation) {
                await updateAutomation(editingAutomation.id, formData)
            } else {
                await createAutomation(formData)
            }
            handleCloseModal()
            refetchAutomations()
        } catch (err) {
            console.error('Error saving automation:', err)
            alert('Error saving automation')
        } finally {
            setSaving(false)
        }
    }

    const handleDeleteAutomation = async (id: string) => {
        if (!confirm('Delete this automation?')) return
        try {
            await deleteAutomation(id)
        } catch (err) {
            console.error('Error deleting:', err)
        }
    }

    const getPostAutomations = (postId: string) => {
        return automations.filter(a => a.post_id === postId)
    }

    if (!instagramConnected) {
        return (
            <div>
                <SectionHeader
                    title="Comments"
                    description="Set up automated DM responses for Instagram comments"
                    icon={<MessageCircle size={24} />}
                />
                <div className="card" style={{ border: '2px solid #000', padding: 'var(--spacing-xl)', textAlign: 'center' }}>
                    <InstagramIcon size={48} color="#f38ba8" />
                    <h3 style={{ marginTop: 'var(--spacing-md)' }}>Connect Instagram</h3>
                    <p style={{ color: 'var(--color-text-secondary)' }}>
                        Connect your Instagram account to set up comment automations
                    </p>
                    <a href="/integrations" className="btn btn--primary" style={{ marginTop: 'var(--spacing-md)' }}>
                        Go to Integrations
                    </a>
                </div>
            </div>
        )
    }

    return (
        <div>
            <SectionHeader title="Comments" icon={<MessageCircle size={24} />} />

            {loading ? (
                <div className="card" style={{ border: '2px solid #000' }}>
                    <div className="empty-state">
                        <div className="spinner" />
                        <p>Loading posts...</p>
                    </div>
                </div>
            ) : postsError ? (
                <div className="card" style={{ border: '2px solid #000' }}>
                    <div className="empty-state">
                        <h3>Error</h3>
                        <p>{postsError}</p>
                    </div>
                </div>
            ) : posts.length === 0 ? (
                <div className="card" style={{ border: '2px solid #000' }}>
                    <div className="empty-state">
                        <MessageCircle size={48} style={{ opacity: 0.5 }} />
                        <h3>No posts yet</h3>
                        <p>Your Instagram posts will appear here automatically</p>
                    </div>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
                    {posts.map(post => {
                        const postAutomation = getPostAutomations(post.id)[0] // Only one automation per post

                        return (
                            <div
                                key={post.id}
                                style={{
                                    background: 'var(--color-bg)',
                                    border: '2px solid #000',
                                    borderRadius: 'var(--border-radius-lg)',
                                    padding: 'var(--spacing-lg)',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    gap: 'var(--spacing-md)',
                                    opacity: postAutomation && !postAutomation.is_active ? 0.7 : 1,
                                }}
                            >
                                {/* Left: Thumbnail and info */}
                                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)' }}>
                                    {/* Post thumbnail */}
                                    <div
                                        style={{
                                            width: '64px',
                                            height: '64px',
                                            borderRadius: 'var(--border-radius)',
                                            border: '2px solid #000',
                                            overflow: 'hidden',
                                            flexShrink: 0,
                                            background: 'var(--color-bg-secondary)',
                                        }}
                                    >
                                        {(post.media_url || post.thumbnail_url) ? (
                                            <img
                                                src={post.thumbnail_url || post.media_url || ''}
                                                alt=""
                                                style={{
                                                    width: '100%',
                                                    height: '100%',
                                                    objectFit: 'cover',
                                                }}
                                            />
                                        ) : (
                                            <div style={{
                                                width: '100%',
                                                height: '100%',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                            }}>
                                                <InstagramIcon size={24} color="#ccc" />
                                            </div>
                                        )}
                                    </div>

                                    {/* Post info */}
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-xs)' }}>
                                            <h3 style={{
                                                margin: 0,
                                                fontSize: 'var(--font-size-base)',
                                                fontWeight: 600,
                                                color: 'var(--color-text)',
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap',
                                                maxWidth: '500px',
                                            }}>
                                                {post.caption || 'No caption'}
                                            </h3>
                                        </div>
                                        <p style={{
                                            margin: 0,
                                            fontSize: 'var(--font-size-sm)',
                                            color: 'var(--color-text-secondary)',
                                        }}>
                                            {post.comments_count || 0} comments
                                            {postAutomation && (
                                                <>
                                                    {' • '}
                                                    {postAutomation.trigger_keywords?.length > 0
                                                        ? `Keywords: ${postAutomation.trigger_keywords.join(', ')}`
                                                        : 'All comments'}
                                                    {postAutomation.triggers_count > 0 && ` • ${postAutomation.triggers_count} triggers`}
                                                </>
                                            )}
                                        </p>
                                    </div>
                                </div>

                                {/* Right: Controls */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)' }}>
                                    {postAutomation ? (
                                        <>
                                            {/* Active/Inactive label */}
                                            <span style={{
                                                fontSize: 'var(--font-size-sm)',
                                                fontWeight: 600,
                                                color: postAutomation.is_active ? 'var(--color-success)' : 'var(--color-text-secondary)',
                                            }}>
                                                {postAutomation.is_active ? 'Active' : 'Inactive'}
                                            </span>

                                            {/* Toggle Switch */}
                                            <Switch
                                                checked={postAutomation.is_active}
                                                onCheckedChange={(checked) => toggleAutomation(postAutomation.id, checked)}
                                            />

                                            {/* Menu */}
                                            <div style={{ position: 'relative' }} onClick={(e) => e.stopPropagation()}>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        setOpenMenuId(openMenuId === postAutomation.id ? null : postAutomation.id)
                                                    }}
                                                    style={{
                                                        background: 'transparent',
                                                        border: 'none',
                                                        cursor: 'pointer',
                                                        padding: 'var(--spacing-xs)',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        color: 'var(--color-text-secondary)',
                                                        borderRadius: 'var(--border-radius-sm)',
                                                    }}
                                                >
                                                    <MoreVertical size={20} />
                                                </button>
                                                {openMenuId === postAutomation.id && (
                                                    <div
                                                        style={{
                                                            position: 'absolute',
                                                            right: 0,
                                                            top: '100%',
                                                            marginTop: 'var(--spacing-xs)',
                                                            background: 'var(--color-bg)',
                                                            border: '2px solid #000',
                                                            borderRadius: 'var(--border-radius)',
                                                            boxShadow: 'var(--shadow-md)',
                                                            padding: 'var(--spacing-xs)',
                                                            zIndex: 100,
                                                            minWidth: '120px',
                                                        }}
                                                        onClick={(e) => e.stopPropagation()}
                                                    >
                                                        <button
                                                            onClick={() => {
                                                                handleOpenAutomationModal(post, postAutomation)
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
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                gap: 'var(--spacing-sm)',
                                                            }}
                                                        >
                                                            <Settings size={14} />
                                                            Edit
                                                        </button>
                                                        <button
                                                            onClick={() => {
                                                                handleDeleteAutomation(postAutomation.id)
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
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                gap: 'var(--spacing-sm)',
                                                            }}
                                                        >
                                                            <Trash2 size={14} />
                                                            Delete
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </>
                                    ) : (
                                        <button
                                            className="btn btn--secondary"
                                            style={{ padding: '8px 12px', fontSize: 'var(--font-size-sm)' }}
                                            onClick={() => handleOpenAutomationModal(post)}
                                        >
                                            <Plus size={16} />
                                            Add Automation
                                        </button>
                                    )}
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}

            {/* Automation Configuration Modal */}
            <Modal
                isOpen={showAutomationModal}
                onClose={handleCloseModal}
                title={editingAutomation ? 'Edit Automation' : 'New Comment Automation'}
            >
                <div style={{ display: 'flex', flexDirection: 'column', height: '100%', maxHeight: 'calc(80vh - 60px)' }}>
                    {/* Scrollable content */}
                    <div style={{
                        flex: 1,
                        overflowY: 'auto',
                        padding: 'var(--spacing-lg)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 'var(--spacing-lg)'
                    }}>
                        {/* Post preview */}
                        {selectedPost && (
                            <div style={{
                                display: 'flex',
                                gap: 'var(--spacing-md)',
                                padding: 'var(--spacing-md)',
                                background: 'var(--color-bg-secondary)',
                                borderRadius: 'var(--border-radius)',
                                border: '1px solid var(--color-border)'
                            }}>
                                <div style={{ width: 60, height: 60, borderRadius: 'var(--border-radius)', overflow: 'hidden', flexShrink: 0 }}>
                                    <img
                                        src={selectedPost.thumbnail_url || selectedPost.media_url || ''}
                                        alt=""
                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                    />
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>Selected Post</p>
                                    <p style={{
                                        margin: '4px 0 0',
                                        fontSize: 'var(--font-size-xs)',
                                        color: 'var(--color-text-secondary)',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap'
                                    }}>
                                        {selectedPost.caption || 'No caption'}
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Trigger Keywords */}
                        <div className="form-group">
                            <label style={{ fontWeight: 600, marginBottom: 'var(--spacing-xs)', display: 'block' }}>Trigger Keywords</label>
                            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: '0 0 var(--spacing-sm)' }}>
                                When someone comments with these words, the automation triggers. Leave empty to trigger on all comments.
                            </p>
                            <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
                                <input
                                    type="text"
                                    className="input"
                                    placeholder="e.g., INFO, SEND, LINK"
                                    value={keywordInput}
                                    onChange={(e) => setKeywordInput(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault()
                                            handleAddKeyword()
                                        }
                                    }}
                                    style={{ flex: 1 }}
                                />
                                <button className="btn btn--secondary" onClick={handleAddKeyword} style={{ flexShrink: 0 }}>
                                    Add
                                </button>
                            </div>
                            {formData.trigger_keywords && formData.trigger_keywords.length > 0 && (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--spacing-xs)', marginTop: 'var(--spacing-sm)' }}>
                                    {formData.trigger_keywords.map(keyword => (
                                        <span
                                            key={keyword}
                                            style={{
                                                background: '#89b4fa',
                                                border: '2px solid #000',
                                                borderRadius: 'var(--border-radius-sm)',
                                                padding: '4px 10px',
                                                fontSize: 'var(--font-size-xs)',
                                                fontWeight: 600,
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '6px'
                                            }}
                                        >
                                            {keyword}
                                            <button
                                                onClick={() => handleRemoveKeyword(keyword)}
                                                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 1, display: 'flex' }}
                                            >
                                                <X size={14} />
                                            </button>
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Comment Reply Variations */}
                        <div className="form-group">
                            <label style={{ fontWeight: 600, marginBottom: 'var(--spacing-xs)', display: 'block' }}>Comment Reply Variations</label>
                            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: '0 0 var(--spacing-sm)' }}>
                                Add different responses that will be randomly selected when replying to comments. This makes your replies look more natural!
                            </p>
                            <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
                                <input
                                    type="text"
                                    className="input"
                                    placeholder="e.g., Sent! 📩, Check your DMs!, Done!"
                                    value={variationInput}
                                    onChange={(e) => setVariationInput(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault()
                                            handleAddVariation()
                                        }
                                    }}
                                    style={{ flex: 1 }}
                                />
                                <button className="btn btn--secondary" onClick={handleAddVariation} style={{ flexShrink: 0 }}>
                                    Add
                                </button>
                            </div>
                            {formData.comment_reply_variations && formData.comment_reply_variations.length > 0 && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)', marginTop: 'var(--spacing-sm)' }}>
                                    {formData.comment_reply_variations.map((variation, index) => (
                                        <div
                                            key={index}
                                            style={{
                                                background: '#a6e3a1',
                                                border: '2px solid #000',
                                                borderRadius: 'var(--border-radius-sm)',
                                                padding: '8px 12px',
                                                fontSize: 'var(--font-size-sm)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                gap: '8px'
                                            }}
                                        >
                                            <span style={{ fontWeight: 500 }}>{variation}</span>
                                            <button
                                                onClick={() => handleRemoveVariation(variation)}
                                                style={{
                                                    background: 'none',
                                                    border: 'none',
                                                    cursor: 'pointer',
                                                    padding: '4px',
                                                    display: 'flex',
                                                    opacity: 0.7
                                                }}
                                            >
                                                <X size={16} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                            {(!formData.comment_reply_variations || formData.comment_reply_variations.length === 0) && (
                                <p style={{
                                    fontSize: 'var(--font-size-xs)',
                                    color: 'var(--color-text-secondary)',
                                    margin: 'var(--spacing-sm) 0 0',
                                    fontStyle: 'italic'
                                }}>
                                    No variations added yet. Add at least one reply variation.
                                </p>
                            )}
                        </div>

                        {/* DM Message */}
                        <div className="form-group">
                            <label style={{ fontWeight: 600, marginBottom: 'var(--spacing-xs)', display: 'block' }}>DM Message</label>
                            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: '0 0 var(--spacing-sm)' }}>
                                The message to send via DM after replying to the comment
                            </p>
                            <textarea
                                className="input textarea"
                                rows={3}
                                placeholder="Hey! Thanks for your interest. Here's what you requested..."
                                value={formData.dm_message || ''}
                                onChange={(e) => setFormData(prev => ({ ...prev, dm_message: e.target.value }))}
                                style={{ resize: 'vertical', minHeight: '80px' }}
                            />
                        </div>
                    </div>

                    {/* Fixed footer with actions */}
                    <div style={{
                        borderTop: '2px solid #000',
                        padding: 'var(--spacing-md) var(--spacing-lg)',
                        display: 'flex',
                        gap: 'var(--spacing-md)',
                        justifyContent: 'flex-end',
                        background: 'var(--color-bg)',
                        flexShrink: 0
                    }}>
                        <button className="btn btn--secondary" onClick={handleCloseModal}>
                            Cancel
                        </button>
                        <button
                            className="btn btn--primary"
                            onClick={handleSaveAutomation}
                            disabled={saving || (formData.comment_reply_variations?.length || 0) === 0}
                        >
                            {saving ? 'Saving...' : (editingAutomation ? 'Save Changes' : 'Create Automation')}
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    )
}

export default Comments
