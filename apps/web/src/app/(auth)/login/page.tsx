"use client"

import { Button } from "@/src/components/ui/button"
// COMPONENTS
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/src/components/ui/card"
import { Input } from "@/src/components/ui/input"
import { Label } from "@/src/components/ui/label"
import { Separator } from "@/src/components/ui/separator"
// AUTH
import { authClient, signIn, signUp } from "@/src/lib/auth-client"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"

const LoginPage = () => {
	const router = useRouter()
	const [email, setEmail] = useState("")
	const [password, setPassword] = useState("")
	const [name, setName] = useState("")
	const [mode, setMode] = useState<"login" | "signup">("login")
	const [loading, setLoading] = useState(false)

	const handleGoogleLogin = async () => {
		await signIn.social({
			provider: "google",
			callbackURL: "/onboarding",
		})
	}

	const handleLogin = async (e: React.FormEvent) => {
		e.preventDefault()
		if (!email.trim() || !password.trim()) return
		setLoading(true)
		const { error } = await signIn.email({
			email: email.trim(),
			password: password.trim(),
		})
		if (error) {
			toast.error("Login failed", { description: error.message })
		} else {
			router.push("/onboarding")
		}
		setLoading(false)
	}

	const handleSignup = async (e: React.FormEvent) => {
		e.preventDefault()
		if (!email.trim() || !password.trim() || !name.trim()) return
		setLoading(true)
		const { error } = await signUp.email({
			email: email.trim(),
			password: password.trim(),
			name: name.trim(),
		})
		if (error) {
			toast.error("Sign up failed", { description: error.message })
		} else {
			router.push("/onboarding")
		}
		setLoading(false)
	}

	return (
		<div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
			<div className="w-full max-w-sm">
				<div className="flex flex-col gap-6">
					<Card className="bg-background">
						<CardHeader>
							<CardTitle>{mode === "login" ? "Login to your account" : "Create an account"}</CardTitle>
							<CardDescription>
								{mode === "login"
									? "Enter your credentials or continue with Google"
									: "Fill in your details to get started"}
							</CardDescription>
						</CardHeader>
						<CardContent className="flex flex-col gap-4">
							<form onSubmit={mode === "login" ? handleLogin : handleSignup} className="flex flex-col gap-4">
								{mode === "signup" && (
									<div className="flex flex-col gap-2">
										<Label htmlFor="name">Name</Label>
										<Input
											id="name"
											type="text"
											placeholder="Your name"
											value={name}
											onChange={(e) => setName(e.target.value)}
											required
										/>
									</div>
								)}
								<div className="flex flex-col gap-2">
									<Label htmlFor="email">Email</Label>
									<Input
										id="email"
										type="email"
										placeholder="you@example.com"
										value={email}
										onChange={(e) => setEmail(e.target.value)}
										required
										autoFocus
									/>
								</div>
								<div className="flex flex-col gap-2">
									<Label htmlFor="password">Password</Label>
									<Input
										id="password"
										type="password"
										placeholder="••••••••"
										value={password}
										onChange={(e) => setPassword(e.target.value)}
										required
									/>
								</div>
								<Button type="submit" disabled={loading}>
									{loading
										? mode === "login"
											? "Signing in..."
											: "Creating account..."
										: mode === "login"
											? "Sign In"
											: "Create Account"}
								</Button>
							</form>

							<div className="relative">
								<div className="absolute inset-0 flex items-center">
									<Separator className="w-full" />
								</div>
								<div className="relative flex justify-center text-xs uppercase">
									<span className="bg-background px-2 text-muted-foreground">or</span>
								</div>
							</div>

							<Button variant="outline" onClick={handleGoogleLogin}>
								<svg className="size-4" viewBox="0 0 24 24">
									<title>Google</title>
									<path
										d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
										fill="#4285F4"
									/>
									<path
										d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
										fill="#34A853"
									/>
									<path
										d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
										fill="#FBBC05"
									/>
									<path
										d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
										fill="#EA4335"
									/>
								</svg>
								Continue with Google
							</Button>

							<div className="text-center text-sm">
								{mode === "login" ? (
									<p className="text-muted-foreground">
										Don&apos;t have an account?{" "}
										<button type="button" onClick={() => setMode("signup")} className="text-primary hover:underline">
											Sign up
										</button>
									</p>
								) : (
									<p className="text-muted-foreground">
										Already have an account?{" "}
										<button type="button" onClick={() => setMode("login")} className="text-primary hover:underline">
											Sign in
										</button>
									</p>
								)}
							</div>
						</CardContent>
					</Card>
				</div>
			</div>
		</div>
	)
}

export default LoginPage
