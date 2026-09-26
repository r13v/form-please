import { z } from "zod"

export const ticketSchema = z.object({
	name: z.string().min(2, "Enter at least two characters"),
	email: z.string().email("Enter a valid email"),
	topic: z.enum(["billing", "bug", "other"]),
	message: z.string().min(10, "Enter at least 10 characters"),
})
