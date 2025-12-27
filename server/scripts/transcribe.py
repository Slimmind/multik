#!/usr/bin/env python3

"""
Audio Transcription Script using OpenAI Whisper
Transcribes single file or batch-processes all audio files in a directory.
Supports Sequential (accurate) and Chunked (fast, parallel) modes.
"""

import torch
import whisper
import argparse
from pathlib import Path
import math
import numpy as np
import multiprocessing
from concurrent.futures import ProcessPoolExecutor, as_completed

# Поддерживаемые аудио-расширения
AUDIO_EXTENSIONS = {".mp3", ".wav", ".m4a", ".flac", ".ogg", ".wma", ".aac", ".opus"}

def get_audio_files(directory: Path, extensions=None):
    """Возвращает отсортированный список аудиофайлов в директории (без рекурсии)."""
    extensions = extensions or AUDIO_EXTENSIONS
    files = [f for f in directory.iterdir() if f.is_file() and f.suffix.lower() in extensions]
    return sorted(files)

# --- Chunked Processing Logic ---

worker_model = None

def _init_worker(model_name):
    """Инициализация воркера: загрузка модели один раз на процесс."""
    global worker_model
    # print(f"[WORKER] Загрузка модели {model_name} в процессе {multiprocessing.current_process().name}...")
    worker_model = whisper.load_model(model_name)

def _process_chunk(chunk_data, language):
    """Обработка одного куска аудио в отдельном процессе."""
    # chunk_data - numpy array
    global worker_model
    try:
        # Для whisper.transcribe нужен float32 numpy array
        result = worker_model.transcribe(chunk_data, language=language)
        return result["text"].strip()
    except Exception as e:
        return f"[ERROR: {e}]"

def transcribe_file_chunked(audio_path: Path, model_name, language, chunk_size_sec=60, workers=2, verbose=False, output_path=None):
    """Транскрибация файла по кускам (параллельно)."""
    try:
        print(f"[STATUS] PREPARING CHUNKED ({workers} workers, {chunk_size_sec}s chunks)", flush=True)
        print(f"⚙ Транскрибация: {audio_path.name}", flush=True)

        # 1. Загружаем аудио целиком
        audio = whisper.load_audio(str(audio_path))
        sample_rate = whisper.audio.SAMPLE_RATE
        total_duration = audio.shape[0] / sample_rate
        print(f"[DURATION] {total_duration:.2f}s", flush=True)

        if total_duration < chunk_size_sec:
             # Если файл короче куска, проще обработать последовательно (но через ту же логику)
             chunks = [audio]
        else:
            # 2. Разбиваем на куски
            chunk_samples = int(chunk_size_sec * sample_rate)
            chunks = []
            for i in range(0, len(audio), chunk_samples):
                chunks.append(audio[i : i + chunk_samples])
            print(f"[CHUNKS] Файл разбит на {len(chunks)} частей", flush=True)

        # 3. Запускаем параллельную обработку
        # Используем ProcessPoolExecutor
        full_text_parts = [None] * len(chunks)

        # NOTE: max_workers не должен превышать количество чанков, иначе зря поднимем процессы
        actual_workers = min(workers, len(chunks))

        with ProcessPoolExecutor(max_workers=actual_workers, initializer=_init_worker, initargs=(model_name,)) as executor:
            futures = {}
            for i, chunk in enumerate(chunks):
                future = executor.submit(_process_chunk, chunk, language)
                futures[future] = i

            for future in as_completed(futures):
                idx = futures[future]
                try:
                    text_part = future.result()
                    full_text_parts[idx] = text_part
                    if verbose:
                        print(f"  [Chunk {idx+1}/{len(chunks)}] ok")
                except Exception as e:
                     print(f"❌ Ошибка в куске {idx+1}: {e}")
                     full_text_parts[idx] = ""

        final_text = " ".join([t for t in full_text_parts if t])

        if output_path:
            output_path.write_text(final_text, encoding="utf-8")
            print(f"✅ Сохранено: {output_path}", flush=True)
        return True

    except Exception as e:
        print(f"❌ Ошибка при CHUNKED обработке {audio_path}: {e}", flush=True)
        # import traceback
        # traceback.print_exc()
        return False


