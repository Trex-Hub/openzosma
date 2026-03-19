// AUTH
import { auth } from "@/src/lib/auth"
// NEXT
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { Suspense } from "react"

const OnboardingLayoutInner = async ({
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
		<div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
			<div className="w-full max-w-lg">{children}</div>
		</div>
	)
}

const OnboardingLayout = ({ children }: { children: React.ReactNode }) => {
	return (
		<Suspense>
			<OnboardingLayoutInner>{children}</OnboardingLayoutInner>
		</Suspense>
	)
}

export default OnboardingLayout
