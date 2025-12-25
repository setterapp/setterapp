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
  type RowSelectionState,
} from "@tanstack/react-table"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./table"
import { Button } from "./button"
import { useTranslation } from 'react-i18next'

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  onRowSelectionChange?: (selection: RowSelectionState) => void
  rowSelection?: RowSelectionState
  renderToolbar?: (table: ReturnType<typeof useReactTable<TData>>) => React.ReactNode
}

export function DataTable<TData, TValue>({
  columns,
  data,
  onRowSelectionChange,
  rowSelection,
  renderToolbar,
}: DataTableProps<TData, TValue>) {
  const { t } = useTranslation()
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
  const [internalRowSelection, setInternalRowSelection] = React.useState<RowSelectionState>({})

  const effectiveRowSelection = rowSelection !== undefined ? rowSelection : internalRowSelection

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onRowSelectionChange: (updater) => {
      const newSelection = typeof updater === 'function'
        ? updater(effectiveRowSelection)
        : updater

      if (onRowSelectionChange) {
        onRowSelectionChange(newSelection)
      } else {
        setInternalRowSelection(newSelection)
      }
    },
    state: {
      sorting,
      columnFilters,
      rowSelection: effectiveRowSelection,
    },
    enableRowSelection: true,
  })

  return (
    <div style={{ width: '100%' }}>
      {/* Render custom toolbar if provided */}
      {renderToolbar && renderToolbar(table)}

      <div>
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow
                key={headerGroup.id}
                style={{
                  background: 'var(--color-bg)',
                  color: 'var(--color-text)'
                }}
              >
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead
                      key={header.id}
                      style={{ color: 'var(--color-text)' }}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row, index) => {
                const isLastRow = index === table.getRowModel().rows.length - 1
                return (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && "selected"}
                    style={{
                      background: row.getIsSelected() ? 'rgba(137, 180, 250, 0.1)' : 'var(--color-bg)',
                      color: 'var(--color-text)'
                    }}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell
                        key={cell.id}
                        style={{
                          borderBottom: isLastRow ? 'none' : '2px solid #000'
                        }}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                )
              })
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  style={{
                    height: '96px',
                    textAlign: 'center',
                    borderBottom: 'none'
                  }}
                >
                  {t('contacts.empty.noResults')}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: 'var(--spacing-md)',
        paddingTop: 'var(--spacing-md)',
      }}>
        <div style={{
          fontSize: 'var(--font-size-sm)',
          color: 'var(--color-text)',
          flex: 1
        }}>
          {table.getFilteredSelectedRowModel().rows.length} {t('contacts.table.of')}{" "}
          {table.getFilteredRowModel().rows.length} {t('contacts.table.rowsSelected')}
        </div>
        <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
          <Button
            variant="noShadow"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            {t('contacts.pagination.previous')}
          </Button>
          <Button
            variant="noShadow"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            {t('contacts.pagination.next')}
          </Button>
        </div>
      </div>
    </div>
  )
}

export default DataTable
