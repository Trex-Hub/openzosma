/* eslint-disable @next/next/no-img-element */
"use cache"
import Link from "next/link"

const TermsAndConditionsPage = async () => {
	return (
		<div className="flex flex-col w-full min-h-screen bg-background">
			<div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 lg:py-20">
				<div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-8 lg:gap-12">
					<div className="flex-1 flex flex-col gap-4">
						<h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight">Terms and Conditions</h1>
						<p className="text-lg sm:text-xl text-muted-foreground max-w-2xl">
							Please read these Terms carefully before using our Service. By accessing or using our Service, you agree
							to be bound by these Terms.
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
								These Terms and Conditions (&quot;Terms&quot;) govern your access to and use of the OpenZosma platform
								(&quot;Service&quot;). By initiating a conversation with the Service or otherwise using it, you
								acknowledge that you have read, understood, and agree to be bound by these Terms and our
								<Link href="/privacy-policy" className="text-blue-400">
									{" "}
									Privacy Policy
								</Link>
								.
							</p>
							<p>
								If you do not agree with any part of these Terms, you must discontinue use of the Service immediately.
							</p>
						</div>
					</section>
				</div>
			</div>
		</div>
	)
}

export default TermsAndConditionsPage
