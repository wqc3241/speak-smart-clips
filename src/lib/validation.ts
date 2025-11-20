import { z } from "zod";

export const emailSchema = z.string().email("Please enter a valid email address");
export const passwordSchema = z.string()
    .min(6, "Password must be at least 6 characters")
    .max(72, "Password must be less than 72 characters");
