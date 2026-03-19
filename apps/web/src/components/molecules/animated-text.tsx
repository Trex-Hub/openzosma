"use client"

import { cn } from "@/src/lib/utils"
import { useEffect, useState } from "react"

type Direction = "top" | "bottom" | "left" | "right"

interface AnimatedTextProps {
	text: string
	direction?: Direction
	duration?: number
	staggerDelay?: number
	className?: string
	wordClassName?: string
}

const directionVariants: Record<Direction, string> = {
	top: "-translate-y-10",
	bottom: "translate-y-10",
	left: "-translate-x-10",
	right: "translate-x-10",
}

export function AnimatedText({
	text,
	direction = "bottom",
	duration = 500,
	staggerDelay = 150,
	className,
	wordClassName,
}: AnimatedTextProps) {
	const [animate, setAnimate] = useState(false)
	const words = text.split(" ")

	useEffect(() => {
		// Trigger animation after mount
		const timeout = setTimeout(() => setAnimate(true), 50)
		return () => clearTimeout(timeout)
	}, [])

	return (
		<div className={cn("flex flex-wrap gap-4 overflow-hidden items-center justify-center", className)}>
			{words.map((word, index) => (
				<span
					key={`${word}-${index}`}
					className={cn(
						"inline-block opacity-0 transition-all",
						directionVariants[direction],
						animate && "translate-x-0 translate-y-0 opacity-100",
						wordClassName,
					)}
					style={{
						transitionDuration: `${duration}ms`,
						transitionDelay: `${index * staggerDelay}ms`,
					}}
				>
					{word}
				</span>
			))}
		</div>
	)
}
