import { z } from "zod"

export const profileSchema = z.object({
	name: z.string("Name is required").min(1, { message: "Name is required" }).max(191, { message: "Name is too long" }),
})

export type ProfileSchema = z.infer<typeof profileSchema>
