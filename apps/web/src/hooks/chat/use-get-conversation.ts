import chatService from "@/src/services/chat.services"
import { QUERY_KEYS } from "@/src/utils/query-keys"
import { useQuery } from "@tanstack/react-query"

const useGetConversation = (id: string) => {
	return useQuery({
		queryKey: [QUERY_KEYS.CONVERSATION, id],
		queryFn: () => chatService.getConversation(id),
		enabled: !!id,
	})
}

export default useGetConversation
