import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export interface KnowledgeBase {
  id: string
  user_id: string
  agent_id: string | null
  name: string
  content: string
  file_type: string
  file_size: number
  created_at: string
  updated_at: string
}

export function useKnowledgeBases(agentId?: string) {
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchKnowledgeBases = async () => {
    try {
      setLoading(true)
      setError(null)

      let query = supabase
        .from('knowledge_bases')
        .select('*')
        .order('created_at', { ascending: false })

      if (agentId) {
        query = query.eq('agent_id', agentId)
      }

      const { data, error: fetchError } = await query

      if (fetchError) throw fetchError
      setKnowledgeBases(data || [])
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchKnowledgeBases()
  }, [agentId])

  const createKnowledgeBase = async (kb: Omit<KnowledgeBase, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) throw new Error('User not authenticated')

      const { data, error: insertError } = await supabase
        .from('knowledge_bases')
        .insert({
          user_id: session.user.id,
          agent_id: kb.agent_id,
          name: kb.name,
          content: kb.content,
          file_type: kb.file_type || 'text',
          file_size: kb.file_size || kb.content.length,
        })
        .select()
        .single()

      if (insertError) throw insertError
      if (data) {
        setKnowledgeBases((prev) => [data, ...prev])
      }
      return data
    } catch (err: any) {
      setError(err.message)
      throw err
    }
  }

  const updateKnowledgeBase = async (id: string, updates: Partial<KnowledgeBase>) => {
    try {
      const { data, error: updateError } = await supabase
        .from('knowledge_bases')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (updateError) throw updateError
      if (data) {
        setKnowledgeBases((prev) => prev.map((kb) => (kb.id === id ? data : kb)))
      }
      return data
    } catch (err: any) {
      setError(err.message)
      throw err
    }
  }

  const deleteKnowledgeBase = async (id: string) => {
    try {
      const { error: deleteError } = await supabase
        .from('knowledge_bases')
        .delete()
        .eq('id', id)

      if (deleteError) throw deleteError
      setKnowledgeBases((prev) => prev.filter((kb) => kb.id !== id))
    } catch (err: any) {
      setError(err.message)
      throw err
    }
  }

  return {
    knowledgeBases,
    loading,
    error,
    createKnowledgeBase,
    updateKnowledgeBase,
    deleteKnowledgeBase,
    refetch: fetchKnowledgeBases,
  }
}
