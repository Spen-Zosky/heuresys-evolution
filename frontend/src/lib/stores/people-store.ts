import { create } from 'zustand';

interface PeopleFilters {
  orgUnitId: string | null;
  search: string;
}

interface PeopleState {
  filters: PeopleFilters;
  setFilter: <K extends keyof PeopleFilters>(key: K, value: PeopleFilters[K]) => void;
  resetFilters: () => void;
}

const initialFilters: PeopleFilters = {
  orgUnitId: null,
  search: '',
};

export const usePeopleStore = create<PeopleState>((set) => ({
  filters: initialFilters,
  setFilter: (key, value) => set((state) => ({ filters: { ...state.filters, [key]: value } })),
  resetFilters: () => set({ filters: initialFilters }),
}));
