import { type Request, type Response, type NextFunction } from "express";
import { verifyAccessToken } from "../utils/jwt";

export async function authenticate(req: Request, res: Response, next: NextFunction) {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        return res.status(401).json({
            meta: {
                success: false,
                timestamp: new Date().toISOString(),
            },
            error: "UNAUTHORIZED",
        });
    }

    const [schema,token] = authHeader.split(" ");
    if (schema !== "Bearer" || !token) {
        return res.status(401).json({
            meta: {
                success: false,
                timestamp: new Date().toISOString(),
            },
            error: "INVALID_AUTH_HEADER",
        });
    }

    try {
        const payload = verifyAccessToken(token);
        (req as any).user = payload;
        next();
    } catch (error) {
        res.status(401).json({
            meta: {
                success: false,
                timestamp: new Date().toISOString(),
            },
            error: "INVALID_TOKEN",
        });
    }
}