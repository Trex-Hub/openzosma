import BuildingBlocksSVG from "@/src/components/svg/building-blocks"
import CloudSyncSVG from "@/src/components/svg/cloud-sync"
import VerifiedSVG from "@/src/components/svg/verified"
import VerifyDataSVG from "@/src/components/svg/verify-data"

export interface FeatureData {
	figure: string
	title: string
	description: string
	illustrationHint: string
	illustration: React.ReactNode
}

export const FEATURES: FeatureData[] = [
	{
		figure: "FIG 0.2",
		title: "Powered by Realtime Data",
		description: "Our agent searches the web in real time so every verdict is grounded in current evidence.",
		illustrationHint: "Search and video sources",
		illustration: <CloudSyncSVG />,
	},
	{
		figure: "FIG 0.3",
		title: "Built for Future",
		description: "Extensible by design: plug in new sources and channels without rewiring.",
		illustrationHint: "Extensible architecture",
		illustration: <BuildingBlocksSVG />,
	},
	{
		figure: "FIG 0.4",
		title: "Designed for Clarity",
		description: "Structured verdicts with confidence ratings and direct links to sources.",
		illustrationHint: "Structured verdicts and sources",
		illustration: <VerifyDataSVG />,
	},
]
