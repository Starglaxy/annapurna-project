// backend/middleware/authMiddleware.js
const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
    // Get token from the Authorization header
    const authHeader = req.header('Authorization');

    if (!authHeader) {
        return res.status(401).json({ message: 'No token, authorization denied.' });
    }

    try {
        // The header format is "Bearer TOKEN"
        const token = authHeader.split(' ')[1];

        if (!token) {
            return res.status(401).json({ message: 'Token format is invalid.' });
        }

        // Verify the token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Add user from payload to the request object
        req.user = decoded.user;
        next(); // Proceed to the next middleware or route handler

    } catch (err) {
        res.status(401).json({ message: 'Token is not valid.' });
    }
};

module.exports = authMiddleware;