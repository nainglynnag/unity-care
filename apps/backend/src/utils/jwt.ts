import jwt from 'jsonwebtoken';

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'default_access_secret';
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'default_refresh_secret';

export function generateAccessToken(payload: object) {
    return jwt.sign(payload, ACCESS_SECRET, { expiresIn: '1h' });
}

export function generateRefreshToken(payload: object) {
    return jwt.sign(payload, REFRESH_SECRET, { expiresIn: '7d' });
}

export function verifyAccessToken(token: string) {
    try {
        return jwt.verify(token, ACCESS_SECRET);
    } catch (error) {
        return null;
    }
}

export function verifyRefreshToken(token: string) {
    try {
        return jwt.verify(token, REFRESH_SECRET);
    } catch (error) {
        return null;
    }
}