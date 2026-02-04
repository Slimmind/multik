import fs from 'fs';

class SystemController {
  getSystemInfo(req, res) {
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

    // For testing purposes, you can uncomment this to simulate RPi
    // isRPi = true;

    res.json({ isRPi });
  }
}

export default new SystemController();
