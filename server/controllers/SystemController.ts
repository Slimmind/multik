import fs from 'fs';
import type { Request, Response } from 'express';

class SystemController {
  getSystemInfo(req: Request, res: Response): void {
    let isRPi = false;
    try {
      if (fs.existsSync('/proc/device-tree/model')) {
        const model = fs.readFileSync('/proc/device-tree/model', 'utf8');
        if (model.includes('Raspberry Pi 4')) {
          isRPi = true;
        }
      }
    } catch (e) {
      console.error('Error checking system info:', e);
    }

    res.json({ isRPi });
  }
}

export default new SystemController();
