import { Avatar, AvatarFallback, AvatarImage } from "@/src/components/ui/avatar"
import { Button } from "@/src/components/ui/button"
import { ArrowLeft, MoreVertical, Phone, Video } from "lucide-react"

interface DummyConversationHeaderProps {
	name?: string
	status?: string
	avatarUrl?: string
}
const DummyConversationHeader = ({ name = "John Doe", status = "Online", avatarUrl }: DummyConversationHeaderProps) => {
	return (
		<header className="flex items-center justify-between gap-2 px-2 py-2 bg-background border-b sm:px-4">
			<div className="flex items-center gap-2 min-w-0 flex-1">
				<Button variant="ghost" size="icon" className="shrink-0 size-9 hover:bg-transparent hover:cursor-not-allowed">
					<ArrowLeft size={20} />
					<span className="sr-only">Go back</span>
				</Button>

				<Avatar className="size-10 shrink-0 hover:bg-transparent hover:cursor-not-allowed">
					<AvatarImage src={avatarUrl || "/placeholder.svg"} alt={name} />
					<AvatarFallback>
						{name
							.split(" ")
							.map((n) => n[0])
							.join("")
							.toUpperCase()}
					</AvatarFallback>
				</Avatar>

				<div className="min-w-0 flex-1">
					<p className="font-semibold text-sm line-clamp-1">{name}</p>
					<p className="text-xs text-muted-foreground line-clamp-1">{status}</p>
				</div>
			</div>
			<div className="flex items-center shrink-0">
				<Button
					variant="ghost"
					size="icon"
					className="hidden sm:inline-flex size-9 hover:bg-transparent hover:cursor-not-allowed"
				>
					<Video size={20} />
					<span className="sr-only">Video call</span>
				</Button>
				<Button
					variant="ghost"
					size="icon"
					className="hidden xs:inline-flex sm:inline-flex size-9 hover:bg-transparent hover:cursor-not-allowed"
				>
					<Phone size={20} />
					<span className="sr-only">Voice call</span>
				</Button>
				<Button variant="ghost" size="icon" className="size-9 hover:bg-transparent hover:cursor-not-allowed">
					<MoreVertical size={20} />
					<span className="sr-only">More options</span>
				</Button>
			</div>
		</header>
	)
}

export default DummyConversationHeader
