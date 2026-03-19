import Sidebar from "../molecules/sidebar"

const SidebarLayout = ({ children }: { children: React.ReactNode }) => {
	return (
		<div className="flex w-full flex-1 flex-col overflow-hidden md:flex-row h-screen">
			<Sidebar />
			<div className="flex-1 p-4 w-full h-full overflow-y-auto">{children}</div>
		</div>
	)
}

export default SidebarLayout
