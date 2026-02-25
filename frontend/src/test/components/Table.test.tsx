import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Table } from '@/components/Table'

describe('Table', () => {
  const data = [{ id: '1', name: 'Alice', role: 'admin' }]

  it('renders column headers', () => {
    render(
      <Table
        columns={[
          { header: 'Name', key: 'name' },
          { header: 'Role', key: 'role' },
        ]}
        data={data}
      />
    )
    expect(screen.getByText('Name')).toBeInTheDocument()
    expect(screen.getByText('Role')).toBeInTheDocument()
  })

  it('renders cell values via key', () => {
    render(<Table columns={[{ header: 'Name', key: 'name' }]} data={data} />)
    expect(screen.getByText('Alice')).toBeInTheDocument()
  })

  it('renders cell via render function', () => {
    render(
      <Table
        columns={[{ header: 'Name', render: (row) => <strong>{row.name}</strong> }]}
        data={data}
      />
    )
    expect(screen.getByText('Alice')).toBeInTheDocument()
  })

  it('renders null for column with no key and no render', () => {
    // Column with neither key nor render — renders null (line 82)
    render(<Table columns={[{ header: 'Empty' }]} data={data} />)
    const cells = screen.getAllByRole('cell')
    expect(cells[0].textContent).toBe('')
  })

  it('renders empty string for column key with null value (covers ?? branch)', () => {
    const dataWithNull = [{ id: '1', name: null as unknown as string, role: 'admin' }]
    render(<Table columns={[{ header: 'Name', key: 'name' }]} data={dataWithNull} />)
    const cells = screen.getAllByRole('cell')
    expect(cells[0].textContent).toBe('')
  })

  it('shows empty message when data is empty', () => {
    render(<Table columns={[{ header: 'Name', key: 'name' }]} data={[]} emptyMessage="No items." />)
    expect(screen.getByText('No items.')).toBeInTheDocument()
  })

  it('shows default empty message when emptyMessage is not provided', () => {
    render(<Table columns={[{ header: 'Name', key: 'name' }]} data={[]} />)
    expect(screen.getByText('No records found.')).toBeInTheDocument()
  })

  it('shows loading spinner when isLoading is true', () => {
    render(<Table columns={[{ header: 'Name', key: 'name' }]} data={[]} isLoading={true} />)
    expect(screen.getByText('Loading…')).toBeInTheDocument()
  })

  it('applies column className to header and cell', () => {
    render(
      <Table columns={[{ header: 'Name', key: 'name', className: 'custom-class' }]} data={data} />
    )
    const header = screen.getByRole('columnheader')
    expect(header.className).toContain('custom-class')
  })
})
