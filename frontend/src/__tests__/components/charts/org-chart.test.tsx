import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

vi.mock('@xyflow/react', () => ({
  ReactFlow: ({ children, nodes, edges, onNodeClick }: any) => (
    <div
      data-testid="react-flow"
      data-node-count={nodes?.length}
      data-edge-count={edges?.length}
      onClick={() => {
        if (onNodeClick && nodes?.length > 0) {
          onNodeClick({}, nodes[0]);
        }
      }}
    >
      {children}
    </div>
  ),
  Controls: () => <div data-testid="controls" />,
  Background: () => <div data-testid="background" />,
  MiniMap: () => <div data-testid="minimap" />,
  Handle: ({ type }: any) => <div data-testid={`handle-${type}`} />,
  Position: { Top: 'top', Bottom: 'bottom', Left: 'left', Right: 'right' },
  useNodesState: (initial: any) => [initial, vi.fn(), vi.fn()],
  useEdgesState: (initial: any) => [initial, vi.fn(), vi.fn()],
}));

vi.mock('@xyflow/react/dist/style.css', () => ({}));

import { OrgChart } from '@/components/charts/org-chart';

describe('OrgChart', () => {
  const mockOrgUnits = [
    {
      id: '1',
      name: 'Direzione Generale',
      code: 'DIR',
      parent_id: null,
      is_active: true,
      manager_name: 'Mario Rossi',
      department_name: 'Board',
      employee_count: 5,
      sort_order: 1,
      org_level: 1,
    },
    {
      id: '2',
      name: 'Risorse Umane',
      code: 'HR',
      parent_id: '1',
      is_active: true,
      manager_name: 'Anna Bianchi',
      department_name: 'HR',
      employee_count: 12,
      sort_order: 1,
      org_level: 2,
    },
    {
      id: '3',
      name: 'IT',
      code: 'IT',
      parent_id: '1',
      is_active: false,
      manager_name: null,
      department_name: 'Technology',
      employee_count: 0,
      sort_order: 2,
      org_level: 2,
    },
  ] as any[];

  it('shows empty state when no org units provided', () => {
    render(<OrgChart orgUnits={[]} />);
    expect(screen.getByText(/Nessuna unità organizzativa trovata/)).toBeInTheDocument();
  });

  it('does not render ReactFlow when org units are empty', () => {
    render(<OrgChart orgUnits={[]} />);
    expect(screen.queryByTestId('react-flow')).not.toBeInTheDocument();
  });

  it('renders ReactFlow with org units', () => {
    render(<OrgChart orgUnits={mockOrgUnits} />);
    expect(screen.getByTestId('react-flow')).toBeInTheDocument();
  });

  it('has accessible aria-label with unit count', () => {
    render(<OrgChart orgUnits={mockOrgUnits} />);
    const container = screen.getByRole('img');
    expect(container).toHaveAttribute('aria-label', 'Organigramma con 3 unita organizzative');
  });

  it('renders Controls, Background and MiniMap', () => {
    render(<OrgChart orgUnits={mockOrgUnits} />);
    expect(screen.getByTestId('controls')).toBeInTheDocument();
    expect(screen.getByTestId('background')).toBeInTheDocument();
    expect(screen.getByTestId('minimap')).toBeInTheDocument();
  });

  it('creates correct number of nodes', () => {
    render(<OrgChart orgUnits={mockOrgUnits} />);
    const flow = screen.getByTestId('react-flow');
    expect(flow).toHaveAttribute('data-node-count', '3');
  });

  it('creates edges for parent-child relationships', () => {
    render(<OrgChart orgUnits={mockOrgUnits} />);
    const flow = screen.getByTestId('react-flow');
    // Two children (HR and IT) each have an edge to parent (DIR)
    expect(flow).toHaveAttribute('data-edge-count', '2');
  });

  it('applies custom height', () => {
    render(<OrgChart orgUnits={mockOrgUnits} height={800} />);
    const container = screen.getByRole('img');
    expect(container.style.height).toBe('800px');
  });

  it('defaults height to 600', () => {
    render(<OrgChart orgUnits={mockOrgUnits} />);
    const container = screen.getByRole('img');
    expect(container.style.height).toBe('600px');
  });

  it('empty state has default height applied', () => {
    render(<OrgChart orgUnits={[]} height={400} />);
    const emptyContainer = screen
      .getByText(/Nessuna unità organizzativa trovata/)
      .closest('div[style]');
    expect((emptyContainer as HTMLElement)?.style.height).toBe('400px');
  });
});
