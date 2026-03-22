import type { SaveMessagePayload } from "@/src/services/chat.services"
import chatService from "@/src/services/chat.services"
import { useMutation } from "@tanstack/react-query"

const useSaveMessage = () => {
	return useMutation({
		mutationFn: ({ conversationid, payload }: { conversationid: string; payload: SaveMessagePayload }) =>
			chatService.saveMessage(conversationid, payload),
	})
}

export default useSaveMessage
