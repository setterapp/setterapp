import { useState } from 'react'
import { Users, RefreshCw } from 'lucide-react'
import { DataTable } from '../components/ui/data-table'
import type { ColumnDef } from '@tanstack/react-table'
import { useContacts } from '../hooks/useContacts'
import { syncContactsLeadStatus } from '../services/ai/leadStatusDetection'
import Badge from '../components/common/Badge'

type Contact = {
  id: string
  name: string
  phone: string
  platform: 'whatsapp' | 'instagram'
  lastSeen: string
  leadStatus?: 'cold' | 'warm' | 'hot' | 'closed' | 'not_closed' | null
}

const columns: ColumnDef<Contact>[] = [
  {
    accessorKey: 'name',
    header: 'Nombre',
  },
  {
    accessorKey: 'phone',
    header: 'Teléfono',
  },
  {
    accessorKey: 'platform',
    header: 'Plataforma',
    cell: ({ row }) => {
      const platform = row.getValue('platform') as string
      const bg =
        platform === 'whatsapp'
          ? '#a6e3a1'
          : '#f38ba8'
      const label =
        platform === 'whatsapp'
          ? 'WhatsApp'
          : 'Instagram'
      return (
        <span
          style={{
            padding: '4px 8px',
            borderRadius: 'var(--border-radius-sm)',
            border: '2px solid #000',
            fontSize: 'var(--font-size-xs)',
            fontWeight: 600,
            backgroundColor: bg,
          }}
        >
          {label}
        </span>
      )
    },
  },
  {
    accessorKey: 'leadStatus',
    header: 'Estado Lead',
    cell: ({ row }) => {
      const status = row.getValue('leadStatus') as 'cold' | 'warm' | 'hot' | 'closed' | 'not_closed' | null

      const getStatusVariant = (status?: 'cold' | 'warm' | 'hot' | 'closed' | 'not_closed' | null) => {
        if (!status) return null
        switch (status) {
          case 'cold':
            return 'secondary'
          case 'warm':
            return 'warning'
          case 'hot':
            return 'danger'
          case 'closed':
            return 'success'
          case 'not_closed':
            return 'danger'
          default:
            return null
        }
      }

      const getStatusLabel = (status?: 'cold' | 'warm' | 'hot' | 'closed' | 'not_closed' | null) => {
        if (!status) return 'Sin estado'
        switch (status) {
          case 'cold':
            return 'Frío'
          case 'warm':
            return 'Tibio'
          case 'hot':
            return 'Caliente'
          case 'closed':
            return 'Cerrado'
          case 'not_closed':
            return 'No Cerrado'
          default:
            return status
        }
      }

      const variant = getStatusVariant(status)
      const label = getStatusLabel(status)

      return variant ? (
        <Badge variant={variant}>
          {label}
        </Badge>
      ) : (
        <span style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
          {label}
        </span>
      )
    },
  },
  {
    accessorKey: 'lastSeen',
    header: 'Última actividad',
  },
]

function Contacts() {
  const { contacts, loading, error, refetch } = useContacts()
  const [syncing, setSyncing] = useState(false)

  const handleSyncLeadStatus = async () => {
    setSyncing(true)
    try {
      const result = await syncContactsLeadStatus()
      if (result.success) {
        alert(`✅ ${result.message}`)
        refetch()
      } else {
        alert(`❌ Error: ${result.message}`)
      }
    } catch (error) {
      console.error('Error syncing lead status:', error)
      alert('❌ Error al sincronizar estados de lead')
    } finally {
      setSyncing(false)
    }
  }

  const data: Contact[] = contacts.map((c) => ({
    id: c.id,
    name:
      c.display_name ||
      (c.username ? `@${c.username}` : null) ||
      (c.platform === 'whatsapp'
        ? `+${c.external_id}`
        : `IG …${c.external_id.slice(-6)}`),
    phone: c.phone || (c.platform === 'whatsapp' ? `+${c.external_id}` : ''),
    platform: c.platform,
    lastSeen: c.last_message_at ? new Date(c.last_message_at).toLocaleString() : '-',
    leadStatus: c.lead_status,
  }))

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="flex items-center gap-md">
            <Users size={28} />
            Contactos
          </h2>
          <p>Gestiona tus contactos de WhatsApp e Instagram</p>
        </div>
        <button
          onClick={handleSyncLeadStatus}
          disabled={syncing}
          className="btn btn--secondary"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--spacing-sm)',
            fontSize: 'var(--font-size-sm)'
          }}
        >
          <RefreshCw
            size={16}
            style={syncing ? {
              animation: 'spin 1s linear infinite',
              transformOrigin: 'center'
            } : {}}
          />
          {syncing ? 'Sincronizando...' : 'Sincronizar Estados'}
        </button>
      </div>

      {loading && data.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="spinner" />
            <p>Cargando contactos...</p>
          </div>
        </div>
      ) : error ? (
        <div className="card">
          <div className="empty-state">
            <h3>Error</h3>
            <p style={{ color: 'var(--color-danger)' }}>{error}</p>
          </div>
        </div>
      ) : (
        <DataTable columns={columns} data={data} />
      )}
    </div>
  )
}

export default Contacts
