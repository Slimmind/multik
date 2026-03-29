import jobService from './JobService.ts';
import ffmpegService from './FFmpegService.ts';
import transcriptionService from './TranscriptionService.ts';
import socketHandler from '../socket/SocketHandler.ts';
import fs from 'fs';
import path from 'path';
import { unlink } from 'node:fs/promises';

class QueueService {
	private isConverting: boolean;

	constructor() {
		this.isConverting = false;
	}

	processQueue(): void {
		if (this.isConverting) return;

		const nextJob = jobService.getNextQueuedJob();
		if (!nextJob) return;

		this.startConversion(nextJob);
	}

	cancelJob(jobId: string): boolean {
		const job = jobService.getJob(jobId);
		if (!job) return false;

		console.log(`QueueService: Cancelling job ${jobId}, status: ${job.status}`);

		if (job.status === 'processing') {
			job.status = 'cancelled';

			if (job.process) {
				console.log(`QueueService: Killing process for job ${job.id}`);
				try {
					if (typeof job.process.kill === 'function') {
						job.process.kill('SIGKILL');
					} else if (job.process.pid) {
						process.kill(job.process.pid, 'SIGKILL');
					}
				} catch (e) {
					console.error(`QueueService: Failed to kill process:`, e);
				}
			}
			return true;
		} else if (job.status === 'queued') {
			job.status = 'cancelled';
			if (job.inputPath) {
				fs.unlink(job.inputPath, () => {});
			}
			return true;
		}

		return false;
	}

	private startConversion(job: any): void {
		this.isConverting = true;
		job.status = 'processing';
		job.startTime = Date.now();

		socketHandler.emitToClient(job.clientId, 'status_change', {
			id: job.id,
			status: 'processing',
		});

		const onProgress = (progress: number) => {
			if (job.status === 'cancelled') return;
			job.progress = progress;
			socketHandler.emitToClient(job.clientId, 'progress', {
				id: job.id,
				progress,
			});
		};

		const onComplete = (url: string, ratio: number | null) => {
			if (job.status === 'cancelled') {
				this.isConverting = false;
				this.processQueue();
				return;
			}
			this.isConverting = false;
			job.status = 'completed';
			job.progress = 100;
			job.url = url;
			job.compressionRatio = ratio || 0;
			job.endTime = Date.now();

			let duration: string | null = null;
			if (job.startTime) {
				const ms = job.endTime - job.startTime;
				const totalSeconds = Math.floor(ms / 1000);
				const hours = Math.floor(totalSeconds / 3600);
				const minutes = Math.floor((totalSeconds % 3600) / 60);
				const seconds = totalSeconds % 60;

				const pad = (num: number) => num.toString().padStart(2, '0');
				duration = `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
				job.duration = duration;
			}

			console.log(`Job completed. Ratio: ${ratio}% Duration: ${duration}`);
			socketHandler.emitToClient(job.clientId, 'complete', {
				id: job.id,
				url,
				compressionRatio: ratio,
				duration,
			});
			this.processQueue();
		};

		const onError = (errorType: string, message?: string) => {
			this.isConverting = false;
			if (errorType === 'cancelled' || job.status === 'cancelled') {
				job.status = 'cancelled';
				console.log('Job cancelled');
			} else {
				job.status = 'error';
				job.error = 'Обработка не удалась';
				socketHandler.emitToClient(job.clientId, 'error', {
					id: job.id,
					message: 'Обработка не удалась',
				});
			}
			this.processQueue();
		};

		const onStatus = (status: string) => {
			if (job.status === 'cancelled') return;
			socketHandler.emitToClient(job.clientId, 'status_change', {
				id: job.id,
				status: 'processing',
				subStatus: status,
			});
		};

		try {
			if (job.mode === 'transcription') {
				transcriptionService.transcribe(
					job,
					onProgress,
					onComplete,
					onError,
					onStatus,
				);
			} else if (job.mode === 'complex') {
				this.startComplexProcessing(
					job,
					onProgress,
					onComplete,
					onError,
					onStatus,
				);
			} else {
				ffmpegService.convert(job, onProgress, onComplete, onError);
			}
		} catch (e) {
			console.error(`Failed to start job ${job.id}:`, e);
			this.isConverting = false;
			job.status = 'error';
			job.error = 'Сбой запуска';
			socketHandler.emitToClient(job.clientId, 'error', {
				id: job.id,
				message: 'Сбой запуска обработки',
			});
			this.processQueue();
		}
	}

	private async startComplexProcessing(
		job: any,
		onProgress: (progress: number) => void,
		onComplete: (url: string, ratio: number | null) => void,
		onError: (errorType: string, message?: string) => void,
		onStatus: (status: string) => void,
	): Promise<void> {
		console.log(`Starting complex processing for job ${job.id}`);

		// Step 1: Convert video to MP4
		onStatus('converting_to_mp4');

		const mp4Complete = async (url: string, ratio: number | null) => {
			if (job.status === 'cancelled') return;

			console.log(`Complex step 1/3 complete: MP4 conversion`);
			console.log(`MP4 URL: ${url}, Full path: ${path.resolve('.' + url)}`);
			job.mp4Url = url;
			job.progress = 0;
			socketHandler.emitToClient(job.clientId, 'complex_progress', {
				id: job.id,
				stage: 'mp4',
				url,
			});
			socketHandler.emitToClient(job.clientId, 'progress', {
				id: job.id,
				progress: 0,
			});

			// Step 2: Extract audio from MP4
			onStatus('extracting_audio');
			const mp4Path = path.resolve('.' + url);
			console.log(`Setting inputPath for step 2: ${mp4Path}`);
			const fileExists = await Bun.file(mp4Path).exists();
			console.log(`MP4 file exists: ${fileExists}`);
			if (!fileExists) {
				console.error(`MP4 file not found at ${mp4Path}`);
				onError('failed', 'MP4 file not found after conversion');
				return;
			}
			job.inputPath = mp4Path;
			job.originalSize = Bun.file(mp4Path).size;
			console.log(`Starting step 2: Audio extraction from ${mp4Path}`);

			const audioComplete = async (
				audioUrl: string,
				audioRatio: number | null,
			) => {
				if (job.status === 'cancelled') return;

				console.log(`Complex step 2/3 complete: Audio extraction`);
				job.mp3Url = audioUrl;
				job.progress = 0;
				socketHandler.emitToClient(job.clientId, 'complex_progress', {
					id: job.id,
					stage: 'mp3',
					url: audioUrl,
				});
				socketHandler.emitToClient(job.clientId, 'progress', {
					id: job.id,
					progress: 0,
				});

				// Step 3: Transcribe audio
				onStatus('transcribing_audio');
				job.inputPath = path.resolve('.' + audioUrl);
				job.originalSize = (await Bun.file(job.inputPath).exists())
					? Bun.file(job.inputPath).size
					: job.originalSize;

				transcriptionService.transcribe(
					job,
					onProgress,
					onComplete,
					onError,
					onStatus,
				);
			};

			const audioError = (errorType: string, message?: string) => {
				if (errorType === 'cancelled') {
					onError('cancelled');
				} else {
					console.error('Complex step 2/3 failed:', message);
					onError('failed', message);
				}
			};

			ffmpegService.convert(job, onProgress, audioComplete, audioError);
		};

		const mp4Error = (errorType: string, message?: string) => {
			if (errorType === 'cancelled') {
				onError('cancelled');
			} else {
				console.error('Complex step 1/3 failed:', message);
				onError('failed', message);
			}
		};

		ffmpegService.convert(job, onProgress, mp4Complete, mp4Error);
	}
}

export default new QueueService();
