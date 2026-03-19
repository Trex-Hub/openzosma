// AUTH
import { auth } from "@/src/lib/auth"
// NEXT
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { Suspense } from "react"

const AuthLayoutInner = async ({
	children,
}: {
	children: React.ReactNode
}) => {
	const session = await auth.api.getSession({
		headers: await headers(),
	})

	if (session) {
		redirect("/onboarding")
	}

	return <div className="flex flex-col">{children}</div>
}

const AuthLayout = ({ children }: { children: React.ReactNode }) => {
	return (
		<Suspense>
			<AuthLayoutInner>{children}</AuthLayoutInner>
		</Suspense>
	)
}

export default AuthLayout
