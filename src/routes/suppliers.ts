import { Router, Request, Response } from 'express';
import { supplierAData, supplierBData } from '../data/suppliers';

export const supplierRouter = Router();

supplierRouter.get('/supplierA/hotels', (req: Request, res: Response) => {
  if (req.headers['x-simulate-failure'] === 'true') {
    return res.status(500).json({ error: 'Simulated failure for Supplier A' });
  }

  const city = req.query.city as string;
  let data = supplierAData;
  if (city) {
    data = data.filter(h => h.city.toLowerCase() === city.toLowerCase());
  }
  
  res.json(data);
});

supplierRouter.get('/supplierB/hotels', (req: Request, res: Response) => {
  if (req.headers['x-simulate-failure'] === 'true') {
    return res.status(500).json({ error: 'Simulated failure for Supplier B' });
  }

  const city = req.query.city as string;
  let data = supplierBData;
  if (city) {
    data = data.filter(h => h.city.toLowerCase() === city.toLowerCase());
  }

  res.json(data);
});
