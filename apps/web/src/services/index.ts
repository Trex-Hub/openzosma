// LOGGER
import logger from "@/src/utils/logger"

interface FetchState<T> {
	data: T | null
	isLoading: boolean
	isError: boolean
	isSuccess: boolean
	error: Error | null
	statusCode: number
}

interface ApiOptions extends RequestInit {
	responseType?: "json" | "blob" | "text"
}

export class ApiService {
	private baseUrl = ""

	constructor(baseUrl?: string) {
		if (baseUrl) {
			this.setBaseUrl(baseUrl)
		}
	}

	setBaseUrl(url: string) {
		this.baseUrl = url
	}

	async fetchData<T>(endpoint: string, options?: ApiOptions): Promise<FetchState<T>> {
		const state: FetchState<T> = {
			data: null,
			isLoading: true,
			isError: false,
			isSuccess: false,
			error: null,
			statusCode: 0,
		}

		try {
			const response = await fetch(`${this.baseUrl}${endpoint}`, {
				...options,
				headers: {
					...options?.headers,
				},
			})

			const statusCode = response.status

			let data: unknown = null

			if (!response.ok) {
				try {
					switch (options?.responseType) {
						case "blob":
							data = await response.blob()
							break
						case "text":
							data = await response.text()
							break
						default:
							data = await response.json()
					}
				} catch {
					data = null
				}

				const error = Object.assign(new Error(`HTTP error! status: ${statusCode}`), {
					statusCode,
					responseData: data,
				})

				throw error
			}

			logger.info(`API call to ${endpoint} successful`)

			switch (options?.responseType) {
				case "blob":
					data = await response.blob()
					break
				case "text":
					data = await response.text()
					break
				default:
					data = await response.json()
			}

			logger.info(data)

			return {
				...state,
				data: data as T,
				isLoading: false,
				isSuccess: true,
				statusCode,
			}
		} catch (error: unknown) {
			logger.error(`API call to ${endpoint} failed`)
			logger.error("[ERROR LOG]", error)

			return {
				...state,
				isLoading: false,
				isError: true,
				error: error instanceof Error ? error : new Error("An error occurred"),
				data: error instanceof Error ? ((error as unknown as { responseData: unknown }).responseData as T) : null,
				statusCode: error instanceof Error ? (error as unknown as { statusCode: number }).statusCode : 500,
			}
		}
	}

	async get<T>(endpoint: string, options?: ApiOptions) {
		logger.info(`API call to ${endpoint} successful`)
		return this.fetchData<T>(endpoint, { ...options, method: "GET" })
	}

	async post<T>(endpoint: string, body: unknown, options?: ApiOptions) {
		const isFormBody = body instanceof FormData || body instanceof URLSearchParams
		const headers = isFormBody ? { ...options?.headers } : { "Content-Type": "application/json", ...options?.headers }

		return this.fetchData<T>(endpoint, {
			...options,
			method: "POST",
			body: isFormBody ? body : JSON.stringify(body),
			headers,
		})
	}

	async put<T>(endpoint: string, body: unknown, options?: ApiOptions) {
		return this.fetchData<T>(endpoint, {
			...options,
			method: "PUT",
			body: JSON.stringify(body),
		})
	}

	async delete<T>(endpoint: string, options?: ApiOptions) {
		return this.fetchData<T>(endpoint, { ...options, method: "DELETE" })
	}
}

export default new ApiService()
