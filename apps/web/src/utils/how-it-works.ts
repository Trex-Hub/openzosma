export interface StepData {
	title: string
	heading: string
	description: string[]
}

export const STEPS: StepData[] = [
	{
		title: "Ask a Question",
		heading: "Start with Curiosity",
		description: [
			"Type any claim, headline, or question you want verified. Our AI begins analyzing the moment you hit send.",
		],
	},
	{
		title: "Cross-Reference Sources",
		heading: "Powered by Evidence",
		description: [
			"Our engine scans thousands of verified sources, fact-checking databases, and trusted publications to build a comprehensive picture.",
		],
	},
	{
		title: "Get Your Answer",
		heading: "Truth, Delivered",
		description: [
			"Receive a clear, sourced verdict with confidence ratings and direct links to the original evidence. No ambiguity, just facts.",
		],
	},
]
