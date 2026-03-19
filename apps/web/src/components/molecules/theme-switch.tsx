"use client"
import { cn } from "@/src/lib/utils"
import { Moon, Sun } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import { flushSync } from "react-dom"
interface ThemeSwitchProps extends React.ComponentPropsWithoutRef<"button"> {
	duration?: number
}
const ThemeSwitch = ({ className, duration = 400, ...props }: ThemeSwitchProps) => {
	const [isDark, setIsDark] = useState(false)
	const buttonRef = useRef<HTMLButtonElement>(null)
	useEffect(() => {
		const updateTheme = () => {
			setIsDark(document.documentElement.classList.contains("dark"))
		}
		updateTheme()
		const observer = new MutationObserver(updateTheme)
		observer.observe(document.documentElement, {
			attributes: true,
			attributeFilter: ["class"],
		})
		return () => observer.disconnect()
	}, [])
	const toggleTheme = useCallback(async () => {
		if (!buttonRef.current) return
		await document.startViewTransition(() => {
			flushSync(() => {
				const newTheme = !isDark
				setIsDark(newTheme)
				document.documentElement.classList.toggle("dark")
				localStorage.setItem("theme", newTheme ? "dark" : "light")
			})
		}).ready
		const { top, left, width, height } = buttonRef.current.getBoundingClientRect()
		const x = left + width / 2
		const y = top + height / 2
		const maxRadius = Math.hypot(Math.max(left, window.innerWidth - left), Math.max(top, window.innerHeight - top))
		document.documentElement.animate(
			{
				clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${maxRadius}px at ${x}px ${y}px)`],
			},
			{
				duration,
				easing: "ease-in-out",
				pseudoElement: "::view-transition-new(root)",
			},
		)
	}, [isDark, duration])
	return (
		<button ref={buttonRef} onClick={toggleTheme} className={cn(className)} {...props}>
			{isDark ? (
				<Sun className="size-4 text-neutral-700 dark:text-neutral-200" />
			) : (
				<Moon className="size-4 text-neutral-700 dark:text-neutral-200" />
			)}
			<span className="sr-only">Toggle theme</span>
		</button>
	)
}

export default ThemeSwitch
