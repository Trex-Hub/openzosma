export type SupportedDatabase = {
	id: string
	name: string
	description: string
	icon: string
	enabled: boolean
	defaultport: number
}

export const supporteddatabases: SupportedDatabase[] = [
	{
		id: "postgresql",
		name: "PostgreSQL",
		description: "Advanced open-source relational database",
		icon: "🐘",
		enabled: true,
		defaultport: 5432,
	},
	{
		id: "mysql",
		name: "MySQL",
		description: "Popular open-source relational database",
		icon: "🐬",
		enabled: true,
		defaultport: 3306,
	},
	{
		id: "mariadb",
		name: "MariaDB",
		description: "Community-developed fork of MySQL",
		icon: "🦭",
		enabled: false,
		defaultport: 3306,
	},
	{
		id: "mssql",
		name: "Microsoft SQL Server",
		description: "Enterprise relational database by Microsoft",
		icon: "🪟",
		enabled: false,
		defaultport: 1433,
	},
	{
		id: "oracle",
		name: "Oracle Database",
		description: "Enterprise-grade relational database",
		icon: "🔴",
		enabled: false,
		defaultport: 1521,
	},
	{
		id: "sqlite",
		name: "SQLite",
		description: "Lightweight file-based relational database",
		icon: "📁",
		enabled: false,
		defaultport: 0,
	},
	{
		id: "mongodb",
		name: "MongoDB",
		description: "Document-oriented NoSQL database",
		icon: "🍃",
		enabled: false,
		defaultport: 27017,
	},
	{
		id: "redis",
		name: "Redis",
		description: "In-memory key-value data store",
		icon: "⚡",
		enabled: false,
		defaultport: 6379,
	},
	{
		id: "cockroachdb",
		name: "CockroachDB",
		description: "Distributed SQL database for cloud-native apps",
		icon: "🪳",
		enabled: false,
		defaultport: 26257,
	},
	{
		id: "clickhouse",
		name: "ClickHouse",
		description: "Column-oriented OLAP database for analytics",
		icon: "📊",
		enabled: false,
		defaultport: 8123,
	},
]
