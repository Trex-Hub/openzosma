// AUTH
import { auth } from "@/src/lib/auth"
// NEXT
import { headers } from "next/headers"
import { redirect } from "next/navigation"

const OnboardingPage = async () => {
	const session = await auth.api.getSession({
		headers: await headers(),
	})

	if (!session) {
		redirect("/login")
	}

	// If the user's profile is complete (name is required), go to chat
	if (session.user.name?.trim()) {
		redirect("/chat")
	}

	// Profile incomplete — complete it first
	redirect("/onboarding/complete-profile")
}

export default OnboardingPage
