import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

// Admin emails that bypass subscription checks
const ADMIN_EMAILS = ['info@setterapp.ai', 'reviewer@setterapp.ai']

export type SubscriptionPlan = 'starter' | 'growth' | 'premium'
export type SubscriptionStatus = 'active' | 'canceled' | 'past_due' | 'trialing' | 'inactive'

export interface Subscription {
  id: string
  user_id: string
  stripe_customer_id: string
  stripe_subscription_id: string | null
  stripe_price_id: string | null
  status: SubscriptionStatus
  plan: SubscriptionPlan
  current_period_start: string | null
  current_period_end: string | null
  cancel_at_period_end: boolean
  canceled_at: string | null
  messages_used: number
  messages_reset_at: string | null
  created_at: string
  updated_at: string
}

export interface PlanLimits {
  agents: number
  messages: number
  knowledgeBases: number
}

export const PLAN_LIMITS: Record<SubscriptionPlan, PlanLimits> = {
  starter: { agents: 1, messages: 2000, knowledgeBases: 1 },
  growth: { agents: 3, messages: 10000, knowledgeBases: 3 },
  premium: { agents: 10, messages: Infinity, knowledgeBases: 10 },
}

export function useSubscription() {
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [userEmail, setUserEmail] = useState<string | null>(null)

  const fetchSubscription = async () => {
    try {
      setLoading(true)
      setError(null)

      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        setSubscription(null)
        setUserEmail(null)
        return
      }

      setUserEmail(session.user.email || null)

      const { data, error: fetchError } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', session.user.id)
        .maybeSingle()

      if (fetchError) {
        throw fetchError
      }

      setSubscription(data || null)
    } catch (err: any) {
      setError(err.message)
      setSubscription(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSubscription()

    // Listen for auth changes
    const { data: { subscription: authSub } } = supabase.auth.onAuthStateChange(() => {
      fetchSubscription()
    })

    return () => {
      authSub.unsubscribe()
    }
  }, [])

  // Check if user is admin
  const isAdmin = userEmail ? ADMIN_EMAILS.includes(userEmail.toLowerCase()) : false

  // Check if subscription is active
  const isActive = subscription?.status === 'active' || subscription?.status === 'trialing'

  // Check if subscription is expiring soon (cancelled but still active)
  const isExpiring = subscription?.cancel_at_period_end === true && isActive

  // Check if user has access (admin, active subscription, or within grace period)
  const hasAccess = isAdmin || isActive || (
    subscription?.status === 'canceled' &&
    subscription?.current_period_end &&
    new Date(subscription.current_period_end) > new Date()
  )

  // Get current plan limits (admins get premium limits)
  const limits = isAdmin ? PLAN_LIMITS.premium : (subscription?.plan ? PLAN_LIMITS[subscription.plan] : null)

  // Create checkout session
  const createCheckout = async (plan: SubscriptionPlan) => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')

      const response = await supabase.functions.invoke('stripe-checkout', {
        body: {
          plan,
          success_url: `${window.location.origin}/dashboard?success=true`,
          cancel_url: `${window.location.origin}/pricing?canceled=true`,
        },
      })

      if (response.error) throw response.error
      if (response.data?.url) {
        window.location.href = response.data.url
      }
    } catch (err: any) {
      setError(err.message)
      throw err
    }
  }

  // Open customer portal
  const openPortal = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')

      const response = await supabase.functions.invoke('stripe-portal', {
        body: {
          return_url: `${window.location.origin}/dashboard`,
        },
      })

      if (response.error) throw response.error
      if (response.data?.url) {
        window.location.href = response.data.url
      }
    } catch (err: any) {
      setError(err.message)
      throw err
    }
  }

  // Get messages used (admins always show 0 usage)
  const messagesUsed = isAdmin ? 0 : (subscription?.messages_used || 0)
  const messagesLimit = limits?.messages || 0

  return {
    subscription,
    loading,
    error,
    isAdmin,
    isActive,
    isExpiring,
    hasAccess,
    limits,
    plan: isAdmin ? 'premium' as SubscriptionPlan : (subscription?.plan || null),
    messagesUsed,
    messagesLimit,
    createCheckout,
    openPortal,
    refetch: fetchSubscription,
  }
}
