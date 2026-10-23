import express, { type Express, type Request, type Response } from 'express';

const app: Express = express();

app.get('/', (req: Request, res: Response) => {
  res.send('Hello World!');
});

const localUrl = `http://localhost:3000`;
app.listen(3000, () => {
  console.log(`⚡️[server]: Server is running at ${localUrl}`);
});
