import { Router } from 'express';

// 建立 Web 路由
export function createWebRouter(): Router {
  const router = Router();
  // 首頁路由
  router.get('/', (req, res) => {
    res.send('Hello World!');
  });
  return router;
}
