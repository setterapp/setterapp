import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { PLAN_LIMITS, type SubscriptionPlan } from './useSubscription'

export type TeamRole = 'owner' | 'admin' | 'member'

export interface Team {
  id: string
  name: string
  owner_id: string
  created_at: string
  updated_at: string
}

export interface TeamMember {
  id: string
  team_id: string
  user_id: string
  role: TeamRole
  joined_at: string
  user?: {
    email: string
    raw_user_meta_data?: {
      name?: string
    }
  }
}

export interface TeamInvitation {
  id: string
  team_id: string
  email: string
  role: TeamRole
  token: string
  invited_by: string
  expires_at: string
  accepted_at: string | null
  created_at: string
}

export function useTeam() {
  const [team, setTeam] = useState<Team | null>(null)
  const [members, setMembers] = useState<TeamMember[]>([])
  const [invitations, setInvitations] = useState<TeamInvitation[]>([])
  const [userRole, setUserRole] = useState<TeamRole | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchTeam = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) {
        setTeam(null)
        setMembers([])
        setUserRole(null)
        setLoading(false)
        return
      }

      // Get user's team membership
      const { data: membership, error: membershipError } = await supabase
        .from('team_members')
        .select('team_id, role')
        .eq('user_id', session.user.id)
        .maybeSingle()

      if (membershipError) throw membershipError

      if (!membership) {
        // User has no team - they need to create one or be invited
        setTeam(null)
        setMembers([])
        setUserRole(null)
        setLoading(false)
        return
      }

      setUserRole(membership.role as TeamRole)

      // Fetch team details
      const { data: teamData, error: teamError } = await supabase
        .from('teams')
        .select('*')
        .eq('id', membership.team_id)
        .single()

      if (teamError) throw teamError
      setTeam(teamData)

      // Fetch all team members with user info
      const { data: membersData, error: membersError } = await supabase
        .from('team_members')
        .select('*')
        .eq('team_id', membership.team_id)
        .order('role', { ascending: true })

      if (membersError) throw membersError

      // Fetch user emails for each member
      const membersWithUsers = await Promise.all(
        (membersData || []).map(async (member) => {
          const { data: userData } = await supabase.auth.admin.getUserById(member.user_id).catch(() => ({ data: null }))
          return {
            ...member,
            user: userData?.user ? {
              email: userData.user.email || '',
              raw_user_meta_data: userData.user.user_metadata
            } : undefined
          }
        })
      )

      setMembers(membersWithUsers)

      // Fetch pending invitations (only if owner/admin)
      if (membership.role === 'owner' || membership.role === 'admin') {
        const { data: invitationsData } = await supabase
          .from('team_invitations')
          .select('*')
          .eq('team_id', membership.team_id)
          .is('accepted_at', null)
          .gt('expires_at', new Date().toISOString())
          .order('created_at', { ascending: false })

        setInvitations(invitationsData || [])
      }

    } catch (err: any) {
      console.error('Error fetching team:', err)
      setError(err.message || 'Error loading team')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchTeam()
  }, [fetchTeam])

  // Create a new team (for users without one)
  const createTeam = async (name: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) throw new Error('Not authenticated')

      // Create team
      const { data: newTeam, error: teamError } = await supabase
        .from('teams')
        .insert({
          name,
          owner_id: session.user.id
        })
        .select()
        .single()

      if (teamError) throw teamError

      // Add owner as team member
      const { error: memberError } = await supabase
        .from('team_members')
        .insert({
          team_id: newTeam.id,
          user_id: session.user.id,
          role: 'owner'
        })

      if (memberError) throw memberError

      await fetchTeam()
      return newTeam
    } catch (err: any) {
      console.error('Error creating team:', err)
      throw err
    }
  }

  // Invite a new team member
  const inviteMember = async (email: string, role: 'admin' | 'member', plan: SubscriptionPlan) => {
    try {
      if (!team) throw new Error('No team found')
      if (userRole !== 'owner' && userRole !== 'admin') {
        throw new Error('Only team owners and admins can invite members')
      }

      // Check team member limit
      const limit = PLAN_LIMITS[plan].teamMembers
      const currentCount = members.length + invitations.length
      if (currentCount >= limit) {
        throw new Error(`You have reached the limit of ${limit} team member${limit > 1 ? 's' : ''} for your ${plan} plan. Upgrade to add more team members.`)
      }

      // Generate invitation token
      const token = crypto.randomUUID()

      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) throw new Error('Not authenticated')

      const { data: invitation, error: inviteError } = await supabase
        .from('team_invitations')
        .insert({
          team_id: team.id,
          email: email.toLowerCase(),
          role,
          token,
          invited_by: session.user.id,
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days
        })
        .select()
        .single()

      if (inviteError) {
        if (inviteError.code === '23505') { // Unique violation
          throw new Error('This email has already been invited')
        }
        throw inviteError
      }

      // TODO: Send invitation email
      // For now, we'll just show the invite link in the UI

      await fetchTeam()
      return invitation
    } catch (err: any) {
      console.error('Error inviting member:', err)
      throw err
    }
  }

  // Accept an invitation
  const acceptInvitation = async (token: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) throw new Error('Not authenticated')

      // Find invitation
      const { data: invitation, error: findError } = await supabase
        .from('team_invitations')
        .select('*')
        .eq('token', token)
        .is('accepted_at', null)
        .gt('expires_at', new Date().toISOString())
        .single()

      if (findError || !invitation) {
        throw new Error('Invalid or expired invitation')
      }

      // Check if email matches
      if (invitation.email.toLowerCase() !== session.user.email?.toLowerCase()) {
        throw new Error('This invitation was sent to a different email address')
      }

      // Check if user is already in a team
      const { data: existingMembership } = await supabase
        .from('team_members')
        .select('id')
        .eq('user_id', session.user.id)
        .maybeSingle()

      if (existingMembership) {
        throw new Error('You are already a member of a team')
      }

      // Add user to team
      const { error: memberError } = await supabase
        .from('team_members')
        .insert({
          team_id: invitation.team_id,
          user_id: session.user.id,
          role: invitation.role,
          invited_by: invitation.invited_by
        })

      if (memberError) throw memberError

      // Mark invitation as accepted
      await supabase
        .from('team_invitations')
        .update({ accepted_at: new Date().toISOString() })
        .eq('id', invitation.id)

      await fetchTeam()
      return true
    } catch (err: any) {
      console.error('Error accepting invitation:', err)
      throw err
    }
  }

  // Remove a team member
  const removeMember = async (memberId: string) => {
    try {
      if (!team) throw new Error('No team found')
      if (userRole !== 'owner' && userRole !== 'admin') {
        throw new Error('Only team owners and admins can remove members')
      }

      const memberToRemove = members.find(m => m.id === memberId)
      if (!memberToRemove) throw new Error('Member not found')

      // Can't remove the owner
      if (memberToRemove.role === 'owner') {
        throw new Error('Cannot remove the team owner')
      }

      // Admins can't remove other admins
      if (userRole === 'admin' && memberToRemove.role === 'admin') {
        throw new Error('Admins cannot remove other admins')
      }

      const { error } = await supabase
        .from('team_members')
        .delete()
        .eq('id', memberId)

      if (error) throw error

      await fetchTeam()
    } catch (err: any) {
      console.error('Error removing member:', err)
      throw err
    }
  }

  // Change a member's role
  const changeMemberRole = async (memberId: string, newRole: 'admin' | 'member') => {
    try {
      if (!team) throw new Error('No team found')
      if (userRole !== 'owner') {
        throw new Error('Only the team owner can change roles')
      }

      const memberToUpdate = members.find(m => m.id === memberId)
      if (!memberToUpdate) throw new Error('Member not found')

      // Can't change owner's role
      if (memberToUpdate.role === 'owner') {
        throw new Error('Cannot change the owner role')
      }

      const { error } = await supabase
        .from('team_members')
        .update({ role: newRole })
        .eq('id', memberId)

      if (error) throw error

      await fetchTeam()
    } catch (err: any) {
      console.error('Error changing role:', err)
      throw err
    }
  }

  // Cancel a pending invitation
  const cancelInvitation = async (invitationId: string) => {
    try {
      if (!team) throw new Error('No team found')
      if (userRole !== 'owner' && userRole !== 'admin') {
        throw new Error('Only team owners and admins can cancel invitations')
      }

      const { error } = await supabase
        .from('team_invitations')
        .delete()
        .eq('id', invitationId)

      if (error) throw error

      await fetchTeam()
    } catch (err: any) {
      console.error('Error canceling invitation:', err)
      throw err
    }
  }

  // Update team name
  const updateTeamName = async (name: string) => {
    try {
      if (!team) throw new Error('No team found')
      if (userRole !== 'owner') {
        throw new Error('Only the team owner can update the team name')
      }

      const { error } = await supabase
        .from('teams')
        .update({ name, updated_at: new Date().toISOString() })
        .eq('id', team.id)

      if (error) throw error

      await fetchTeam()
    } catch (err: any) {
      console.error('Error updating team:', err)
      throw err
    }
  }

  // Permission helpers
  const isOwner = userRole === 'owner'
  const isAdmin = userRole === 'admin'
  const canManageTeam = userRole === 'owner' || userRole === 'admin'
  const canManageBilling = userRole === 'owner'
  const canManageIntegrations = userRole === 'owner' || userRole === 'admin'

  return {
    team,
    members,
    invitations,
    userRole,
    loading,
    error,
    // Permissions
    isOwner,
    isAdmin,
    canManageTeam,
    canManageBilling,
    canManageIntegrations,
    // Actions
    createTeam,
    inviteMember,
    acceptInvitation,
    removeMember,
    changeMemberRole,
    cancelInvitation,
    updateTeamName,
    refetch: fetchTeam,
  }
}
