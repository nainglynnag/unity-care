import express from 'express';
import cors from 'cors';

export const app = express();

app.use(cors());
app.use(express.json());

app.get('/api/v1/hello', (req, res) => {
  res.json({ message: 'Hello from the backend!' });
});