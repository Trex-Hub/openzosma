import { GATEWAY_URL } from "@/src/lib/constants"
import type { ModelPreset } from "@/src/types/models"
import { ApiService } from "."

export class ModelsService {
	private apiService: ApiService

	constructor() {
		this.apiService = new ApiService(`${GATEWAY_URL}/models`)
	}
	async getModels(): Promise<ModelPreset[]> {
		const { data } = await this.apiService.get<ModelPreset[]>("")
		return data as ModelPreset[]
	}
}

const modelsService = new ModelsService()

export default modelsService
