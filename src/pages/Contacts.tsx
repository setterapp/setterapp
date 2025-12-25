import { useTranslation } from 'react-i18next'
import { DataTable } from '../components/ui/data-table'
import type { ColumnDef } from '@tanstack/react-table'
import { useContacts } from '../hooks/useContacts'
import type { Contact } from '../hooks/useContacts'
import { formatDate } from '../utils/date'
import PlatformBadge from '../components/badges/PlatformBadge'
import LeadStatusBadge from '../components/badges/LeadStatusBadge'

function Contacts() {
  const { t } = useTranslation()
  const { contacts, loading, error } = useContacts()

  const columns: ColumnDef<Contact>[] = [
    {
      accessorKey: 'display_name',
      header: t('contacts.table.name'),
      cell: ({ row }) => {
        const contact = row.original
        const name =
          contact.display_name ||
          (contact.username ? `@${contact.username}` : null) ||
          (contact.platform === 'whatsapp'
            ? `+${contact.external_id}`
            : `IG …${contact.external_id.slice(-6)}`)

        return (
          <div>
            <div style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>
              {name}
            </div>
            {contact.username && contact.display_name && (
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                @{contact.username}
              </div>
            )}
          </div>
        )
      },
    },
    {
      accessorKey: 'email',
      header: t('contacts.table.email'),
      cell: ({ row }) => {
        const email = row.getValue('email') as string | null
        return email ? (
          <span style={{ fontSize: 'var(--font-size-sm)' }}>{email}</span>
        ) : (
          <span style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>—</span>
        )
      },
    },
    {
      accessorKey: 'phone',
      header: t('contacts.table.phone'),
      cell: ({ row }) => {
        const contact = row.original
        const phone = contact.phone || (contact.platform === 'whatsapp' ? `+${contact.external_id}` : null)
        return phone ? (
          <span style={{ fontSize: 'var(--font-size-sm)' }}>{phone}</span>
        ) : (
          <span style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>—</span>
        )
      },
    },
    {
      accessorKey: 'platform',
      header: t('contacts.table.platform'),
      cell: ({ row }) => {
        const platform = row.getValue('platform') as 'whatsapp' | 'instagram'
        return <PlatformBadge platform={platform} />
      },
    },
    {
      accessorKey: 'lead_status',
      header: t('contacts.table.leadStatus'),
      cell: ({ row }) => {
        const status = row.getValue('lead_status') as 'cold' | 'warm' | 'hot' | 'closed' | 'not_closed' | null
        return <LeadStatusBadge status={status} />
      },
    },
    {
      accessorKey: 'last_message_at',
      header: t('contacts.table.lastSeen'),
      cell: ({ row }) => {
        const lastSeen = row.getValue('last_message_at') as string | null
        return lastSeen ? (
          <span style={{ fontSize: 'var(--font-size-sm)' }}>{formatDate(lastSeen)}</span>
        ) : (
          <span style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>—</span>
        )
      },
    },
  ]

  return (
    <div>
      {loading && contacts.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="spinner" />
            <p>{t('contacts.loading')}</p>
          </div>
        </div>
      ) : error ? (
        <div className="card">
          <div className="empty-state">
            <h3>{t('common.error')}</h3>
            <p style={{ color: 'var(--color-danger)' }}>{error}</p>
          </div>
        </div>
      ) : contacts.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <h3>{t('contacts.empty.title')}</h3>
            <p style={{ color: 'var(--color-text-secondary)' }}>{t('contacts.empty.description')}</p>
          </div>
        </div>
      ) : (
        <DataTable columns={columns} data={contacts} />
      )}
    </div>
  )
}

export default Contacts
