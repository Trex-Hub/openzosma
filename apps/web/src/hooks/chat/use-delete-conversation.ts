import chatService from "@/src/services/chat.services"
import { QUERY_KEYS } from "@/src/utils/query-keys"
import { useMutation, useQueryClient } from "@tanstack/react-query"

const useDeleteConversation = () => {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: (id: string) => chatService.deleteConversation(id),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.CONVERSATIONS] })
		},
	})
}

export default useDeleteConversation
