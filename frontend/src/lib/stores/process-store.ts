import { create } from 'zustand';

type ViewMode = 'list' | 'detail' | 'graph';

interface ProcessFilters {
  category: string | null;
  search: string;
}

interface ProcessState {
  selectedProcessId: string | null;
  selectedPhaseId: string | null;
  viewMode: ViewMode;
  filters: ProcessFilters;
  selectProcess: (id: string | null) => void;
  selectPhase: (id: string | null) => void;
  setViewMode: (mode: ViewMode) => void;
  setFilter: <K extends keyof ProcessFilters>(key: K, value: ProcessFilters[K]) => void;
  resetFilters: () => void;
}

const initialFilters: ProcessFilters = {
  category: null,
  search: '',
};

export const useProcessStore = create<ProcessState>((set) => ({
  selectedProcessId: null,
  selectedPhaseId: null,
  viewMode: 'list',
  filters: initialFilters,

  selectProcess: (id) => set({ selectedProcessId: id, selectedPhaseId: null }),
  selectPhase: (id) => set({ selectedPhaseId: id }),
  setViewMode: (mode) => set({ viewMode: mode }),
  setFilter: (key, value) => set((state) => ({ filters: { ...state.filters, [key]: value } })),
  resetFilters: () => set({ filters: initialFilters }),
}));
