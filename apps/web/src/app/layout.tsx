import type { Metadata } from "next"
import { Figtree } from "next/font/google"
import { Inter } from "next/font/google"
import { Antonio } from "next/font/google"
import "./globals.css"
import QueryProvider from "@/src/components/provider/query-provider"
import { ThemeProvider } from "@/src/components/provider/theme-provider"
import { Toaster } from "@/src/components/ui/sonner"

const figtree = Figtree({
	variable: "--font-figtree",
	subsets: ["latin"],
	weight: ["400", "500", "600", "700"],
})

const inter = Inter({
	variable: "--font-inter",
	subsets: ["latin"],
	weight: ["400", "500", "600", "700"],
})

const antonio = Antonio({
	variable: "--font-antonio",
	subsets: ["latin"],
	weight: ["400", "500", "600", "700"],
})

export const metadata: Metadata = {
	title: "OpenZosma",
	description: "Self-hosted AI agent platform for digital work twins",
}

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode
}>) {
	return (
		<html
			lang="en"
			className={`${figtree.variable} ${inter.variable} ${antonio.variable}`}
			suppressHydrationWarning
			data-scroll-behavior="smooth"
		>
			<body className="antialiased">
				<ThemeProvider attribute="class" defaultTheme="light">
					<QueryProvider>{children}</QueryProvider>
					<Toaster richColors />
				</ThemeProvider>
			</body>
		</html>
	)
}
