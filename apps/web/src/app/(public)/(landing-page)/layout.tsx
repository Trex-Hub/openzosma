const LandingPageLayout = ({ children }: { children: React.ReactNode }) => {
	return (
		<div className="py-16 md:py-32 px-2 min-h-screen grid place-items-center">
			<div className="container mx-auto text-center flex flex-col items-center justify-center gap-4">{children}</div>
		</div>
	)
}

export default LandingPageLayout
