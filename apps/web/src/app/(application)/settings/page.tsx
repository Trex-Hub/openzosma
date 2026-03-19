"use client"

// COMPONENTS
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/src/components/ui/card"
import { Input } from "@/src/components/ui/input"
import { Label } from "@/src/components/ui/label"
// AUTH
import { useSession } from "@/src/lib/auth-client"
// ICONS
import { IconSettings } from "@tabler/icons-react"

const SettingsPage = () => {
	const { data: session, isPending } = useSession()
	const user = session?.user

	if (isPending) {
		return (
			<div className="flex flex-col w-full h-full gap-6">
				<p className="text-sm text-muted-foreground">Loading...</p>
			</div>
		)
	}

	return (
		<div className="flex flex-col w-full h-full gap-6">
			{/* General Settings */}
			<Card>
				<CardHeader>
					<CardTitle className="text-base flex items-center gap-2">
						<IconSettings className="size-4" />
						General
					</CardTitle>
					<CardDescription>Instance information for your OpenZosma deployment.</CardDescription>
				</CardHeader>
				<CardContent className="flex flex-col gap-4">
					<div className="flex flex-col gap-2">
						<Label>Instance Name</Label>
						<Input value="OpenZosma" disabled />
						<p className="text-xs text-muted-foreground">Self-hosted OpenZosma instance.</p>
					</div>
					<div className="flex flex-col gap-2">
						<Label>Signed In As</Label>
						<Input value={user?.email ?? ""} disabled />
					</div>
				</CardContent>
			</Card>
		</div>
	)
}

export default SettingsPage
