import { create } from 'zustand';

type BlueprintMode = 'greenfield' | 'overlay';
type RunStatus = 'idle' | 'running' | 'completed' | 'failed';

interface BlueprintState {
  currentStep: number;
  totalSteps: 4;
  mode: BlueprintMode;
  selectedTemplateId: string | null;
  industryCode: string | null;
  companySize: string | null;
  runId: string | null;
  runStatus: RunStatus;

  setStep: (step: number) => void;
  nextStep: () => void;
  prevStep: () => void;
  setMode: (mode: BlueprintMode) => void;
  setTemplate: (id: string | null) => void;
  setIndustryCode: (code: string | null) => void;
  setCompanySize: (size: string | null) => void;
  setRunId: (id: string | null) => void;
  setRunStatus: (status: RunStatus) => void;
  reset: () => void;
}

const initialState = {
  currentStep: 0,
  totalSteps: 4 as const,
  mode: 'greenfield' as BlueprintMode,
  selectedTemplateId: null,
  industryCode: null,
  companySize: null,
  runId: null,
  runStatus: 'idle' as RunStatus,
};

export const useBlueprintStore = create<BlueprintState>((set) => ({
  ...initialState,

  setStep: (step) => set({ currentStep: Math.max(0, Math.min(step, 3)) }),
  nextStep: () => set((s) => ({ currentStep: Math.min(s.currentStep + 1, 3) })),
  prevStep: () => set((s) => ({ currentStep: Math.max(s.currentStep - 1, 0) })),
  setMode: (mode) => set({ mode }),
  setTemplate: (id) => set({ selectedTemplateId: id }),
  setIndustryCode: (code) => set({ industryCode: code }),
  setCompanySize: (size) => set({ companySize: size }),
  setRunId: (id) => set({ runId: id }),
  setRunStatus: (status) => set({ runStatus: status }),
  reset: () => set(initialState),
}));
