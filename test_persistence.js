import JobService from './server/services/JobService.js';
import fs from 'fs';
import path from 'path';

const JOBS_FILE = path.resolve('jobs.json');
const TEST_FILE = path.resolve('output/test_recover.txt');

async function runTest() {
    console.log("Starting Persistence Test...");

    // 1. Clean up previous test artifacts
    if (fs.existsSync(JOBS_FILE)) fs.unlinkSync(JOBS_FILE);
    if (fs.existsSync(TEST_FILE)) fs.unlinkSync(TEST_FILE);

    // Reset JobService (it's a singleton, so we might need to manually clear if it already loaded)
    JobService.jobs.clear();

    // 2. Create a Job
    console.log("Creating a job...");
    const job = JobService.createJob('test-id-1', 'test-client', {
        originalname: 'test.mp4',
        path: '/tmp/test.mp4',
        size: 1024
    });

    // 3. Verify jobs.json exists
    if (fs.existsSync(JOBS_FILE)) {
        console.log("PASS: jobs.json created.");
        const content = fs.readFileSync(JOBS_FILE, 'utf8');
        if (content.includes('test-id-1')) {
            console.log("PASS: Job data found in jobs.json.");
        } else {
            console.error("FAIL: Job data missing from jobs.json.");
        }
    } else {
        console.error("FAIL: jobs.json not created.");
    }

    // 4. Test Recovery
    console.log("Testing Recovery...");
    // Create a dummy file in output
    if (!fs.existsSync('output')) fs.mkdirSync('output');
    fs.writeFileSync(TEST_FILE, 'dummy content');

    // Trigger scan
    await JobService.scanOutputDirectory();

    // Check if recovered job exists
    const jobs = JobService.getAllJobs();
    const recovered = jobs.find(j => j.inputPath === TEST_FILE);

    if (recovered) {
        console.log("PASS: Recovered job found.");
        if (recovered.clientId === 'recovered') {
             console.log("PASS: Recovered job has correct clientId.");
        } else {
             console.error(`FAIL: Recovered job has wrong clientId: ${recovered.clientId}`);
        }
    } else {
        // scanOutputDirectory only recovers video/audio/images
        // Wait, I added logic to skip others?
        // Let's check JobService.js
        // const isVideo = ...
        // const isAudio = ...
        // if (!isVideo && !isAudio) continue;

        console.log("NOTE: .txt file might be skipped by scanOutputDirectory. Retrying with .mp4");

        const TEST_VIDEO = path.resolve('output/test_recover.mp4');
        fs.writeFileSync(TEST_VIDEO, 'dummy video content');

        await JobService.scanOutputDirectory();

        const recoveredVideo = JobService.getAllJobs().find(j => j.inputPath === TEST_VIDEO);

        if (recoveredVideo) {
            console.log("PASS: Recovered video job found.");
            // Clean up
            fs.unlinkSync(TEST_VIDEO);
        } else {
             console.error("FAIL: Recovered video job NOT found.");
        }

        // Test Text File Recovery specifically
        const TEST_TXT = path.resolve('output/test_recover.txt');
        fs.writeFileSync(TEST_TXT, 'dummy text content');

        await JobService.scanOutputDirectory();

        const recoveredText = JobService.getAllJobs().find(j => j.inputPath === TEST_TXT);

        if (recoveredText) {
             console.log("PASS: Recovered text job found.");
             if (recoveredText.mode === 'transcription') {
                 console.log("PASS: Recovered text job has correct mode 'transcription'.");
             } else {
                 console.error(`FAIL: Recovered text job has wrong mode: ${recoveredText.mode}`);
             }
             fs.unlinkSync(TEST_TXT);
        } else {
             console.error("FAIL: Recovered text job NOT found.");
        }
    }

    // Clean up
    if (fs.existsSync(TEST_FILE)) fs.unlinkSync(TEST_FILE);
    if (fs.existsSync(JOBS_FILE)) fs.unlinkSync(JOBS_FILE); // Optional: keep to inspect
    console.log("Test Complete.");
}

runTest();
