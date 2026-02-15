import {z} from 'zod';

export const registerSchema = z.object({
    name: z.string().min(2),
    email: z.email(),
    password: z.string().min(6),
    confirmPassword: z.string().min(6),
    phone: z.string().min(7).max(11),
})
.refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
});

export const loginSchema = z.object({
    email: z.email(),
    password: z.string().min(6),
});