import type { CreateConversationPayload } from "@/src/services/chat.services"
import chatService from "@/src/services/chat.services"
import { QUERY_KEYS } from "@/src/utils/query-keys"
import { useMutation, useQueryClient } from "@tanstack/react-query"

const useCreateConversation = () => {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: (payload: CreateConversationPayload) => chatService.createConversation(payload),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.CONVERSATIONS] })
		},
	})
}

export default useCreateConversation
