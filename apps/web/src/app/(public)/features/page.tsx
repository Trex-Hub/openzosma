// COMPONENTS
import { AnimatedText } from "@/src/components/molecules/animated-text"
// ICONS
import { Asterisk } from "lucide-react"

const FeaturesPage = () => {
	return (
		<div className="flex flex-col items-center justify-center gap-4 min-h-screen">
			<div className="flex flex-row items-center md:items-start justify-center">
				<h1 className="text-center text-foreground font-antonio text-4xl font-extrabold uppercase tracking-tight md:text-8xl">
					<AnimatedText text="Coming Soon" />
				</h1>
				<Asterisk size={40} strokeWidth={3} className="hidden lg:block text-red-500 size-fit" />
			</div>
		</div>
	)
}

export default FeaturesPage
