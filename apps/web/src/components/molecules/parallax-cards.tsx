// UTILS
import { cn } from "@/src/lib/utils"
// TYPES
import type { StepData } from "@/src/utils/how-it-works"
// FRAMER MOTION
import { motion, useTransform } from "framer-motion"
import type { MotionValue } from "motion/react"

const CARD_TOP_OFFSET = 56

interface ParallaxCardProps {
	index: number
	step: StepData
	scrollYProgress: MotionValue<number>
	totalSteps: number
	isActive: boolean
}

const ParallaxCard = ({ index, step, scrollYProgress, totalSteps, isActive }: ParallaxCardProps) => {
	const segmentSize = 1 / totalSteps
	const entryStart = index === 0 ? 0 : (index - 0.4) * segmentSize
	const entryEnd = index === 0 ? 0.001 : (index + 0.1) * segmentSize

	const y = useTransform(
		scrollYProgress,
		index === 0 ? [0, 0.001] : [entryStart, entryEnd],
		index === 0 ? ["0%", "0%"] : ["110%", "0%"],
	)

	const cardOpacity = useTransform(
		scrollYProgress,
		index === 0 ? [0, 0.001] : [entryStart, entryEnd],
		index === 0 ? [1, 1] : [0, 1],
	)

	return (
		<motion.div
			style={{
				y,
				opacity: cardOpacity,
				top: `${index * CARD_TOP_OFFSET}px`,
				zIndex: index + 1,
			}}
			className={cn(
				"absolute inset-x-0 bottom-0 rounded-2xl border p-6 md:p-8 h-4/6 overflow-y-hidden",
				"transition-[border-color,box-shadow] duration-500",
				"bg-card/90 backdrop-blur-sm",
				isActive ? "border-primary/20 shadow-xl shadow-primary/5" : "border-border/40",
			)}
		>
			<span className="pointer-events-none absolute right-6 top-4 select-none font-antonio text-[5rem] font-bold leading-none text-muted-foreground/6">
				{String(index + 1).padStart(2, "0")}
			</span>

			<div className="relative z-10 flex flex-col gap-4">
				<span className="inline-block text-xs font-semibold uppercase text-primary/80">Step {index + 1}</span>
				<h3 className="font-antonio text-2xl font-bold tracking-tight text-foreground md:text-4xl">{step.heading}</h3>
				{step.description.map((description, index) => (
					<p
						key={index + description}
						className="max-w-md text-base leading-relaxed tracking-tight text-muted-foreground/80 md:text-lg"
					>
						{description}
					</p>
				))}
			</div>
		</motion.div>
	)
}

export default ParallaxCard
