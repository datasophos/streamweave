import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Table } from '@/components/Table'
import '@/i18n/config'

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

  it('clicking a sortable column header sorts rows ascending', async () => {
    const user = userEvent.setup()
    const multiData = [
      { id: '1', name: 'Zara', role: 'user' },
      { id: '2', name: 'Alice', role: 'admin' },
      { id: '3', name: 'Mike', role: 'user' },
    ]
    render(
      <Table
        columns={[
          { header: 'Name', key: 'name', sortable: true },
          { header: 'Role', key: 'role' },
        ]}
        data={multiData}
      />
    )
    await user.click(screen.getByRole('button', { name: /name/i }))
    const cells = screen.getAllByRole('cell').filter((_, i) => i % 2 === 0)
    expect(cells[0].textContent).toBe('Alice')
    expect(cells[1].textContent).toBe('Mike')
    expect(cells[2].textContent).toBe('Zara')
  })

  it('renders pagination footer with correct item range', () => {
    render(
      <Table
        columns={[{ header: 'Name', key: 'name' }]}
        data={data}
        pagination={{ skip: 0, limit: 25, total: 100, onPageChange: () => {} }}
      />
    )
    expect(screen.getByText('1–25 of 100')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /previous/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /next/i })).not.toBeDisabled()
  })

  it('pagination Previous button is enabled when skip > 0', () => {
    render(
      <Table
        columns={[{ header: 'Name', key: 'name' }]}
        data={data}
        pagination={{ skip: 25, limit: 25, total: 100, onPageChange: () => {} }}
      />
    )
    expect(screen.getByRole('button', { name: /previous/i })).not.toBeDisabled()
  })

  it('pagination Next button is disabled on the last page', () => {
    render(
      <Table
        columns={[{ header: 'Name', key: 'name' }]}
        data={data}
        pagination={{ skip: 75, limit: 25, total: 100, onPageChange: () => {} }}
      />
    )
    expect(screen.getByRole('button', { name: /next/i })).toBeDisabled()
  })

  it('pagination Next button calls onPageChange with next skip', async () => {
    const user = userEvent.setup()
    const onPageChange = vi.fn()
    render(
      <Table
        columns={[{ header: 'Name', key: 'name' }]}
        data={data}
        pagination={{ skip: 0, limit: 25, total: 100, onPageChange }}
      />
    )
    await user.click(screen.getByRole('button', { name: /next/i }))
    expect(onPageChange).toHaveBeenCalledWith(25)
  })

  it('pagination Previous button calls onPageChange with previous skip', async () => {
    const user = userEvent.setup()
    const onPageChange = vi.fn()
    render(
      <Table
        columns={[{ header: 'Name', key: 'name' }]}
        data={data}
        pagination={{ skip: 25, limit: 25, total: 100, onPageChange }}
      />
    )
    await user.click(screen.getByRole('button', { name: /previous/i }))
    expect(onPageChange).toHaveBeenCalledWith(0)
  })

  it('clicking a sortable column header twice sorts rows descending', async () => {
    const user = userEvent.setup()
    const multiData = [
      { id: '1', name: 'Zara', role: 'user' },
      { id: '2', name: 'Alice', role: 'admin' },
      { id: '3', name: 'Mike', role: 'user' },
    ]
    render(
      <Table
        columns={[
          { header: 'Name', key: 'name', sortable: true },
          { header: 'Role', key: 'role' },
        ]}
        data={multiData}
      />
    )
    await user.click(screen.getByRole('button', { name: /name/i }))
    await user.click(screen.getByRole('button', { name: /name/i }))
    const cells = screen.getAllByRole('cell').filter((_, i) => i % 2 === 0)
    expect(cells[0].textContent).toBe('Zara')
    expect(cells[1].textContent).toBe('Mike')
    expect(cells[2].textContent).toBe('Alice')
  })
})
