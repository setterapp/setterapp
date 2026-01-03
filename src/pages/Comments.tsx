import { useState } from 'react'
import { MessageCircle, RefreshCw, Plus, Settings, Zap, Image, Video, Layers, MoreVertical, Trash2 } from 'lucide-react'
import SectionHeader from '../components/SectionHeader'
import Modal from '../components/common/Modal'
import { Switch } from '../components/ui/switch'
import { useInstagramPosts, type InstagramPost } from '../hooks/useInstagramPosts'
import { useCommentAutomations, type CommentAutomation, type CreateCommentAutomationData } from '../hooks/useCommentAutomations'
import { useAgents } from '../hooks/useAgents'
import { useIntegrations } from '../hooks/useIntegrations'
import InstagramIcon from '../components/icons/InstagramIcon'

function Comments() {
  const { posts, loading: postsLoading, syncing, error: postsError, syncPosts } = useInstagramPosts()
  const { automations, loading: automationsLoading, createAutomation, updateAutomation, deleteAutomation, toggleAutomation, refetch: refetchAutomations } = useCommentAutomations()
  const { agents } = useAgents()
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

  const instagramConnected = integrations.some(i => i.type === 'instagram' && i.status === 'connected')
  const instagramAgent = agents.find(a => a.platform === 'instagram')

  const loading = postsLoading || automationsLoading

  const handleOpenAutomationModal = (post: InstagramPost, automation?: CommentAutomation) => {
    setSelectedPost(post)
    if (automation) {
      setEditingAutomation(automation)
      setFormData({
        post_id: automation.post_id,
        name: automation.name,
        trigger_keywords: automation.trigger_keywords || [],
        trigger_type: automation.trigger_type,
        response_type: automation.response_type,
        comment_reply: automation.comment_reply || '',
        comment_reply_variations: automation.comment_reply_variations || [],
        dm_message: automation.dm_message || '',
        dm_delay_seconds: automation.dm_delay_seconds || 0,
        agent_id: automation.agent_id
      })
    } else {
      setEditingAutomation(null)
      setFormData({
        post_id: post.id,
        name: `Automation for ${post.caption?.substring(0, 30) || 'post'}...`,
        trigger_keywords: [],
        trigger_type: 'contains',
        response_type: 'manual',
        comment_reply: 'Sent! Check your DMs',
        comment_reply_variations: ['Done! Check your inbox', 'Sent to your DMs!'],
        dm_message: 'Hey! Thanks for your interest. Here\'s what you requested...',
        dm_delay_seconds: 0,
        agent_id: instagramAgent?.id || null
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

  const getMediaIcon = (mediaType: string | null) => {
    switch (mediaType) {
      case 'VIDEO':
        return <Video size={14} />
      case 'CAROUSEL_ALBUM':
        return <Layers size={14} />
      default:
        return <Image size={14} />
    }
  }

  const getPostAutomations = (postId: string) => {
    return automations.filter(a => a.post_id === postId)
  }

  if (!instagramConnected) {
    return (
      <div>
        <SectionHeader title="Comments" icon={<MessageCircle size={24} />} />
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
      <SectionHeader title="Comments" icon={<MessageCircle size={24} />}>
        <button
          className="btn btn--secondary"
          onClick={syncPosts}
          disabled={syncing}
        >
          <RefreshCw size={18} className={syncing ? 'spinning' : ''} />
          {syncing ? 'Syncing...' : 'Sync Posts'}
        </button>
      </SectionHeader>

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
            <button className="btn btn--primary" onClick={syncPosts} style={{ marginTop: 'var(--spacing-md)' }}>
              Try Again
            </button>
          </div>
        </div>
      ) : posts.length === 0 ? (
        <div className="card" style={{ border: '2px solid #000' }}>
          <div className="empty-state">
            <MessageCircle size={48} style={{ opacity: 0.5 }} />
            <h3>No posts yet</h3>
            <p>Sync your Instagram posts to set up comment automations</p>
            <button className="btn btn--primary" onClick={syncPosts} style={{ marginTop: 'var(--spacing-md)' }}>
              <RefreshCw size={18} />
              Sync Posts
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 'var(--spacing-md)' }}>
          {posts.map(post => {
            const postAutomations = getPostAutomations(post.id)
            const hasActiveAutomation = postAutomations.some(a => a.is_active)

            return (
              <div
                key={post.id}
                className="card"
                style={{
                  border: '2px solid #000',
                  padding: 0,
                  overflow: 'hidden',
                  cursor: 'pointer',
                  transition: 'var(--transition)',
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
                {/* Post Image */}
                <div
                  style={{
                    position: 'relative',
                    backgroundColor: 'var(--color-bg-secondary)',
                    overflow: 'hidden'
                  }}
                  onClick={() => handleOpenAutomationModal(post)}
                >
                  {(post.media_url || post.thumbnail_url) ? (
                    <img
                      src={post.thumbnail_url || post.media_url || ''}
                      alt={post.caption || 'Instagram post'}
                      style={{
                        width: '100%',
                        height: 'auto',
                        display: 'block'
                      }}
                    />
                  ) : (
                    <div style={{
                      width: '100%',
                      height: '200px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <InstagramIcon size={48} color="#ccc" />
                    </div>
                  )}

                  {/* Media type badge */}
                  <div style={{
                    position: 'absolute',
                    top: 'var(--spacing-sm)',
                    left: 'var(--spacing-sm)',
                    background: 'rgba(0,0,0,0.7)',
                    color: '#fff',
                    padding: '4px 8px',
                    borderRadius: 'var(--border-radius-sm)',
                    fontSize: 'var(--font-size-xs)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}>
                    {getMediaIcon(post.media_type)}
                    {post.media_type || 'IMAGE'}
                  </div>

                  {/* Active automation indicator */}
                  {hasActiveAutomation && (
                    <div style={{
                      position: 'absolute',
                      top: 'var(--spacing-sm)',
                      right: 'var(--spacing-sm)',
                      background: '#a6e3a1',
                      color: '#000',
                      padding: '4px 8px',
                      borderRadius: 'var(--border-radius-sm)',
                      fontSize: 'var(--font-size-xs)',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      border: '2px solid #000'
                    }}>
                      <Zap size={12} />
                      Active
                    </div>
                  )}
                </div>

                {/* Post Info */}
                <div style={{ padding: 'var(--spacing-md)' }}>
                  <p style={{
                    margin: 0,
                    fontSize: 'var(--font-size-sm)',
                    color: 'var(--color-text)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    {post.caption || 'No caption'}
                  </p>

                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginTop: 'var(--spacing-sm)'
                  }}>
                    <span style={{
                      fontSize: 'var(--font-size-xs)',
                      color: 'var(--color-text-secondary)'
                    }}>
                      {postAutomations.length} automation{postAutomations.length !== 1 ? 's' : ''}
                    </span>

                    <button
                      className="btn btn--secondary"
                      style={{ padding: '4px 8px', fontSize: 'var(--font-size-xs)' }}
                      onClick={(e) => {
                        e.stopPropagation()
                        handleOpenAutomationModal(post)
                      }}
                    >
                      <Plus size={14} />
                      Add
                    </button>
                  </div>

                  {/* Automations list */}
                  {postAutomations.length > 0 && (
                    <div style={{ marginTop: 'var(--spacing-sm)', borderTop: '1px solid var(--color-border)', paddingTop: 'var(--spacing-sm)' }}>
                      {postAutomations.slice(0, 2).map(automation => (
                        <div
                          key={automation.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: 'var(--spacing-xs) 0',
                            fontSize: 'var(--font-size-xs)'
                          }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)', flex: 1, minWidth: 0 }}>
                            <span style={{
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}>
                              {automation.trigger_keywords?.length > 0
                                ? automation.trigger_keywords.join(', ')
                                : 'Any comment'}
                            </span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)' }}>
                            <Switch
                              checked={automation.is_active}
                              onCheckedChange={(checked) => toggleAutomation(automation.id, checked)}
                            />
                            <div style={{ position: 'relative' }}>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setOpenMenuId(openMenuId === automation.id ? null : automation.id)
                                }}
                                style={{
                                  background: 'transparent',
                                  border: 'none',
                                  cursor: 'pointer',
                                  padding: '2px',
                                  color: 'var(--color-text-secondary)'
                                }}
                              >
                                <MoreVertical size={14} />
                              </button>
                              {openMenuId === automation.id && (
                                <div
                                  style={{
                                    position: 'absolute',
                                    right: 0,
                                    top: '100%',
                                    background: 'var(--color-bg)',
                                    border: '1px solid var(--color-border)',
                                    borderRadius: 'var(--border-radius)',
                                    boxShadow: 'var(--shadow-md)',
                                    zIndex: 100,
                                    minWidth: '120px'
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <button
                                    onClick={() => {
                                      handleOpenAutomationModal(post, automation)
                                      setOpenMenuId(null)
                                    }}
                                    style={{
                                      width: '100%',
                                      textAlign: 'left',
                                      padding: 'var(--spacing-sm)',
                                      background: 'transparent',
                                      border: 'none',
                                      cursor: 'pointer',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: 'var(--spacing-sm)'
                                    }}
                                  >
                                    <Settings size={14} />
                                    Edit
                                  </button>
                                  <button
                                    onClick={() => {
                                      handleDeleteAutomation(automation.id)
                                      setOpenMenuId(null)
                                    }}
                                    style={{
                                      width: '100%',
                                      textAlign: 'left',
                                      padding: 'var(--spacing-sm)',
                                      background: 'transparent',
                                      border: 'none',
                                      cursor: 'pointer',
                                      color: 'var(--color-danger)',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: 'var(--spacing-sm)'
                                    }}
                                  >
                                    <Trash2 size={14} />
                                    Delete
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                      {postAutomations.length > 2 && (
                        <button
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--color-primary)',
                            fontSize: 'var(--font-size-xs)',
                            cursor: 'pointer',
                            padding: 'var(--spacing-xs) 0'
                          }}
                          onClick={(e) => {
                            e.stopPropagation()
                            handleOpenAutomationModal(post)
                          }}
                        >
                          +{postAutomations.length - 2} more
                        </button>
                      )}
                    </div>
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
        <div style={{ padding: 'var(--spacing-lg)', display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
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
            <label>Trigger Keywords</label>
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
              />
              <button className="btn btn--secondary" onClick={handleAddKeyword}>
                Add
              </button>
            </div>
            {formData.trigger_keywords && formData.trigger_keywords.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--spacing-xs)', marginTop: 'var(--spacing-sm)' }}>
                {formData.trigger_keywords.map(keyword => (
                  <span
                    key={keyword}
                    style={{
                      background: 'var(--color-primary-light)',
                      border: '1px solid var(--color-primary)',
                      borderRadius: 'var(--border-radius-sm)',
                      padding: '2px 8px',
                      fontSize: 'var(--font-size-xs)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    {keyword}
                    <button
                      onClick={() => handleRemoveKeyword(keyword)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 1 }}
                    >
                      &times;
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Response Type */}
          <div className="form-group">
            <label>Response Type</label>
            <div style={{ display: 'flex', gap: 'var(--spacing-md)' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)', cursor: 'pointer' }}>
                <input
                  type="radio"
                  checked={formData.response_type === 'manual'}
                  onChange={() => setFormData(prev => ({ ...prev, response_type: 'manual' }))}
                />
                <span>Manual Response</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)', cursor: 'pointer' }}>
                <input
                  type="radio"
                  checked={formData.response_type === 'ai'}
                  onChange={() => setFormData(prev => ({ ...prev, response_type: 'ai', agent_id: instagramAgent?.id || null }))}
                />
                <span>AI Response</span>
              </label>
            </div>
          </div>

          {/* Comment Reply */}
          <div className="form-group">
            <label>Comment Reply</label>
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: '0 0 var(--spacing-sm)' }}>
              Reply to the comment on the post (e.g., "Sent!" or "Check your DMs!")
            </p>
            <input
              type="text"
              className="input"
              placeholder="Sent! Check your DMs"
              value={formData.comment_reply || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, comment_reply: e.target.value }))}
            />
          </div>

          {/* DM Message */}
          <div className="form-group">
            <label>DM Message</label>
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: '0 0 var(--spacing-sm)' }}>
              The message to send via DM after replying to the comment
            </p>
            {formData.response_type === 'manual' ? (
              <textarea
                className="input textarea"
                rows={4}
                placeholder="Hey! Thanks for your interest. Here's what you requested..."
                value={formData.dm_message || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, dm_message: e.target.value }))}
              />
            ) : (
              <div style={{
                padding: 'var(--spacing-md)',
                background: 'var(--color-bg-secondary)',
                borderRadius: 'var(--border-radius)',
                border: '1px solid var(--color-border)'
              }}>
                <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>
                  AI Agent: {instagramAgent?.name || 'No agent assigned'}
                </p>
                <p style={{ margin: '4px 0 0', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                  The AI will start a conversation based on its configuration
                </p>
              </div>
            )}
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 'var(--spacing-md)', justifyContent: 'flex-end', marginTop: 'var(--spacing-md)' }}>
            <button className="btn btn--secondary" onClick={handleCloseModal}>
              Cancel
            </button>
            <button
              className="btn btn--primary"
              onClick={handleSaveAutomation}
              disabled={saving}
            >
              {saving ? 'Saving...' : (editingAutomation ? 'Save Changes' : 'Create Automation')}
            </button>
          </div>
        </div>
      </Modal>

      {/* Add spinning animation */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .spinning {
          animation: spin 1s linear infinite;
        }
      `}</style>
    </div>
  )
}

export default Comments
