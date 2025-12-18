import * as React from "react"
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  getPaginationRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
} from "@tanstack/react-table"

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
}

export function DataTable<TData, TValue>({
  columns,
  data,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    state: {
      sorting,
      columnFilters,
    },
  })

  return (
    <div>
      <div style={{
        border: '2px solid #000',
        borderRadius: 'var(--border-radius)',
        overflow: 'hidden',
        boxShadow: '4px 4px 0px 0px #000',
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ background: 'var(--color-bg-secondary)' }}>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    style={{
                      padding: 'var(--spacing-md)',
                      textAlign: 'left',
                      fontWeight: 700,
                      borderBottom: '2px solid #000',
                      fontSize: 'var(--font-size-sm)',
                    }}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  style={{
                    borderBottom: '1px solid var(--color-border)',
                  }}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      style={{
                        padding: 'var(--spacing-md)',
                        fontSize: 'var(--font-size-sm)',
                      }}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={columns.length}
                  style={{
                    padding: 'var(--spacing-xl)',
                    textAlign: 'center',
                    color: 'var(--color-text-secondary)',
                  }}
                >
                  No hay resultados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 'var(--spacing-md) 0',
        gap: 'var(--spacing-md)',
      }}>
        <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
          {table.getFilteredSelectedRowModel().rows.length} de{" "}
          {table.getFilteredRowModel().rows.length} fila(s) seleccionadas.
        </div>
        <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
          <button
            className="btn btn--secondary btn--sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Anterior
          </button>
          <button
            className="btn btn--secondary btn--sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Siguiente
          </button>
        </div>
      </div>
    </div>
  )
}

export default DataTable
