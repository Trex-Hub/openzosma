"use client"

// COMPONENTS
import CommandMenu from "@/src/components/molecules/command-menu"
// STORES
import { useCommandMenuStore } from "@/src/stores/command-menu-store"
// HOOKS
import { useEffect } from "react"

export function CommandProvider({ children }: { children: React.ReactNode }) {
	const { open, setOpen } = useCommandMenuStore()

	useEffect(() => {
		const down = (e: KeyboardEvent) => {
			if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
				e.preventDefault()
				setOpen(!open)
			}
		}

		document.addEventListener("keydown", down)
		return () => document.removeEventListener("keydown", down)
	}, [open, setOpen])

	return (
		<>
			{children}
			<CommandMenu open={open} setOpen={setOpen} />
		</>
	)
}
