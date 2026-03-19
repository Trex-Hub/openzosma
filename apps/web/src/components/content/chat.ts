import type { UIMessage } from "ai"

export type ChatMessage = {
	role: UIMessage["role"]
	content: string
}

export const dummyChatMessages: ChatMessage[] = [
	{
		role: "user",
		content: "Hi",
	},
	{
		role: "assistant",
		content: "Hey! 👋 What can I help you check today?",
	},
	{
		role: "user",
		content: "There's this reel going around… one sec\nhttps://youtu.be/fake-news-link \n\nCan you verify this?",
	},
	{
		role: "assistant",
		content: `
**Here's what I found:**

<br/>
The video claims\n
• "Tomatoes will disappear from India next year"\n
• Mentions "climate bans" and "government restrictions"

<br/>

**Credibility Check:**

✓ No verified news reports support this claim \n
✓ Tomato production forecasts remain stable \n
✗ Speaker isn't a verified expert \n
✗ Uses dramatic tone with no cited sources \n

<br/>

**Verdict:** 🚩 **Likely misleading** \n`,
	},
	{
		role: "user",
		content: "so why did tomato prices spike last time?",
	},
	{
		role: "assistant",
		content: `

**Why tomato prices spiked:** \n
<br/>
The price increase was primarily due to: \n
• **Heavy rainfall** in key growing regions affecting harvest \n
• **Supply chain delays** disrupting distribution \n
• **Seasonal shortage** during off-peak production periods \n

**Important note:** This was **not** because of any government ban or restriction. \n

<br/>

**Conclusion:** \n

🌱 Tomato prices fluctuate seasonally based on weather and supply conditions, but **no future ban is expected**. The market typically stabilizes as production recovers. \n`,
	},
	{
		role: "user",
		content: "ok got it\nthanks bro",
	},
	{
		role: "assistant",
		content: `Anytime! Feel free to forward a video or claim whenever you're unsure. I'm here to help you verify information! ❤️`,
	},
]
