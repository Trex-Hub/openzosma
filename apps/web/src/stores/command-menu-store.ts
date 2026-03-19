import { create } from "zustand"

export interface CommandMenuStoreProps {
	open: boolean
	setOpen: (open: boolean) => void
}

export const useCommandMenuStore = create<CommandMenuStoreProps>((set) => ({
	open: false,
	setOpen: (open) => set({ open }),
}))
