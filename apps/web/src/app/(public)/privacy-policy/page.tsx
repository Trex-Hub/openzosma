/* eslint-disable @next/next/no-img-element */
"use cache"

const PrivacyPolicyPage = async () => {
	return (
		<div className="flex flex-col w-full min-h-screen bg-background">
			<div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 lg:py-20">
				<div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-8 lg:gap-12">
					<div className="flex-1 flex flex-col gap-4">
						<h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight">Privacy Policy</h1>
						<p className="text-lg sm:text-xl text-muted-foreground max-w-2xl">
							This Privacy Policy explains how OpenZosma collects, uses, stores, and protects information when you
							interact with the OpenZosma platform. By using the Service, you consent to the practices described here.
						</p>
					</div>
					<div className="shrink-0 w-full hidden lg:block lg:w-auto lg:max-w-md">
						<div className="flex w-full h-64 sm:h-80 lg:h-96 items-center justify-center rounded-xl">
							<img
								src="/illustrations/lawyer-light.svg"
								alt="Legal illustration"
								className="w-full h-full object-contain dark:hidden"
							/>
							<img
								src="/illustrations/lawyer-dark.svg"
								alt="Legal illustration"
								className="w-full h-full object-contain hidden dark:block"
							/>
						</div>
					</div>
				</div>
			</div>

			<div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 lg:py-20">
				<div className="flex flex-col gap-12 sm:gap-16">
					<section className="flex flex-col gap-4">
						<h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">Introduction</h2>
						<div className="flex flex-col gap-3 text-muted-foreground leading-relaxed">
							<p>
								This Privacy Policy describes how the OpenZosma instance operator (&quot;we&quot;, &quot;us&quot;,
								&quot;our&quot;) handles information when you interact with the OpenZosma platform
								(&quot;Service&quot;).
							</p>
							<p>
								If you do not agree with any part of this Privacy Policy, you must discontinue use of the Service
								immediately.
							</p>
						</div>
					</section>
				</div>
			</div>
		</div>
	)
}

export default PrivacyPolicyPage
