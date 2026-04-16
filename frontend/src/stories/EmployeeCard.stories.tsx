import type { Meta, StoryObj } from '@storybook/react'
import { EmployeeCard, type Employee } from '@/components/hr/employee-card'

const sampleEmployee: Employee = {
  id: '1',
  firstName: 'Marco',
  lastName: 'Rossi',
  email: 'marco.rossi@azienda.it',
  phone: '+39 333 1234567',
  role: 'Software Developer',
  department: 'Engineering',
  location: 'Milano',
  status: 'active',
}

const meta: Meta<typeof EmployeeCard> = {
  title: 'HR/EmployeeCard',
  component: EmployeeCard,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['card', 'row', 'compact'],
    },
  },
}

export default meta
type Story = StoryObj<typeof meta>

export const CardVariant: Story = {
  args: {
    employee: sampleEmployee,
    variant: 'card',
  },
  decorators: [
    (Story) => (
      <div className="w-80">
        <Story />
      </div>
    ),
  ],
}

export const RowVariant: Story = {
  args: {
    employee: sampleEmployee,
    variant: 'row',
  },
  decorators: [
    (Story) => (
      <div className="w-full max-w-4xl">
        <Story />
      </div>
    ),
  ],
}

export const CompactVariant: Story = {
  args: {
    employee: sampleEmployee,
    variant: 'compact',
  },
  decorators: [
    (Story) => (
      <div className="w-64">
        <Story />
      </div>
    ),
  ],
}

export const ActiveEmployee: Story = {
  args: {
    employee: { ...sampleEmployee, status: 'active' },
    variant: 'card',
  },
  decorators: [
    (Story) => (
      <div className="w-80">
        <Story />
      </div>
    ),
  ],
}

export const OnLeaveEmployee: Story = {
  args: {
    employee: { ...sampleEmployee, status: 'on_leave', firstName: 'Anna', lastName: 'Verdi' },
    variant: 'card',
  },
  decorators: [
    (Story) => (
      <div className="w-80">
        <Story />
      </div>
    ),
  ],
}

export const InactiveEmployee: Story = {
  args: {
    employee: { ...sampleEmployee, status: 'inactive', firstName: 'Luca', lastName: 'Bianchi' },
    variant: 'card',
  },
  decorators: [
    (Story) => (
      <div className="w-80">
        <Story />
      </div>
    ),
  ],
}

export const EmployeeGrid: Story = {
  render: () => {
    const employees: Employee[] = [
      { ...sampleEmployee, id: '1' },
      { ...sampleEmployee, id: '2', firstName: 'Anna', lastName: 'Verdi', status: 'on_leave', department: 'HR' },
      { ...sampleEmployee, id: '3', firstName: 'Luca', lastName: 'Bianchi', role: 'Product Manager', department: 'Product' },
      { ...sampleEmployee, id: '4', firstName: 'Sara', lastName: 'Conti', role: 'Designer', department: 'Design' },
    ]
    return (
      <div className="grid grid-cols-2 gap-4 max-w-3xl">
        {employees.map((emp) => (
          <EmployeeCard key={emp.id} employee={emp} variant="card" />
        ))}
      </div>
    )
  },
}
