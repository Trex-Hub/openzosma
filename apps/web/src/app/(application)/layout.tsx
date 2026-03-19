// LAYOUTS
import DashboardLoadingLayout from "@/src/components/layout/dashboard-loading-layout"
import SidebarLayout from "@/src/components/layout/sidebar-layout"
// COMPONENTS
import { StickySearch } from "@/src/components/molecules/sticky-search"
// PROVIDERS
import { CommandProvider } from "@/src/components/provider/command-menu-provider"
// AUTH
import { auth } from "@/src/lib/auth"
// NEXT
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { Suspense } from "react"

const LogicalApplicationLayout = async ({
	children,
}: {
	children: React.ReactNode
}) => {
	const session = await auth.api.getSession({
		headers: await headers(),
	})

	if (!session) {
		redirect("/login")
	}

	return (
		<CommandProvider>
			<SidebarLayout>
				<StickySearch />
				{children}
			</SidebarLayout>
		</CommandProvider>
	)
}

const ApplicationLayout = ({ children }: { children: React.ReactNode }) => {
	return (
		<Suspense fallback={<DashboardLoadingLayout />}>
			<LogicalApplicationLayout>{children}</LogicalApplicationLayout>
		</Suspense>
	)
}

export default ApplicationLayout
