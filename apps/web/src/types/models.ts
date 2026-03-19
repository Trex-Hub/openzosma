type ModelPreset = {
	id: string
	display_name: string
	description: string
	note: string
	icon: string
	provider: string
	provider_model: string
	is_enabled: boolean
	is_default: boolean
	sort_order: number
	show_in_ui: boolean
	created_at: Date
	updated_at: Date
}

export type { ModelPreset }
