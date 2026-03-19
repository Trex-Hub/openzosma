"use client"
import ThemeSwitch from "@/src/components/molecules/theme-switch"
import ChatSidebar from "@/src/components/organisms/chat-sidebar"
import { Avatar, AvatarFallback, AvatarImage } from "@/src/components/ui/avatar"
// COMPONENTS
import { Sidebar as RootSidebar, SidebarBody, SidebarLink, useSidebar } from "@/src/components/ui/sidebar"
import { useSession } from "@/src/lib/auth-client"
// STORE
import { useSidebarStore } from "@/src/stores/sidebar-store"
// LINKS
import { getSidebarItems } from "@/src/utils/sidebar-items"
// ICONS
import { IconChevronRight, IconMenu2 } from "@tabler/icons-react"
// MOTION
import { AnimatePresence, motion } from "motion/react"
// NEXT
import Link from "next/link"
import { usePathname } from "next/navigation"
// HOOKS
import { useCallback, useEffect, useRef, useState } from "react"

// Inner component — rendered inside SidebarProvider so useSidebar() works
const SidebarContent = ({
	collapsed,
	togglecollapsed,
}: {
	collapsed: boolean
	togglecollapsed: () => void
}) => {
	// hovered is just for the expand arrow hint — NOT for auto-expanding
	const { hovered } = useSidebar()

	const { data } = useSession()
	const { user } = data ?? {}
	const { name, image } = user ?? {}
	const pathname = usePathname()
	const sidebarItems = getSidebarItems()

	// ── Chat flyout state with 300ms open debounce ──
	const [chatflyoutopen, setChatflyoutopen] = useState(false)
	const flyoutopentimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
	const flyoutclosetimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
	const chatitemref = useRef<HTMLDivElement>(null)
	const flyoutref = useRef<HTMLDivElement>(null)

	const openflyout = useCallback(() => {
		// Cancel any pending close
		if (flyoutclosetimeout.current) clearTimeout(flyoutclosetimeout.current)
		// Open after 300ms debounce
		if (!chatflyoutopen) {
			flyoutopentimeout.current = setTimeout(() => {
				setChatflyoutopen(true)
			}, 300)
		}
	}, [chatflyoutopen])

	const closeflyout = useCallback(() => {
		// Cancel any pending open
		if (flyoutopentimeout.current) clearTimeout(flyoutopentimeout.current)
		// Close after short delay so user can move to the flyout panel
		flyoutclosetimeout.current = setTimeout(() => {
			setChatflyoutopen(false)
		}, 150)
	}, [])

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			if (flyoutopentimeout.current) clearTimeout(flyoutopentimeout.current)
			if (flyoutclosetimeout.current) clearTimeout(flyoutclosetimeout.current)
		}
	}, [])

	// Close flyout on route change
	// biome-ignore lint/correctness/useExhaustiveDependencies: stable reference
	useEffect(() => {
		setChatflyoutopen(false)
	}, [pathname])

	const ischatactive = pathname.includes("/chat")
	const isexpanded = !collapsed

	return (
		<div className="relative flex flex-1 flex-col overflow-x-hidden overflow-y-auto justify-between">
			<div className="flex flex-1 flex-col">
				{/* ── Header: Logo + Toggle ── */}
				<div className="flex items-center justify-between mb-1">
					{isexpanded ? (
						<Logo />
					) : (
						<div className="h-5 w-6 shrink-0 rounded-tl-lg rounded-tr-sm rounded-br-lg rounded-bl-sm bg-black dark:bg-white" />
					)}
					{/* Burger icon when expanded, chevron arrow when collapsed+hovered */}
					{isexpanded ? (
						<button
							type="button"
							onClick={togglecollapsed}
							className="p-1 rounded-md hover:bg-accent transition-colors shrink-0"
							aria-label="Collapse sidebar"
						>
							<IconMenu2 className="size-4 text-neutral-700 dark:text-neutral-200" />
						</button>
					) : (
						<AnimatePresence>
							{hovered ? (
								<motion.button
									key="expand-arrow"
									initial={{ opacity: 0 }}
									animate={{ opacity: 1 }}
									exit={{ opacity: 0 }}
									transition={{ duration: 0.12 }}
									onClick={togglecollapsed}
									className="p-1 rounded-md hover:bg-accent transition-colors shrink-0"
									aria-label="Expand sidebar"
								>
									<IconChevronRight className="size-4 text-neutral-700 dark:text-neutral-200" />
								</motion.button>
							) : null}
						</AnimatePresence>
					)}
				</div>

				{/* ── Spacer (org switcher removed) ── */}
				<div className="mt-4" />

				{/* ── Nav items ── */}
				<div className="flex flex-col gap-2">
					{sidebarItems.map(({ id, hasflyout, ...item }) => {
						if (id === "chat" && hasflyout) {
							return (
								<div
									key={id}
									ref={chatitemref}
									className="relative"
									onMouseEnter={openflyout}
									onMouseLeave={closeflyout}
								>
									<SidebarLink link={item} className={ischatactive ? "bg-accent/50 rounded-md px-1" : "px-1"}>
										<IconChevronRight className="size-3.5 text-muted-foreground" />
									</SidebarLink>

									{/* Flyout panel */}
									<AnimatePresence>
										{chatflyoutopen && (
											<motion.div
												ref={flyoutref}
												initial={{ opacity: 0, x: -8 }}
												animate={{ opacity: 1, x: 0 }}
												exit={{ opacity: 0, x: -8 }}
												transition={{ duration: 0.15 }}
												className="fixed z-[100] top-0 h-screen w-[320px] shadow-xl border-r bg-background"
												style={{ left: isexpanded ? "300px" : "60px" }}
												onMouseEnter={openflyout}
												onMouseLeave={closeflyout}
											>
												<ChatSidebar onNavigate={() => setChatflyoutopen(false)} />
											</motion.div>
										)}
									</AnimatePresence>
								</div>
							)
						}

						// Logout must NOT be a <Link> — prefetch would trigger the sign-out API
						if (id === "logout") {
							return (
								<button
									type="button"
									key={id}
									onClick={() => {
										window.location.href = item.href
									}}
									className="flex items-center justify-start gap-2 group/sidebar py-2 w-full text-left"
								>
									{item.icon}
									{isexpanded && (
										<motion.span
											initial={{ opacity: 0 }}
											animate={{ opacity: 1 }}
											className="text-neutral-700 dark:text-neutral-200 text-sm group-hover/sidebar:translate-x-1 transition duration-150 whitespace-pre inline-block !p-0 !m-0"
										>
											{item.label}
										</motion.span>
									)}
								</button>
							)
						}

						return <SidebarLink key={id} link={item} />
					})}
				</div>
			</div>

			{/* ── Footer ── */}
			<div>
				<div className="flex flex-row items-center justify-between">
					<Link
						href="/settings/profile"
						className="flex flex-row items-center justify-start gap-2 group/sidebar py-2 rounded-md hover:bg-accent/50 transition-colors px-1 -mx-1"
					>
						<Avatar className="size-8 border border-neutral-600 dark:border-neutral-400">
							<AvatarImage src={image ?? ""} />
							<AvatarFallback>{name?.charAt(0)}</AvatarFallback>
						</Avatar>
						{isexpanded && (
							<motion.p
								initial={{ opacity: 0 }}
								animate={{ opacity: 1 }}
								className="text-neutral-700 dark:text-neutral-200 text-sm group-hover/sidebar:translate-x-1 transition duration-150 whitespace-pre inline-block p-0 m-0"
							>
								{name}
							</motion.p>
						)}
					</Link>
					{isexpanded && <ThemeSwitch />}
				</div>
			</div>
		</div>
	)
}

const Sidebar = () => {
	const { collapsed, togglecollapsed } = useSidebarStore()
	const open = !collapsed
	const setOpen = (val: boolean | ((prev: boolean) => boolean)) => {
		const newval = typeof val === "function" ? val(open) : val
		useSidebarStore.getState().setcollapsed(!newval)
	}

	return (
		<RootSidebar open={open} setOpen={setOpen} animate={true}>
			<SidebarBody className="justify-between gap-10">
				<SidebarContent collapsed={collapsed} togglecollapsed={togglecollapsed} />
			</SidebarBody>
		</RootSidebar>
	)
}

export const Logo = () => {
	return (
		<Link href="#" className="relative z-20 flex items-center space-x-2 py-1 text-sm font-normal text-black">
			<div className="h-5 w-6 shrink-0 rounded-tl-lg rounded-tr-sm rounded-br-lg rounded-bl-sm bg-black dark:bg-white" />
			<motion.span
				initial={{ opacity: 0 }}
				animate={{ opacity: 1 }}
				className="font-medium whitespace-pre text-black dark:text-white"
			>
				OpenZosma
			</motion.span>
		</Link>
	)
}

export default Sidebar
