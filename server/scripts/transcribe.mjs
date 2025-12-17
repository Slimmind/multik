
import { pipeline } from '@xenova/transformers';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import wavefile from 'wavefile';

// Constants
const AUDIO_EXTENSIONS = new Set(['.mp3', '.wav', '.m4a', '.flac', '.ogg', '.wma', '.aac', '.opus']);
const MODEL_NAME = 'Xenova/whisper-small';
const SAMPLE_RATE = 16000;

/**
 * Get all supported audio files in a directory
 */
function getAudioFiles(directory) {
    try {
        const files = fs.readdirSync(directory);
        return files
            .filter(file => {
                const ext = path.extname(file).toLowerCase();
                return AUDIO_EXTENSIONS.has(ext);
            })
            .map(file => path.join(directory, file))
            .sort();
    } catch (err) {
        console.error(`❌ Ошибка чтения директории: ${err.message}`);
        return [];
    }
}

/**
 * Load audio file and convert to Float32Array at 16kHz mono
 * Uses ffmpeg to convert any audio format to WAV, then wavefile to read samples
 */
function loadAudioAsFloat32(audioPath) {
    const tempWav = path.join(path.dirname(audioPath), `_temp_${Date.now()}.wav`);

    try {
        // Convert to 16kHz mono WAV using ffmpeg
        execSync(`ffmpeg -y -i "${audioPath}" -ar ${SAMPLE_RATE} -ac 1 -f wav "${tempWav}"`, {
            stdio: 'pipe'
        });

        // Read WAV file
        const wavBuffer = fs.readFileSync(tempWav);
        const wav = new wavefile.WaveFile(wavBuffer);

        // Convert to Float32Array normalized to -1..1
        wav.toBitDepth('32f');
        const samples = wav.getSamples();

        // getSamples returns Float64Array for 32f, convert to Float32Array
        const float32Samples = new Float32Array(samples.length);
        for (let i = 0; i < samples.length; i++) {
            float32Samples[i] = samples[i];
        }

        return float32Samples;
    } finally {
        // Clean up temp file
        if (fs.existsSync(tempWav)) {
            fs.unlinkSync(tempWav);
        }
    }
}

/**
 * Transcribe a single file
 */
async function transcribeFile(transcriber, audioPath, language) {
    try {
        console.log(`⚙ Транскрибация: ${path.basename(audioPath)}`);

        // Load audio as Float32Array
        console.log(`  ↳ Загрузка аудио...`);
        const audioData = loadAudioAsFloat32(audioPath);
        console.log(`  ↳ Загружено ${audioData.length} сэмплов`);

        // Output options
        const options = {
            chunk_length_s: 30,
            stride_length_s: 5,
            sampling_rate: SAMPLE_RATE,
        };

        if (language) {
            options.language = language;
            options.task = 'transcribe';
        }

        const result = await transcriber(audioData, options);
        const text = result.text.trim();

        const outputPath = path.join(
            path.dirname(audioPath),
            path.basename(audioPath, path.extname(audioPath)) + '.txt'
        );

        fs.writeFileSync(outputPath, text, 'utf-8');
        console.log(`✅ Сохранено: ${path.basename(outputPath)}`);
        return true;
    } catch (err) {
        console.error(`❌ Ошибка при обработке ${path.basename(audioPath)}: ${err.message}`);
        return false;
    }
}

async function main() {
    // Parse arguments simply
    const args = process.argv.slice(2);
    let dir = '';
    let file = '';
    let lang = 'ru';

    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--dir' && args[i + 1]) {
            dir = args[i + 1];
            i++;
        } else if (args[i] === '--file' && args[i + 1]) {
            file = args[i + 1];
            i++;
        } else if (args[i] === '--lang' && args[i + 1]) {
            lang = args[i + 1];
            i++;
        }
    }

    console.log(`⚡ Инициализация Transformers.js...`);
    // Load model
    console.log(`⋯ Загрузка модели '${MODEL_NAME}'...`);
    const transcriber = await pipeline('automatic-speech-recognition', MODEL_NAME);
    console.log(`▷ Язык: ${lang}`);

    const filesToProcess = [];

    if (file) {
        const filePath = path.resolve(file);
        if (!fs.existsSync(filePath)) {
            console.error(`❌ Файл не найден: ${filePath}`);
            process.exit(1);
        }
        filesToProcess.push(filePath);
    } else {
         const directory = path.resolve(dir || '.');
        if (!fs.existsSync(directory) || !fs.lstatSync(directory).isDirectory()) {
            console.error(`❌ Путь не является директорией: ${directory}`);
            process.exit(1);
        }
        filesToProcess.push(...getAudioFiles(directory));
    }

    if (filesToProcess.length === 0) {
        console.error(`❌ Нет файлов для обработки.`);
        process.exit(1);
    }

    console.log(`▢ Найдено файлов: ${filesToProcess.length}`);
    filesToProcess.forEach(f => console.log(` ├─ ${path.basename(f)}`));

    console.log(`\n★ Начинаем обработку ${filesToProcess.length} файлов...\n`);

    let successCount = 0;
    for (let i = 0; i < filesToProcess.length; i++) {
        const f = filesToProcess[i];
        console.log(`▷ [${i + 1}/${filesToProcess.length}] ▶ Обработка: ${path.basename(f)}`);
        const success = await transcribeFile(transcriber, f, lang);
        if (success) successCount++;
    }

    console.log(`\n✅ Готово: ${successCount}/${filesToProcess.length} файлов обработано.`);
}

main().catch(console.error);
