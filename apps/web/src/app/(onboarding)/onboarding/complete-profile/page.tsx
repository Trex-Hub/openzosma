"use client"

import { Avatar, AvatarFallback, AvatarImage } from "@/src/components/ui/avatar"
import { Button } from "@/src/components/ui/button"
// COMPONENTS
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/src/components/ui/card"
import { Input } from "@/src/components/ui/input"
import { Label } from "@/src/components/ui/label"
// AUTH
import { authClient, useSession } from "@/src/lib/auth-client"
// ICONS
import { IconCamera, IconUser } from "@tabler/icons-react"
import { useRouter } from "next/navigation"
import { useRef, useState } from "react"
import { toast } from "sonner"

const CompleteProfilePage = () => {
	const router = useRouter()
	const { data: session, isPending } = useSession()
	const user = session?.user

	const [name, setName] = useState("")
	const [image, setImage] = useState("")
	const [submitting, setSubmitting] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [initialized, setInitialized] = useState(false)
	const fileinputref = useRef<HTMLInputElement>(null)

	// Pre-fill from session once loaded
	if (user && !initialized) {
		setName(user.name ?? "")
		setImage(user.image ?? "")
		setInitialized(true)
	}

	const handleimageupload = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0]
		if (!file) return

		if (!file.type.startsWith("image/")) {
			toast.error("Please select an image file")
			return
		}

		if (file.size > 2 * 1024 * 1024) {
			toast.error("Image must be smaller than 2MB")
			return
		}

		// Resize to a small avatar to avoid oversized session cookies
		const img = new Image()
		img.onload = () => {
			const size = 64
			const canvas = document.createElement("canvas")
			canvas.width = size
			canvas.height = size
			const ctx = canvas.getContext("2d")!
			const min = Math.min(img.width, img.height)
			const sx = (img.width - min) / 2
			const sy = (img.height - min) / 2
			ctx.drawImage(img, sx, sy, min, min, 0, 0, size, size)
			const resized = canvas.toDataURL("image/jpeg", 0.5)
			setImage(resized)
			URL.revokeObjectURL(img.src)
		}
		img.src = URL.createObjectURL(file)
	}

	const handlesubmit = async (e: React.FormEvent) => {
		e.preventDefault()

		if (!name.trim()) {
			setError("Your name is required to continue")
			return
		}

		setSubmitting(true)
		setError(null)

		try {
			const { error: apierror } = await authClient.updateUser({
				name: name.trim(),
				image: image.trim() || undefined,
			})

			if (apierror) {
				setError(apierror.message || "Failed to update profile")
				setSubmitting(false)
				return
			}

			toast.success("Profile updated")
			// Continue onboarding flow — the main /onboarding page will handle the rest
			router.push("/onboarding")
		} catch {
			setError("Something went wrong. Please try again.")
			setSubmitting(false)
		}
	}

	if (isPending) {
		return (
			<Card className="bg-background">
				<CardContent className="py-12">
					<p className="text-center text-sm text-muted-foreground">Loading...</p>
				</CardContent>
			</Card>
		)
	}

	return (
		<Card className="bg-background">
			<CardHeader className="text-center">
				<div className="flex justify-center mb-2">
					<div className="rounded-full bg-primary/10 p-3">
						<IconUser className="size-6 text-primary" />
					</div>
				</div>
				<CardTitle className="text-xl">Complete Your Profile</CardTitle>
				<CardDescription>Let us know a bit about you before we get started.</CardDescription>
			</CardHeader>
			<CardContent>
				<form onSubmit={handlesubmit} className="flex flex-col gap-6">
					{/* Avatar */}
					<div className="flex flex-col items-center gap-3">
						<div className="relative group">
							<Avatar className="size-24 border">
								<AvatarImage src={image} />
								<AvatarFallback className="text-2xl">{name?.charAt(0) || "?"}</AvatarFallback>
							</Avatar>
							<button
								type="button"
								onClick={() => fileinputref.current?.click()}
								className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
							>
								<IconCamera className="size-6 text-white" />
							</button>
							<input ref={fileinputref} type="file" accept="image/*" className="hidden" onChange={handleimageupload} />
						</div>
						<button
							type="button"
							onClick={() => fileinputref.current?.click()}
							className="text-xs text-primary hover:underline cursor-pointer"
						>
							Upload a photo
						</button>
					</div>

					{/* Name */}
					<div className="flex flex-col gap-2">
						<Label htmlFor="name">
							Full Name <span className="text-destructive">*</span>
						</Label>
						<Input
							id="name"
							value={name}
							onChange={(e) => {
								setName(e.target.value)
								setError(null)
							}}
							placeholder="Enter your full name"
							autoFocus
						/>
					</div>

					{/* Image URL (optional) */}
					<div className="flex flex-col gap-2">
						<Label htmlFor="imageurl">Profile Image URL (optional)</Label>
						<Input
							id="imageurl"
							value={image}
							onChange={(e) => setImage(e.target.value)}
							placeholder="https://example.com/avatar.png"
						/>
						<p className="text-xs text-muted-foreground">Or paste a direct link to your profile image.</p>
					</div>

					{/* Email (read-only, for context) */}
					{user?.email && (
						<div className="flex flex-col gap-2">
							<Label>Email</Label>
							<Input value={user.email} disabled />
							<p className="text-xs text-muted-foreground">Signed in as this email.</p>
						</div>
					)}

					{error && <p className="text-sm text-destructive text-center">{error}</p>}

					<Button type="submit" disabled={submitting || !name.trim()}>
						{submitting ? "Saving..." : "Continue"}
					</Button>
				</form>
			</CardContent>
		</Card>
	)
}

export default CompleteProfilePage
