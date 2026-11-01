/**
 * 建立全域錯誤處理中介層,捕捉所有未處理的錯誤,並回傳 500 錯誤給客戶端
  * 這裡使用 express 的 ErrorRequestHandler 型別,以符合 express 的中介層規範
 */

import { type Request, type Response, type ErrorRequestHandler } from 'express'; // Express 框架

export function createErrorHandler(): ErrorRequestHandler {
  return (err: unknown, req: Request, res: Response, next) => {
    console.error('請求處理錯誤:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: '伺服器內部錯誤' });
    } else {
      next(err);
    }
  };
}
// 也可以直接 export const errorHandler: ErrorRequestHandler = (err, req, res, next) => { ... }
export const errorHandler: ErrorRequestHandler = (err: unknown, req: Request, res: Response, next) => {
  console.error('請求處理錯誤:', err);
  if (!res.headersSent) {
    res.status(500).json({ error: '伺服器內部錯誤' });
  } else {
    next(err);
  }
};
