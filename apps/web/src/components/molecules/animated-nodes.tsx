"use client"

import { motion } from "framer-motion"
import type { ReactNode } from "react"

type Direction = "top" | "bottom" | "left" | "right"

interface AnimatedComponentsProps {
	children: ReactNode
	direction?: Direction
	duration?: number
	staggerDelay?: number
	className?: string
}

const getInitialPosition = (direction: Direction) => {
	switch (direction) {
		case "top":
			return { y: -50, opacity: 0 }
		case "bottom":
			return { y: 50, opacity: 0 }
		case "left":
			return { x: -50, opacity: 0 }
		case "right":
			return { x: 50, opacity: 0 }
		default:
			return { y: 50, opacity: 0 }
	}
}

export function AnimatedComponents({
	children,
	direction = "bottom",
	duration = 0.5,
	staggerDelay = 0.1,
	className = "",
}: AnimatedComponentsProps) {
	const initial = getInitialPosition(direction)

	return (
		<div className={className}>
			<motion.div
				initial={initial}
				animate={{ x: 0, y: 0, opacity: 1 }}
				transition={{
					duration,
					delay: staggerDelay,
					ease: "easeOut",
				}}
			>
				{children}
			</motion.div>
		</div>
	)
}
