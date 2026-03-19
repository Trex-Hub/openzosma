// SERVICES
import modelsService from "@/src/services/models.services"
// UTILS
import { QUERY_KEYS } from "@/src/utils/query-keys"
// HOOKS
import { useQuery } from "@tanstack/react-query"

export const useGetModels = () => {
	const { MODELS } = QUERY_KEYS
	return useQuery({
		queryKey: [MODELS],
		queryFn: async () => await modelsService.getModels(),
	})
}
