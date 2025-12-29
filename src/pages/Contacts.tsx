import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { DataTable } from '../components/ui/data-table'
import type { ColumnDef } from '@tanstack/react-table'
import { useContacts } from '../hooks/useContacts'
import type { Contact } from '../hooks/useContacts'
import { formatDate } from '../utils/date'
import PlatformBadge from '../components/badges/PlatformBadge'
import LeadStatusBadge from '../components/badges/LeadStatusBadge'
import { Download, Copy, Users } from 'lucide-react'
import { Checkbox } from '../components/ui/checkbox'
import SectionHeader from '../components/SectionHeader'

function Contacts() {
  const { t } = useTranslation()
  const { contacts, loading, error } = useContacts()
  const [selectedRows, setSelectedRows] = useState<Record<string, boolean>>({})

  const columns: ColumnDef<Contact>[] = [
    {
      id: 'select',
      header: ({ table }) => (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Checkbox
            checked={table.getIsAllPageRowsSelected()}
            onCheckedChange={(checked) => {
              table.toggleAllPageRowsSelected(!!checked)
            }}
          />
        </div>
      ),
      cell: ({ row }) => (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(checked) => {
              row.toggleSelected(!!checked)
            }}
          />
        </div>
      ),
      enableSorting: false,
      enableHiding: false,
      size: 50,
    },
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
        const status = row.getValue('lead_status') as 'cold' | 'warm' | 'booked' | 'closed' | 'not_closed' | null
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

  const handleExportCSV = (selectedContacts: Contact[]) => {
    const headers = [
      t('contacts.table.name'),
      t('contacts.table.email'),
      t('contacts.table.phone'),
      t('contacts.table.platform'),
      t('contacts.table.leadStatus'),
      t('contacts.table.lastSeen'),
    ]

    const rows = selectedContacts.map(contact => {
      const name =
        contact.display_name ||
        (contact.username ? `@${contact.username}` : null) ||
        (contact.platform === 'whatsapp'
          ? `+${contact.external_id}`
          : `IG …${contact.external_id.slice(-6)}`)

      const email = contact.email || ''
      const phone = contact.phone || (contact.platform === 'whatsapp' ? `+${contact.external_id}` : '')
      const platform = contact.platform === 'whatsapp' ? 'WhatsApp' : 'Instagram'
      const status = contact.lead_status ? t(`contacts.status.${contact.lead_status}`) : t('contacts.status.none')
      const lastSeen = contact.last_message_at ? formatDate(contact.last_message_at) : ''

      return [name, email, phone, platform, status, lastSeen]
    })

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `contacts_${new Date().toISOString().split('T')[0]}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleCopyToClipboard = async (selectedContacts: Contact[]) => {
    const headers = [
      t('contacts.table.name'),
      t('contacts.table.email'),
      t('contacts.table.phone'),
      t('contacts.table.platform'),
      t('contacts.table.leadStatus'),
      t('contacts.table.lastSeen'),
    ]

    const rows = selectedContacts.map(contact => {
      const name =
        contact.display_name ||
        (contact.username ? `@${contact.username}` : null) ||
        (contact.platform === 'whatsapp'
          ? `+${contact.external_id}`
          : `IG …${contact.external_id.slice(-6)}`)

      const email = contact.email || ''
      const phone = contact.phone || (contact.platform === 'whatsapp' ? `+${contact.external_id}` : '')
      const platform = contact.platform === 'whatsapp' ? 'WhatsApp' : 'Instagram'
      const status = contact.lead_status ? t(`contacts.status.${contact.lead_status}`) : t('contacts.status.none')
      const lastSeen = contact.last_message_at ? formatDate(contact.last_message_at) : ''

      return [name, email, phone, platform, status, lastSeen]
    })

    const tsvContent = [
      headers.join('\t'),
      ...rows.map(row => row.join('\t'))
    ].join('\n')

    try {
      await navigator.clipboard.writeText(tsvContent)
      alert(t('contacts.actions.copiedToClipboard'))
    } catch (err) {
      console.error('Failed to copy:', err)
      alert(t('contacts.actions.copyFailed'))
    }
  }

  return (
    <div>
      <SectionHeader title="Contactos" icon={<Users size={24} />} />

      {loading && contacts.length === 0 ? (
        <div className="card" style={{ border: '2px solid #000' }}>
          <div className="empty-state">
            <div className="spinner" />
            <p>{t('contacts.loading')}</p>
          </div>
        </div>
      ) : error ? (
        <div className="card" style={{ border: '2px solid #000' }}>
          <div className="empty-state">
            <h3>{t('common.error')}</h3>
            <p style={{ color: 'var(--color-danger)' }}>{error}</p>
          </div>
        </div>
      ) : contacts.length === 0 ? (
        <div className="card" style={{ border: '2px solid #000' }}>
          <div className="empty-state">
            <h3>{t('contacts.empty.title')}</h3>
            <p style={{ color: 'var(--color-text-secondary)' }}>{t('contacts.empty.description')}</p>
          </div>
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={contacts}
          onRowSelectionChange={setSelectedRows}
          rowSelection={selectedRows}
          renderFooterActions={(table) => {
            const selectedCount = table.getFilteredSelectedRowModel().rows.length
            const selectedContacts = table.getFilteredSelectedRowModel().rows.map(row => row.original)
            const hasSelection = selectedCount > 0

            return (
              <>
                <button
                  onClick={() => hasSelection && handleCopyToClipboard(selectedContacts)}
                  disabled={!hasSelection}
                  className="btn btn--sm"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 'var(--spacing-xs)',
                    fontSize: 'var(--font-size-xs)',
                    padding: '6px 12px',
                    backgroundColor: hasSelection ? 'var(--color-primary)' : '#ccc',
                    color: hasSelection ? '#000' : '#666',
                    border: '2px solid #000',
                    cursor: hasSelection ? 'pointer' : 'not-allowed',
                    opacity: hasSelection ? 1 : 0.5,
                  }}
                >
                  <Copy size={16} />
                  {t('contacts.actions.copy')}
                </button>

                <button
                  onClick={() => hasSelection && handleExportCSV(selectedContacts)}
                  disabled={!hasSelection}
                  className="btn btn--sm"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 'var(--spacing-xs)',
                    fontSize: 'var(--font-size-xs)',
                    padding: '6px 12px',
                    backgroundColor: hasSelection ? '#a6e3a1' : '#ccc',
                    color: hasSelection ? '#000' : '#666',
                    border: '2px solid #000',
                    cursor: hasSelection ? 'pointer' : 'not-allowed',
                    opacity: hasSelection ? 1 : 0.5,
                  }}
                >
                  <Download size={16} />
                  {t('contacts.actions.export')}
                </button>
              </>
            )
          }}
        />
      )}
    </div>
  )
}

export default Contacts
