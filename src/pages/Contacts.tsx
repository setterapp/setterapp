import { Users } from 'lucide-react'
import { DataTable } from '../components/ui/data-table'
import type { ColumnDef } from '@tanstack/react-table'

type Contact = {
  id: string
  name: string
  phone: string
  platform: 'whatsapp' | 'instagram'
  lastMessage: string
  status: 'active' | 'inactive'
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
    accessorKey: 'lastMessage',
    header: 'Último Mensaje',
  },
  {
    accessorKey: 'status',
    header: 'Estado',
    cell: ({ row }) => {
      const status = row.getValue('status') as string
      return (
        <span
          style={{
            padding: '4px 8px',
            borderRadius: 'var(--border-radius-sm)',
            border: '2px solid #000',
            fontSize: 'var(--font-size-xs)',
            fontWeight: 600,
            backgroundColor: status === 'active' ? '#a6e3a1' : '#ccc',
          }}
        >
          {status === 'active' ? 'Activo' : 'Inactivo'}
        </span>
      )
    },
  },
]

// Datos de ejemplo
const data: Contact[] = [
  {
    id: '1',
    name: 'Juan Pérez',
    phone: '+34 612 345 678',
    platform: 'whatsapp',
    lastMessage: 'Hola, ¿cómo estás?',
    status: 'active',
  },
  {
    id: '2',
    name: 'María García',
    phone: '+34 623 456 789',
    platform: 'instagram',
    lastMessage: 'Gracias por tu ayuda',
    status: 'active',
  },
  {
    id: '3',
    name: 'Pedro Martínez',
    phone: '+34 634 567 890',
    platform: 'whatsapp',
    lastMessage: 'Hasta luego',
    status: 'inactive',
  },
  {
    id: '4',
    name: 'Ana López',
    phone: '+34 645 678 901',
    platform: 'instagram',
    lastMessage: 'Perfecto, nos vemos',
    status: 'active',
  },
  {
    id: '5',
    name: 'Carlos Rodríguez',
    phone: '+34 656 789 012',
    platform: 'whatsapp',
    lastMessage: 'De acuerdo',
    status: 'inactive',
  },
]

function Contacts() {
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

      <div className="card">
        <DataTable columns={columns} data={data} />
      </div>
    </div>
  )
}

export default Contacts
