import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export interface InstagramPost {
  id: string
  user_id: string
  post_id: string
  permalink: string | null
  media_type: string | null
  media_url: string | null
  thumbnail_url: string | null
  caption: string | null
  timestamp: string | null
  comments_count: number
  created_at: string
  updated_at: string
  // Joined data
  automations_count?: number
}

export function useInstagramPosts() {
  const [posts, setPosts] = useState<InstagramPost[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchPosts = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) {
        setLoading(false)
        return
      }

      // Fetch posts with automation count
      const { data, error: fetchError } = await supabase
        .from('instagram_posts')
        .select(`
          *,
          comment_automations(count)
        `)
        .eq('user_id', session.user.id)
        .order('timestamp', { ascending: false })

      if (fetchError) throw fetchError

      const postsWithCount = (data || []).map(post => ({
        ...post,
        automations_count: post.comment_automations?.[0]?.count || 0
      }))

      setPosts(postsWithCount)
    } catch (err: any) {
      console.error('Error fetching posts:', err)
      setError(err.message || 'Error fetching posts')
    } finally {
      setLoading(false)
    }
  }, [])

  const syncPosts = useCallback(async () => {
    try {
      setSyncing(true)
      setError(null)

      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) return

      // Get Instagram integration
      const { data: integration } = await supabase
        .from('integrations')
        .select('config')
        .eq('user_id', session.user.id)
        .eq('type', 'instagram')
        .eq('status', 'connected')
        .single()

      if (!integration?.config?.access_token || !integration?.config?.instagram_user_id) {
        throw new Error('Instagram not connected')
      }

      const accessToken = integration.config.access_token
      const instagramUserId = integration.config.instagram_user_id

      // Fetch media from Instagram Graph API (including comments_count)
      const response = await fetch(
        `https://graph.instagram.com/v24.0/${instagramUserId}/media?fields=id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,comments_count&limit=50&access_token=${accessToken}`
      )

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error?.message || 'Failed to fetch posts from Instagram')
      }

      const data = await response.json()
      const igPosts = data.data || []

      // Upsert posts to database
      for (const post of igPosts) {
        await supabase
          .from('instagram_posts')
          .upsert({
            user_id: session.user.id,
            post_id: post.id,
            permalink: post.permalink,
            media_type: post.media_type,
            media_url: post.media_url,
            thumbnail_url: post.thumbnail_url,
            caption: post.caption,
            timestamp: post.timestamp,
            comments_count: post.comments_count || 0,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'user_id,post_id'
          })
      }

      // Refresh the posts list
      await fetchPosts()
    } catch (err: any) {
      console.error('Error syncing posts:', err)
      setError(err.message || 'Error syncing posts')
    } finally {
      setSyncing(false)
    }
  }, [fetchPosts])

  useEffect(() => {
    fetchPosts()
  }, [fetchPosts])

  return {
    posts,
    loading,
    syncing,
    error,
    syncPosts,
    refetch: fetchPosts
  }
}
