"use client"

const ChatLayout = ({ children }: { children: React.ReactNode }) => {
	return <div className="h-[calc(100vh-1rem)] -m-4 overflow-hidden">{children}</div>
}

export default ChatLayout
