"use client"
// CORE
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
// HOOKS
import type { ReactNode } from "react"
import { useState } from "react"

const QueryProvider = ({ children }: { children: ReactNode }) => {
	const [queryClient] = useState(() => new QueryClient())
	return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

export default QueryProvider
