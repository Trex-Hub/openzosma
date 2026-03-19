"use client"

import { useId, useMemo } from "react"
import {
	Area,
	AreaChart,
	Bar,
	BarChart,
	CartesianGrid,
	Cell,
	Legend,
	Line,
	LineChart,
	Pie,
	PieChart,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts"

// Vibrant, modern palette — ordered for max contrast between neighbors
const PALETTE = [
	{ main: "#6366f1", light: "#818cf8" }, // indigo
	{ main: "#22c55e", light: "#4ade80" }, // emerald
	{ main: "#f97316", light: "#fb923c" }, // orange
	{ main: "#06b6d4", light: "#22d3ee" }, // cyan
	{ main: "#ec4899", light: "#f472b6" }, // pink
	{ main: "#eab308", light: "#facc15" }, // yellow
	{ main: "#8b5cf6", light: "#a78bfa" }, // violet
	{ main: "#14b8a6", light: "#2dd4bf" }, // teal
	{ main: "#f43f5e", light: "#fb7185" }, // rose
	{ main: "#3b82f6", light: "#60a5fa" }, // blue
]

type ChartData = {
	type: "bar" | "line" | "area" | "pie"
	title?: string
	xlabel?: string
	ylabel?: string
	xLabel?: string
	yLabel?: string
	series?: string[]
	data: (string | number)[][]
}

function parseChartJson(raw: string): ChartData | null {
	try {
		const parsed = JSON.parse(raw.trim())
		if (!parsed.type || !Array.isArray(parsed.data)) return null
		return parsed as ChartData
	} catch {
		return null
	}
}

function formatnumber(value: number): string {
	if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
	if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(1)}K`
	return value.toLocaleString()
}

// Custom tooltip with modern styling
// biome-ignore lint/suspicious/noExplicitAny: recharts TooltipProps generic internals are complex and not worth fully typing here
function CustomTooltip({ active, payload, label }: any) {
	if (!active || !payload?.length) return null
	return (
		<div className="rounded-lg border bg-popover px-3 py-2 shadow-lg">
			<p className="mb-1 text-xs font-medium text-foreground">{label}</p>
			{payload.map((entry: { name: string; value: number; color: string }, i: number) => (
				<div key={i} className="flex items-center gap-2 text-xs">
					<span className="inline-block size-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
					<span className="text-muted-foreground">{entry.name}:</span>
					<span className="font-semibold tabular-nums text-foreground">{formatnumber(entry.value)}</span>
				</div>
			))}
		</div>
	)
}

// biome-ignore lint/suspicious/noExplicitAny: recharts TooltipProps generic internals are complex and not worth fully typing here
function PieTooltip({ active, payload }: any) {
	if (!active || !payload?.length) return null
	const entry = payload[0]
	return (
		<div className="rounded-lg border bg-popover px-3 py-2 shadow-lg">
			<div className="flex items-center gap-2 text-xs">
				<span className="inline-block size-2.5 rounded-full" style={{ backgroundColor: entry.payload?.fill }} />
				<span className="text-muted-foreground">{entry.name}:</span>
				<span className="font-semibold tabular-nums text-foreground">{formatnumber(entry.value)}</span>
			</div>
		</div>
	)
}

export function ChartBlock({ json }: { json: string }) {
	const uid = useId()
	const chart = useMemo(() => parseChartJson(json), [json])

	if (!chart) {
		return (
			<pre className="overflow-auto rounded-md border bg-muted/50 p-4 text-xs">
				<code>{json}</code>
			</pre>
		)
	}

	const xlabeltext = chart.xLabel || chart.xlabel || ""
	const ylabeltext = chart.yLabel || chart.ylabel || ""

	const seriesnames = chart.series?.length
		? chart.series
		: chart.data[0]?.length > 2
			? Array.from({ length: (chart.data[0]?.length ?? 1) - 1 }, (_, i) => `Series ${i + 1}`)
			: ["value"]

	const rechartdata = chart.data.map((row) => {
		const entry: Record<string, string | number> = { name: String(row[0]) }
		for (let i = 1; i < row.length; i++) {
			entry[seriesnames[i - 1] || `series${i}`] = Number(row[i]) || 0
		}
		return entry
	})

	const piedata = chart.data.map((row) => ({
		name: String(row[0]),
		value: Number(row[1]) || 0,
	}))

	const axistick = { fontSize: 11, fill: "#94a3b8" }
	const gridstroke = "#e2e8f0"

	// SVG gradient definitions for bars and areas
	const gradientdefs = (
		<defs>
			{PALETTE.map((c, i) => (
				<linearGradient key={i} id={`grad-${uid}-${i}`} x1="0" y1="0" x2="0" y2="1">
					<stop offset="0%" stopColor={c.light} stopOpacity={0.9} />
					<stop offset="100%" stopColor={c.main} stopOpacity={1} />
				</linearGradient>
			))}
			{PALETTE.map((c, i) => (
				<linearGradient key={`area-${i}`} id={`areagrad-${uid}-${i}`} x1="0" y1="0" x2="0" y2="1">
					<stop offset="0%" stopColor={c.main} stopOpacity={0.3} />
					<stop offset="100%" stopColor={c.main} stopOpacity={0.02} />
				</linearGradient>
			))}
		</defs>
	)

	return (
		<div className="my-3 w-full overflow-hidden rounded-xl border bg-background shadow-sm">
			{chart.title && (
				<div className="border-b px-5 py-3">
					<h4 className="text-sm font-semibold text-foreground">{chart.title}</h4>
				</div>
			)}
			<div className="h-72 w-full p-4">
				<ResponsiveContainer width="100%" height="100%">
					{chart.type === "bar" ? (
						<BarChart data={rechartdata} margin={{ top: 8, right: 16, bottom: 4, left: 0 }} barCategoryGap="20%">
							{gradientdefs}
							<CartesianGrid vertical={false} stroke={gridstroke} strokeDasharray="4 4" />
							<XAxis
								dataKey="name"
								tick={axistick}
								axisLine={{ stroke: gridstroke }}
								tickLine={false}
								label={
									xlabeltext
										? { value: xlabeltext, position: "insideBottom", offset: -2, fontSize: 11, fill: "#94a3b8" }
										: undefined
								}
							/>
							<YAxis
								tick={axistick}
								axisLine={false}
								tickLine={false}
								tickFormatter={(v) => formatnumber(v)}
								label={
									ylabeltext
										? { value: ylabeltext, angle: -90, position: "insideLeft", fontSize: 11, fill: "#94a3b8" }
										: undefined
								}
							/>
							<Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(0,0,0,0.04)" }} />
							{seriesnames.length > 1 && (
								<Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} iconType="circle" iconSize={8} />
							)}
							{seriesnames.map((name, i) => (
								<Bar key={name} dataKey={name} fill={`url(#grad-${uid}-${i})`} radius={[6, 6, 0, 0]} maxBarSize={56} />
							))}
						</BarChart>
					) : chart.type === "line" ? (
						<LineChart data={rechartdata} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
							<CartesianGrid vertical={false} stroke={gridstroke} strokeDasharray="4 4" />
							<XAxis
								dataKey="name"
								tick={axistick}
								axisLine={{ stroke: gridstroke }}
								tickLine={false}
								label={
									xlabeltext
										? { value: xlabeltext, position: "insideBottom", offset: -2, fontSize: 11, fill: "#94a3b8" }
										: undefined
								}
							/>
							<YAxis
								tick={axistick}
								axisLine={false}
								tickLine={false}
								tickFormatter={(v) => formatnumber(v)}
								label={
									ylabeltext
										? { value: ylabeltext, angle: -90, position: "insideLeft", fontSize: 11, fill: "#94a3b8" }
										: undefined
								}
							/>
							<Tooltip content={<CustomTooltip />} />
							{seriesnames.length > 1 && (
								<Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} iconType="circle" iconSize={8} />
							)}
							{seriesnames.map((name, i) => (
								<Line
									key={name}
									type="monotone"
									dataKey={name}
									stroke={PALETTE[i % PALETTE.length].main}
									strokeWidth={2.5}
									dot={{ r: 4, fill: "#fff", stroke: PALETTE[i % PALETTE.length].main, strokeWidth: 2 }}
									activeDot={{ r: 6, fill: PALETTE[i % PALETTE.length].main, stroke: "#fff", strokeWidth: 2 }}
								/>
							))}
						</LineChart>
					) : chart.type === "area" ? (
						<AreaChart data={rechartdata} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
							{gradientdefs}
							<CartesianGrid vertical={false} stroke={gridstroke} strokeDasharray="4 4" />
							<XAxis
								dataKey="name"
								tick={axistick}
								axisLine={{ stroke: gridstroke }}
								tickLine={false}
								label={
									xlabeltext
										? { value: xlabeltext, position: "insideBottom", offset: -2, fontSize: 11, fill: "#94a3b8" }
										: undefined
								}
							/>
							<YAxis
								tick={axistick}
								axisLine={false}
								tickLine={false}
								tickFormatter={(v) => formatnumber(v)}
								label={
									ylabeltext
										? { value: ylabeltext, angle: -90, position: "insideLeft", fontSize: 11, fill: "#94a3b8" }
										: undefined
								}
							/>
							<Tooltip content={<CustomTooltip />} />
							{seriesnames.length > 1 && (
								<Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} iconType="circle" iconSize={8} />
							)}
							{seriesnames.map((name, i) => (
								<Area
									key={name}
									type="monotone"
									dataKey={name}
									stroke={PALETTE[i % PALETTE.length].main}
									fill={`url(#areagrad-${uid}-${i})`}
									strokeWidth={2.5}
								/>
							))}
						</AreaChart>
					) : chart.type === "pie" ? (
						<PieChart>
							<Pie
								data={piedata}
								cx="50%"
								cy="50%"
								innerRadius="40%"
								outerRadius="75%"
								paddingAngle={3}
								dataKey="value"
								cornerRadius={4}
								label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
								labelLine={{ stroke: "#94a3b8", strokeWidth: 1 }}
								style={{ fontSize: 11 }}
							>
								{piedata.map((_, i) => (
									<Cell key={i} fill={PALETTE[i % PALETTE.length].main} stroke="none" />
								))}
							</Pie>
							<Tooltip content={<PieTooltip />} />
							<Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} iconType="circle" iconSize={8} />
						</PieChart>
					) : (
						<BarChart data={rechartdata}>
							{gradientdefs}
							<Bar dataKey="value" fill={`url(#grad-${uid}-0)`} radius={[6, 6, 0, 0]} />
						</BarChart>
					)}
				</ResponsiveContainer>
			</div>
		</div>
	)
}