def transcribe_file_sequential(model, audio_path: Path, language, verbose=False, output_path=None):
    """Обычная последовательная транскрибация (максимальная точность контекста)."""
    try:
        print(f"[STATUS] PREPARING SEQUENTIAL", flush=True)
        print(f"⚙ Транскрибация: {audio_path.name}", flush=True)

        # Загружаем аудио сами для расчета длительности
        audio = whisper.load_audio(str(audio_path))
        duration = audio.shape[0] / whisper.audio.SAMPLE_RATE
        print(f"[DURATION] {duration:.2f}s", flush=True)

        result = model.transcribe(audio, language=language, verbose=verbose)
        text = result["text"].strip()

        if output_path:
            output_path.write_text(text, encoding="utf-8")
            print(f"✅ Сохранено: {output_path}", flush=True)
        return True
    except Exception as e:
        print(f"❌ Ошибка при обработке {audio_path}: {e}", flush=True)
        return False


def main():
    parser = argparse.ArgumentParser(description="🎙️ Транскрибация аудио (Sequential / Chunked)")

    parser.add_argument(
        "--file", type=str,
        help="▶ Путь к аудиофайлу или директории"
    )
    parser.add_argument(
        "--lang", type=str, default="ru",
        help='▷ Язык аудио (по умолчанию: "ru")'
    )
    parser.add_argument(
        "--output", type=str, default="transcribe.txt",
        help='★ Файл для сохранения (для одиночного режима)'
    )
    parser.add_argument(
        "--live", action="store_true", default=False,
        help="▢ Вывод процесса (verbose)"
    )
    parser.add_argument(
        "--multiple", action="store_true", default=False,
        help="★ Обработать директорию"
    )

    # Новые аргументы
    parser.add_argument(
        "--method", type=str, choices=["sequential", "chunked"], default="sequential",
        help="⚙ Метод обработки: sequential (точно, медленно) или chunked (быстро, параллельно)"
    )
    parser.add_argument(
        "--workers", type=int, default=2,
        help="⚡ Кол-во процессов для chunked режима (по умолчанию: 2)"
    )
    parser.add_argument(
        "--chunk_size", type=int, default=60,
        help="✂ Размер куска в секундах для chunked режима (по умолчанию: 60)"
    )
    parser.add_argument(
        "--model", type=str, default="small",
        help="🧠 Модель whisper (tiny, base, small, medium, large)"
    )

    args = parser.parse_args()

    # Настройка метода запуска для multiprocessing
    # Whisper/Torch + Multiprocessing иногда вызывают проблемы с 'fork'. 'spawn' безопаснее.
    try:
        multiprocessing.set_start_method('spawn')
    except RuntimeError:
        pass # Уже установлено

    # Sequential требует загрузку модели В ГЛАВНОМ потоке
    # Chunked загружает модель В ВОКЕРАХ
    model = None
    if args.method == "sequential":
        print(f"⋯ Загрузка модели '{args.model}' (Main Process)...")
        model = whisper.load_model(args.model)
    else:
        print(f"ℹ В режиме Chunked модель '{args.model}' будет загружена в каждом из {args.workers} воркеров.")

    language = args.lang or None

    # --- Логика выбора файлов ---
    targets = []
    if args.multiple:
        directory = Path(args.file) if args.file else Path(".")
        if directory.is_dir():
            files = get_audio_files(directory)
            for f in files:
                targets.append((f, f.with_suffix(".txt")))
            print(f"▢ Найдено файлов: {len(targets)}")
        else:
            print("❌ Указанный путь не директория")
            return
    else:
        if not args.file:
             parser.error("--file обязателен")
        p = Path(args.file)
        if p.exists():
             targets.append((p, Path(args.output)))
        else:
             print("❌ Файл не найден")
             return

    print(f"\n★ Старт обработки: {len(targets)} файлов | Метод: {args.method.upper()}\n")

    success_count = 0
    for i, (inp, out) in enumerate(targets, 1):
        print(f"▷ [{i}/{len(targets)}] {inp.name}")

        ok = False
        if args.method == "sequential":
             ok = transcribe_file_sequential(model, inp, language, verbose=args.live, output_path=out)
        else:
             ok = transcribe_file_chunked(
                 inp,
                 model_name=args.model,
                 language=language,
                 chunk_size_sec=args.chunk_size,
                 workers=args.workers,
                 verbose=args.live,
                 output_path=out
             )

        if ok: success_count += 1

    print(f"\n✅ Готово: {success_count}/{len(targets)} завершено.")

if __name__ == "__main__":
    main()