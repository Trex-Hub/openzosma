"use client"

import useGetConversation from "@/src/hooks/chat/use-get-conversation"
import { QUERY_KEYS } from "@/src/utils/query-keys"
import { useQueryClient } from "@tanstack/react-query"
import { useCallback } from "react"
import type { ChatMessage, ChatParticipant, ConversationData } from "../types"

type UseConversationReturn = {
	conversation: ConversationData | null
	participants: ChatParticipant[]
	messages: ChatMessage[]
	loading: boolean
	setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>
	refetch: () => Promise<void>
}

const useConversation = (conversationid: string): UseConversationReturn => {
	const queryClient = useQueryClient()
	const { data, isLoading, refetch: queryRefetch } = useGetConversation(conversationid)

	const conversation = data?.conversation ?? null
	const participants = data?.participants ?? []
	const messages = data?.messages ?? []

	const setMessages = useCallback(
		(updater: React.SetStateAction<ChatMessage[]>) => {
			queryClient.setQueryData([QUERY_KEYS.CONVERSATION, conversationid], (old: typeof data) => {
				if (!old) return old
				const current = old.messages ?? []
				const next = typeof updater === "function" ? updater(current) : updater
				return { ...old, messages: next }
			})
		},
		[queryClient, conversationid],
	)

	const refetch = useCallback(async () => {
		await queryRefetch()
	}, [queryRefetch])

	return { conversation, participants, messages, loading: isLoading, setMessages, refetch }
}

export default useConversation
