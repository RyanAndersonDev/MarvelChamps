import { Router } from 'express';
import bcrypt from 'bcrypt';
import { prisma } from '../lib/db';
import { signToken } from '../lib/jwt';

const router = Router();

/** POST /auth/register — create a new account */
router.post('/register', async (req, res) => {
    const { username, email, password } = req.body as {
        username?: string;
        email?: string;
        password?: string;
    };

    if (!username || !email || !password) {
        res.status(400).json({ error: 'username, email, and password are required' });
        return;
    }

    const passwordHash = await bcrypt.hash(password, 12);

    try {
        const user = await prisma.user.create({
            data: { username, email, passwordHash },
        });
        const token = signToken({ userId: user.id, username: user.username });
        res.status(201).json({ token, user: { id: user.id, username: user.username } });
    } catch (err: unknown) {
        if ((err as { code?: string }).code === 'P2002') {
            res.status(409).json({ error: 'Username or email already taken' });
            return;
        }
        throw err; // Express 5 forwards unhandled async errors to the error handler
    }
});

/** POST /auth/login — exchange credentials for a JWT */
router.post('/login', async (req, res) => {
    const { username, password } = req.body as {
        username?: string;
        password?: string;
    };

    if (!username || !password) {
        res.status(400).json({ error: 'username and password are required' });
        return;
    }

    const user = await prisma.user.findUnique({ where: { username } });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
        res.status(401).json({ error: 'Invalid credentials' });
        return;
    }

    const token = signToken({ userId: user.id, username: user.username });
    res.json({ token, user: { id: user.id, username: user.username } });
});

export default router;
