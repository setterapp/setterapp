import { useState, useEffect, useCallback, useRef } from 'react'
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

// Module-level cache to persist data between navigations
let cachedPosts: InstagramPost[] | null = null

export function useInstagramPosts() {
  const [posts, setPosts] = useState<InstagramPost[]>(cachedPosts || [])
  const [loading, setLoading] = useState(!cachedPosts)
  const [error, setError] = useState<string | null>(null)
  const activeFetchIdRef = useRef(0)
  const hasSyncedRef = useRef(false)

  const fetchPosts = useCallback(async () => {
    const fetchId = ++activeFetchIdRef.current
    try {
      // Only show loading if no cache
      if (!cachedPosts) {
        setLoading(true)
      }
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
      if (fetchId !== activeFetchIdRef.current) return

      const postsWithCount = (data || []).map(post => ({
        ...post,
        automations_count: post.comment_automations?.[0]?.count || 0
      }))

      // Update state and cache
      cachedPosts = postsWithCount
      setPosts(postsWithCount)
    } catch (err: any) {
      if (fetchId !== activeFetchIdRef.current) return
      console.error('Error fetching posts:', err)
      setError(err.message || 'Error fetching posts')
    } finally {
      if (fetchId === activeFetchIdRef.current) setLoading(false)
    }
  }, [])

  const syncFromInstagram = useCallback(async () => {
    try {
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
        return // Silently fail if not connected
      }

      const accessToken = integration.config.access_token
      const instagramUserId = integration.config.instagram_user_id

      // Fetch media from Instagram Graph API (including comments_count)
      const response = await fetch(
        `https://graph.instagram.com/v24.0/${instagramUserId}/media?fields=id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,comments_count&limit=50&access_token=${accessToken}`
      )

      if (!response.ok) {
        console.error('Failed to sync from Instagram')
        return
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

      // Refresh the posts list (silently updates UI)
      await fetchPosts()
    } catch (err: any) {
      console.error('Error syncing posts:', err)
    }
  }, [fetchPosts])

  useEffect(() => {
    const start = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        setLoading(false)
        return
      }

      // Load from DB first (fast, uses cache)
      await fetchPosts()

      // Then sync from Instagram in background (only once per session)
      if (!hasSyncedRef.current) {
        hasSyncedRef.current = true
        syncFromInstagram()
      }
    }

    start()
  }, [fetchPosts, syncFromInstagram])

  return {
    posts,
    loading,
    error,
    refetch: fetchPosts
  }
}
