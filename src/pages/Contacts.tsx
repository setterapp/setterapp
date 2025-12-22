import { Users } from 'lucide-react'
import { DataTable } from '../components/ui/data-table'
import type { ColumnDef } from '@tanstack/react-table'
import { useContacts } from '../hooks/useContacts'

type Contact = {
  id: string
  name: string
  phone: string
  platform: 'whatsapp' | 'instagram'
  lastSeen: string
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
      return (
        <span
          style={{
            padding: '4px 8px',
            borderRadius: 'var(--border-radius-sm)',
            border: '2px solid #000',
            fontSize: 'var(--font-size-xs)',
            fontWeight: 600,
            backgroundColor: platform === 'whatsapp' ? '#a6e3a1' : '#f38ba8',
          }}
        >
          {platform === 'whatsapp' ? 'WhatsApp' : 'Instagram'}
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
  const { contacts, loading, error } = useContacts()

  const data: Contact[] = contacts.map((c) => ({
    id: c.id,
    name: c.display_name || (c.username ? `@${c.username}` : null) || (c.platform === 'whatsapp' ? `+${c.external_id}` : `IG …${c.external_id.slice(-6)}`),
    phone: c.phone || (c.platform === 'whatsapp' ? `+${c.external_id}` : ''),
    platform: c.platform,
    lastSeen: c.last_message_at ? new Date(c.last_message_at).toLocaleString() : '-',
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
