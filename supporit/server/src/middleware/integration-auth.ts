import { Request, Response, NextFunction } from 'express';

export interface IntegrationRequest extends Request {
  integrationSource?: string;
}

/**
 * Middleware для аутентификации внешних интеграций по API-токену
 * Используется для M2M (machine-to-machine) взаимодействия с HR_desk и другими системами
 */
export const authenticateIntegration = (
  req: IntegrationRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      console.log('[Integration Auth] ❌ Токен не предоставлен для', req.method, req.path);
      return res.status(401).json({ error: 'Токен интеграции не предоставлен' });
    }

    // Проверяем токен HR_desk
    const hrDeskToken = process.env.HR_DESK_API_TOKEN;
    if (hrDeskToken && token === hrDeskToken) {
      req.integrationSource = 'hr_desk';
      console.log('[Integration Auth] ✅ HR_desk интеграция авторизована');
      return next();
    }

    // Проверяем общий токен интеграции (для других систем)
    const integrationToken = process.env.INTEGRATION_API_TOKEN;
    if (integrationToken && token === integrationToken) {
      req.integrationSource = 'external';
      console.log('[Integration Auth] ✅ Внешняя интеграция авторизована');
      return next();
    }

    console.log('[Integration Auth] ❌ Недействительный токен интеграции');
    return res.status(401).json({ error: 'Недействительный токен интеграции' });
  } catch (error) {
    console.log('[Integration Auth] ❌ Ошибка аутентификации:', error instanceof Error ? error.message : error);
    return res.status(401).json({ error: 'Ошибка аутентификации' });
  }
};

/**
 * Проверяет, что запрос пришел от конкретного источника интеграции
 */
export const requireIntegrationSource = (...sources: string[]) => {
  return (req: IntegrationRequest, res: Response, next: NextFunction) => {
    if (!req.integrationSource) {
      return res.status(401).json({ error: 'Источник интеграции не определен' });
    }

    if (!sources.includes(req.integrationSource)) {
      return res.status(403).json({ 
        error: 'Недостаточно прав для данной операции',
        allowed_sources: sources 
      });
    }

    next();
  };
};
