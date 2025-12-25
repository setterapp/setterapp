import { useTranslation } from 'react-i18next'
import { DataTable } from '../components/ui/data-table'
import type { ColumnDef } from '@tanstack/react-table'
import { useContacts } from '../hooks/useContacts'

type Contact = {
  id: string
  name: string
  phone: string
  platform: 'whatsapp' | 'instagram'
  lastSeen: string
  leadStatus?: 'cold' | 'warm' | 'hot' | 'closed' | 'not_closed' | null
}

function Contacts() {
  const { t } = useTranslation()
  const { contacts, loading, error } = useContacts()

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
      header: t('contacts.leadStatus'),
      cell: ({ row }) => {
        const status = row.getValue('leadStatus') as 'cold' | 'warm' | 'hot' | 'closed' | 'not_closed' | null

        const getStatusBackgroundColor = (status?: 'cold' | 'warm' | 'hot' | 'closed' | 'not_closed' | null) => {
          if (!status) return null
          switch (status) {
            case 'cold':
              return '#94a3b8' // secondary color
            case 'warm':
              return '#fbbf24' // warning color
            case 'hot':
              return '#ef4444' // danger color
            case 'closed':
              return '#22c55e' // success color
            case 'not_closed':
              return '#ef4444' // danger color
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

        const backgroundColor = getStatusBackgroundColor(status)
        const label = getStatusLabel(status)

        return backgroundColor ? (
          <span
            style={{
              backgroundColor,
              color: '#000',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '2px 6px',
              borderRadius: 'var(--border-radius-sm)',
              fontSize: 'var(--font-size-xs)',
              fontWeight: 600,
              border: '2px solid #000',
            }}
          >
            {label}
          </span>
        ) : (
          <span style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
            {label}
          </span>
        )
      },
    },
  ]

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
