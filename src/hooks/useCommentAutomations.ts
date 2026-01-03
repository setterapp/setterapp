import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export interface CommentAutomation {
  id: string
  user_id: string
  post_id: string | null
  name: string
  is_active: boolean

  // Trigger settings
  trigger_keywords: string[]
  trigger_type: 'contains' | 'exact' | 'any'

  // Response settings
  response_type: 'ai' | 'manual'
  comment_reply: string | null
  comment_reply_variations: string[]
  dm_message: string | null
  dm_delay_seconds: number

  // AI settings
  agent_id: string | null

  // Stats
  triggers_count: number
  last_triggered_at: string | null

  created_at: string
  updated_at: string

  // Joined data
  post?: {
    id: string
    post_id: string
    permalink: string | null
    media_url: string | null
    thumbnail_url: string | null
    caption: string | null
  }
  agent?: {
    id: string
    name: string
  }
}

export interface CreateCommentAutomationData {
  post_id?: string | null
  name: string
  is_active?: boolean
  trigger_keywords?: string[]
  trigger_type?: 'contains' | 'exact' | 'any'
  response_type?: 'ai' | 'manual'
  comment_reply?: string | null
  comment_reply_variations?: string[]
  dm_message?: string | null
  dm_delay_seconds?: number
  agent_id?: string | null
}

export function useCommentAutomations(postId?: string) {
  const [automations, setAutomations] = useState<CommentAutomation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchAutomations = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) {
        setLoading(false)
        return
      }

      let query = supabase
        .from('comment_automations')
        .select(`
          *,
          post:instagram_posts(id, post_id, permalink, media_url, thumbnail_url, caption),
          agent:agents(id, name)
        `)
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })

      if (postId) {
        query = query.eq('post_id', postId)
      }

      const { data, error: fetchError } = await query

      if (fetchError) throw fetchError

      setAutomations(data || [])
    } catch (err: any) {
      console.error('Error fetching automations:', err)
      setError(err.message || 'Error fetching automations')
    } finally {
      setLoading(false)
    }
  }, [postId])

  const createAutomation = useCallback(async (automationData: CreateCommentAutomationData) => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) throw new Error('Not authenticated')

      const { data, error: createError } = await supabase
        .from('comment_automations')
        .insert({
          user_id: session.user.id,
          ...automationData
        })
        .select(`
          *,
          post:instagram_posts(id, post_id, permalink, media_url, thumbnail_url, caption),
          agent:agents(id, name)
        `)
        .single()

      if (createError) throw createError

      setAutomations(prev => [data, ...prev])
      return data
    } catch (err: any) {
      console.error('Error creating automation:', err)
      throw err
    }
  }, [])

  const updateAutomation = useCallback(async (id: string, updates: Partial<CreateCommentAutomationData>) => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) throw new Error('Not authenticated')

      const { data, error: updateError } = await supabase
        .from('comment_automations')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .eq('user_id', session.user.id)
        .select(`
          *,
          post:instagram_posts(id, post_id, permalink, media_url, thumbnail_url, caption),
          agent:agents(id, name)
        `)
        .single()

      if (updateError) throw updateError

      setAutomations(prev => prev.map(a => a.id === id ? data : a))
      return data
    } catch (err: any) {
      console.error('Error updating automation:', err)
      throw err
    }
  }, [])

  const deleteAutomation = useCallback(async (id: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) throw new Error('Not authenticated')

      const { error: deleteError } = await supabase
        .from('comment_automations')
        .delete()
        .eq('id', id)
        .eq('user_id', session.user.id)

      if (deleteError) throw deleteError

      setAutomations(prev => prev.filter(a => a.id !== id))
    } catch (err: any) {
      console.error('Error deleting automation:', err)
      throw err
    }
  }, [])

  const toggleAutomation = useCallback(async (id: string, isActive: boolean) => {
    return updateAutomation(id, { is_active: isActive })
  }, [updateAutomation])

  useEffect(() => {
    fetchAutomations()
  }, [fetchAutomations])

  return {
    automations,
    loading,
    error,
    createAutomation,
    updateAutomation,
    deleteAutomation,
    toggleAutomation,
    refetch: fetchAutomations
  }
}
