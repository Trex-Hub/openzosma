"use client"

import { Avatar, AvatarFallback, AvatarImage } from "@/src/components/ui/avatar"
// COMPONENTS
import { Button } from "@/src/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/src/components/ui/card"
import { Input } from "@/src/components/ui/input"
import { Label } from "@/src/components/ui/label"
import { Separator } from "@/src/components/ui/separator"
// AUTH
import { authClient, useSession } from "@/src/lib/auth-client"
// ICONS
import { IconCamera, IconMail, IconUser } from "@tabler/icons-react"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"

const ProfilePage = () => {
	const { data: session, isPending } = useSession()
	const user = session?.user

	const [name, setName] = useState("")
	const [image, setImage] = useState("")
	const [saving, setSaving] = useState(false)
	const fileinputref = useRef<HTMLInputElement>(null)

	useEffect(() => {
		if (user) {
			setName(user.name ?? "")
			setImage(user.image ?? "")
		}
	}, [user])

	// ── Profile update ──
	const handleupdateprofile = async () => {
		if (!name.trim()) {
			toast.error("Name cannot be empty")
			return
		}
		setSaving(true)
		try {
			const { error } = await authClient.updateUser({
				name: name.trim(),
				image: image.trim() || undefined,
			})
			if (error) {
				toast.error("Failed to update profile", {
					description: error.message,
				})
			} else {
				toast.success("Profile updated")
			}
		} catch {
			toast.error("Failed to update profile")
		}
		setSaving(false)
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

		// Resize to a small avatar to avoid oversized session cookies.
		// Raw base64 stored in user.image is included in the session cookie
		// by Better Auth — large images cause ERR_RESPONSE_HEADERS_TOO_BIG.
		const img = new Image()
		img.onload = () => {
			const size = 64
			const canvas = document.createElement("canvas")
			canvas.width = size
			canvas.height = size
			const ctx = canvas.getContext("2d")!
			// Center-crop to square
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

	const haschanges = user && (name !== (user.name ?? "") || image !== (user.image ?? ""))

	if (isPending) {
		return (
			<div className="flex flex-col w-full h-full gap-6">
				<p className="text-sm text-muted-foreground">Loading profile...</p>
			</div>
		)
	}

	if (!user) {
		return (
			<div className="flex flex-col w-full h-full gap-6">
				<p className="text-sm text-muted-foreground">Unable to load user profile.</p>
			</div>
		)
	}

	return (
		<div className="flex flex-col w-full h-full gap-6">
			{/* ── Profile Details ── */}
			<Card>
				<CardHeader>
					<CardTitle className="text-base flex items-center gap-2">
						<IconUser className="size-4" />
						Profile
					</CardTitle>
					<CardDescription>Update your personal information and profile picture.</CardDescription>
				</CardHeader>
				<CardContent className="flex flex-col gap-6">
					{/* Avatar */}
					<div className="flex items-center gap-4">
						<div className="relative group">
							<Avatar className="size-20 border">
								<AvatarImage src={image} />
								<AvatarFallback className="text-xl">{name?.charAt(0) ?? "?"}</AvatarFallback>
							</Avatar>
							<button
								type="button"
								onClick={() => fileinputref.current?.click()}
								className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
							>
								<IconCamera className="size-5 text-white" />
							</button>
							<input ref={fileinputref} type="file" accept="image/*" className="hidden" onChange={handleimageupload} />
						</div>
						<div className="flex flex-col gap-1">
							<p className="text-sm font-medium">{user.name}</p>
							<p className="text-xs text-muted-foreground">{user.email}</p>
							<button
								type="button"
								onClick={() => fileinputref.current?.click()}
								className="text-xs text-primary hover:underline text-left cursor-pointer"
							>
								Change photo
							</button>
						</div>
					</div>

					<Separator />

					{/* Name */}
					<div className="flex flex-col gap-2">
						<Label htmlFor="profilename">Full Name</Label>
						<Input id="profilename" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
					</div>

					{/* Image URL */}
					<div className="flex flex-col gap-2">
						<Label htmlFor="profileimage">Profile Image URL</Label>
						<Input
							id="profileimage"
							value={image}
							onChange={(e) => setImage(e.target.value)}
							placeholder="https://example.com/avatar.png"
						/>
						<p className="text-xs text-muted-foreground">You can also paste a direct URL to an image.</p>
					</div>

					{/* Email (read-only) */}
					<div className="flex flex-col gap-2">
						<Label className="flex items-center gap-1.5">
							<IconMail className="size-3.5" />
							Email
						</Label>
						<Input value={user.email} disabled />
						<p className="text-xs text-muted-foreground">Email cannot be changed from here.</p>
					</div>

					{/* User ID (read-only) */}
					<div className="flex flex-col gap-2">
						<Label>User ID</Label>
						<Input value={user.id} disabled />
					</div>

					<div className="flex justify-end">
						<Button onClick={handleupdateprofile} disabled={saving || !haschanges}>
							{saving ? "Saving..." : "Save Changes"}
						</Button>
					</div>
				</CardContent>
			</Card>
		</div>
	)
}

export default ProfilePage
