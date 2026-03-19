"use client"

import {
	Stepper,
	StepperIndicator,
	StepperItem,
	StepperNav,
	StepperSeparator,
	StepperTitle,
	StepperTrigger,
} from "@/src/components/reui/stepper"
import { cn } from "@/src/lib/utils"
import { STEPS, type StepData } from "@/src/utils/how-it-works"
import { type MotionValue, motion, useMotionValueEvent, useScroll, useTransform } from "framer-motion"
import { useRef, useState } from "react"

// ---------------------------------------------------------------------------
// Parallax Card
// ---------------------------------------------------------------------------

const CARD_TOP_OFFSET = 56

interface ParallaxCardProps {
	index: number
	step: StepData
	scrollYProgress: MotionValue<number>
	totalSteps: number
	isActive: boolean
}

function ParallaxCard({ index, step, scrollYProgress, totalSteps, isActive }: ParallaxCardProps) {
	const segmentSize = 1 / totalSteps

	// Card 0 is visible immediately; subsequent cards slide up into view
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
				"absolute inset-x-0 bottom-0 rounded-2xl border p-6 md:p-8 h-3/5",
				"transition-[border-color,box-shadow] duration-500",
				"bg-card/90 backdrop-blur-sm",
				isActive ? "border-primary/20 shadow-xl shadow-primary/5" : "border-border/40",
			)}
		>
			{/* Decorative step number */}
			<span className="pointer-events-none absolute right-6 top-4 select-none font-antonio text-[5rem] font-bold leading-none text-muted-foreground/6">
				{String(index + 1).padStart(2, "0")}
			</span>

			<div className="relative z-10">
				<span className="mb-4 inline-block text-[0.6875rem] font-semibold uppercase tracking-[0.25em] text-primary/80">
					Step {index + 1}
				</span>
				<h3 className="font-antonio text-xl font-bold tracking-tight text-foreground md:text-2xl">{step.heading}</h3>
				<p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground/80 md:text-base">
					{step.description}
				</p>
			</div>
		</motion.div>
	)
}

// ---------------------------------------------------------------------------
// Main Section
// ---------------------------------------------------------------------------

export function HowItWorksSection() {
	const containerRef = useRef<HTMLDivElement>(null)
	const [activeStep, setActiveStep] = useState(1)

	const { scrollYProgress } = useScroll({
		target: containerRef,
		offset: ["start start", "end end"],
	})

	useMotionValueEvent(scrollYProgress, "change", (latest) => {
		const step = Math.min(Math.floor(latest * STEPS.length) + 1, STEPS.length)
		setActiveStep(step)
	})

	return (
		<section className="w-full text-left">
			{/* Scroll-driven container — tall to create scroll space */}
			<div ref={containerRef} className="relative" style={{ height: `${STEPS.length * 100}vh` }}>
				{/* Sticky frame — pins while the user scrolls through steps */}
				<div className="sticky top-0 flex h-screen flex-col items-center justify-center px-2 py-8">
					{/* Section heading — lives inside sticky so it stays visible */}
					<h2 className="mb-8 font-antonio text-3xl font-extrabold uppercase tracking-tight text-foreground md:mb-10 md:text-6xl">
						How It Works
					</h2>

					<div className="flex w-full max-w-5xl flex-1 overflow-hidden rounded-3xl backdrop-blur-md">
						{/* ---- Left column: Vertical stepper ---- */}
						<div className="hidden shrink-0 items-center justify-center border-r border-border/20 px-8 md:flex lg:px-12">
							<Stepper value={activeStep} orientation="vertical">
								<StepperNav>
									{STEPS.map((step, idx) => (
										<StepperItem key={idx} step={idx + 1}>
											<StepperTrigger asChild className="flex w-full items-center gap-3">
												<StepperIndicator className="size-9 text-sm font-semibold">{idx + 1}</StepperIndicator>
												<StepperTitle className="whitespace-nowrap text-sm font-medium">{step.title}</StepperTitle>
											</StepperTrigger>
											{idx < STEPS.length - 1 && (
												<StepperSeparator className="h-16 transition-colors duration-700 data-[state=completed]:bg-primary/60" />
											)}
										</StepperItem>
									))}
								</StepperNav>
							</Stepper>
						</div>

						{/* ---- Right column: Parallax stacking cards ---- */}
						<div className="flex-1 overflow-hidden px-3 pb-3 pt-10 md:px-5 md:pb-5 md:pt-16">
							<div className="relative h-full">
								{STEPS.map((step, idx) => (
									<ParallaxCard
										key={idx}
										index={idx}
										step={step}
										scrollYProgress={scrollYProgress}
										totalSteps={STEPS.length}
										isActive={activeStep === idx + 1}
									/>
								))}
							</div>
						</div>
					</div>
				</div>
			</div>
		</section>
	)
}
