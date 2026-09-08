import express from 'express';
const app = express();

// Middleware to parse JSON bodies (similar to FastAPI's automatic parsing)
app.use(express.json());

// A simple GET route
app.get('/api/health', (req, res) => {
    res.json({ status: 'Typing test backend is live!' });
});

// Start the server
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});