import { create } from "zustand"

export interface SidebarStoreProps {
	collapsed: boolean
	setcollapsed: (collapsed: boolean) => void
	togglecollapsed: () => void
}

export const useSidebarStore = create<SidebarStoreProps>((set) => ({
	collapsed: false,
	setcollapsed: (collapsed) => set({ collapsed }),
	togglecollapsed: () => set((s) => ({ collapsed: !s.collapsed })),
}))
