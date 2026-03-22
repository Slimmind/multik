#!/usr/bin/env python3
"""
Audio Transcription Script using whisper.cpp
Wrapper for Raspberry Pi / Ubuntu (ARM)
"""

import argparse
import subprocess
import sys
import os
import time
from pathlib import Path
import multiprocessing

# --- НАСТРОЙКИ ПУТЕЙ ---
WHISPER_CPP_DIR = Path("/home/slim/whisper.cpp").resolve()
MODELS_DIR = WHISPER_CPP_DIR / "models"
MAIN_BINARY = None  # Будет найдено автоматически

AUDIO_EXTENSIONS = {".mp3", ".wav", ".m4a", ".flac", ".ogg", ".wma", ".aac", ".opus"}

MODEL_MAP = {
    "tiny":   ("ggml-tiny.bin",   "tiny"),
    "base":   ("ggml-base.bin",   "base"),
    "small":  ("ggml-small.bin",  "small"),
    "medium": ("ggml-medium.bin", "medium"),
    "large":  ("ggml-large-v3.bin", "large"),
}

def find_whisper_binary():
    """Поиск исполняемого файла whisper.cpp."""
    candidates = [
        WHISPER_CPP_DIR / "build" / "bin" / "whisper-cli",  # Новое имя
        WHISPER_CPP_DIR / "build" / "bin" / "main",          # Старое имя
        WHISPER_CPP_DIR / "whisper-cli",
        WHISPER_CPP_DIR / "main",
    ]
    for path in candidates:
        if path.exists() and os.access(path, os.X_OK):
            return path
    return None

def check_setup():
    """Проверка наличия бинарника и моделей."""
    global MAIN_BINARY
    MAIN_BINARY = find_whisper_binary()

    if not MAIN_BINARY:
        print(f"❌ Ошибка: Не найден исполняемый файл whisper.cpp")
        print(f"💡 Попробуйте перекомпилировать:")
        print(f"   cd {WHISPER_CPP_DIR} && cmake -B build -DGGML_NATIVE=OFF && cmake --build build --config Release")
        sys.exit(1)

    print(f"✅ Бинарник найден: {MAIN_BINARY}")

    if not MODELS_DIR.exists():
        print(f"❌ Ошибка: Не найдена папка моделей: {MODELS_DIR}")
        sys.exit(1)

def wait_for_file_complete(file_path: Path, timeout=60, interval=1):
    """Ждем, пока файл перестанет расти (завершится загрузка)."""
    if not file_path.exists():
        return False
    
    last_size = -1
    waited = 0
    stable_count = 0  # Счетчик стабильных проверок
    
    while waited < timeout:
        try:
            current_size = file_path.stat().st_size
            
            if current_size == last_size and current_size > 0:
                stable_count += 1
                if stable_count >= 2:  # Файл не меняется 2 проверки подряд
                    time.sleep(0.5)  # Небольшая страховка
                    return True
            else:
                stable_count = 0
            
            last_size = current_size
        except FileNotFoundError:
            return False
        
        time.sleep(interval)
        waited += interval
    
    print(f"⚠ Таймаут ожидания файла ({timeout}с). Пробуем обработать...")
    return True

def get_audio_duration(input_path: Path) -> float:
    """Получение длительности аудиофайла в секундах."""
    try:
        probe_cmd = [
            "ffprobe", "-v", "error", "-show_entries", "format=duration",
            "-of", "default=noprint_wrappers=1:nokey=1", str(input_path)
        ]
        probe_res = subprocess.run(probe_cmd, capture_output=True, text=True, timeout=10)
        return float(probe_res.stdout.strip())
    except Exception as e:
        print(f"   ⚠ Ошибка получения длительности: {e}")
        return 0.0

def split_audio_into_chunks(input_path: Path, chunk_duration: int = 900, verbose: bool = False) -> list:
    """
    Разбиение аудиофайла на части через ffmpeg.
    chunk_duration: длительность чанка в секундах (по умолчанию 15 минут = 900с)
    Возвращает список путей к чанкам.
    """
    temp_dir = input_path.parent / f"_chunks_{input_path.stem}"
    temp_dir.mkdir(exist_ok=True)
    
    chunk_pattern = temp_dir / f"chunk_%03d.wav"
    
    print(f"   ✂️ Разбиение на чанки по {chunk_duration}с...")
    
    # Конвертируем в WAV (16kHz, mono) — формат для whisper.cpp
    # Используем -acodec pcm_s16le для корректного WAV-заголовка
    cmd = [
        "ffmpeg", "-y", "-i", str(input_path),
        "-f", "segment",
        "-segment_time", str(chunk_duration),
        "-ar", "16000",
        "-ac", "1",
        "-acodec", "pcm_s16le",
        "-reset_timestamps", "1",
        "-avoid_negative_ts", "make_zero",
        str(chunk_pattern)
    ]
    
    if verbose:
        print(f"   ⚙ {' '.join(cmd)}")
    
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
        if result.returncode != 0:
            print(f"   ❌ Ошибка разбиения ffmpeg")
            if verbose:
                print(f"   stderr: {result.stderr[:500]}")
            return []
        
        chunks = sorted(temp_dir.glob("chunk_*.wav"))
        if not chunks:
            print(f"   ❌ Чанки не созданы")
            if verbose:
                print(f"   📁 Содержимое папки: {list(temp_dir.iterdir())}")
            return []
        
        # Проверка размера чанков
        for chunk in chunks:
            size = chunk.stat().st_size
            if size == 0:
                print(f"   ⚠ Пустой чанк: {chunk.name}")
        
        print(f"   ✅ Создано чанков: {len(chunks)}")
        return chunks
    except subprocess.TimeoutExpired:
        print(f"   ❌ Таймаут при разбиении аудио")
        return []
    except Exception as e:
        print(f"   ❌ Исключение при разбиении: {e}")
        return []

def cleanup_chunks(chunks: list):
    """Удаление временных чанков."""
    if not chunks:
        return
    temp_dir = chunks[0].parent
    try:
        import shutil
        shutil.rmtree(temp_dir)
        print(f"   🧹 Чанки удалены")
    except Exception as e:
        print(f"   ⚠ Не удалось удалить чанки: {e}")

def transcribe_chunk(chunk_path: Path, output_path: Path, model_name: str, language: str, verbose: bool) -> bool:
    """Транскрибация одного чанка."""
    if model_name not in MODEL_MAP:
        return False

    model_file, model_arg = MODEL_MAP[model_name]
    model_path = MODELS_DIR / model_file

    if not model_path.exists():
        print(f"   ❌ Модель не найдена: {model_path}")
        return False

    # --no-gpu и --no-flash-attn для Raspberry Pi
    cmd = [
        str(MAIN_BINARY),
        "-m", str(model_path),
        "-f", str(chunk_path),
        "-l", language,
        "-otxt",
        "-of", str(output_path.with_suffix('')),
        "--no-timestamps",
        "-t", str(multiprocessing.cpu_count()),
        "--no-gpu",
        "--no-flash-attn"
    ]

    if verbose:
        print(f"   ⚙ {' '.join(cmd)}")

    try:
        # 30 минут на чанк (для Raspberry Pi)
        result = subprocess.run(cmd, capture_output=True, text=True, check=False, timeout=1800)

        if result.returncode == 0:
            return True
        else:
            print(f"   ❌ Ошибка whisper.cpp (код {result.returncode})")
            # Выводим больше информации об ошибке
            stderr_output = result.stderr.strip() if result.stderr else "нет stderr"
            stdout_output = result.stdout.strip() if result.stdout else "нет stdout"
            print(f"   stderr: {stderr_output[:500]}")
            print(f"   stdout: {stdout_output[:500]}")
            return False

    except subprocess.TimeoutExpired:
        print(f"   ❌ Таймаут транскрибации чанка")
        return False
    except Exception as e:
        print(f"   ❌ Исключение: {e}")
        return False

def transcribe_file(input_path: Path, output_path: Path, model_name: str, language: str, verbose: bool):
    """Вызов whisper.cpp для одного файла (с разбиением на чанки для длинных файлов)."""

    if model_name not in MODEL_MAP:
        print(f"❌ Неизвестная модель: {model_name}")
        return False

    model_file, model_arg = MODEL_MAP[model_name]
    model_path = MODELS_DIR / model_file

    if not model_path.exists():
        print(f"❌ Модель не найдена: {model_path}")
        print(f"💡 Скачайте: cd {WHISPER_CPP_DIR} && bash models/download-ggml-model.sh {model_arg}")
        return False

    # 1. Ждем завершения загрузки файла
    print(f"   ⏳ Ожидание готовности файла...")
    if not wait_for_file_complete(input_path, timeout=60):
        print(f"   ❌ Файл не найден")
        return False

    # 2. Получаем длительность
    print(f"[STATUS] processing", flush=True)
    duration = get_audio_duration(input_path)
    print(f"[DURATION] {duration}", flush=True)
    
    if duration <= 0:
        print(f"   ⚠ Не удалось получить длительность, пробуем обработать как есть...")

    # 3. Решаем, нужно ли разбиение (порог 15 минут = 900с)
    CHUNK_DURATION = 300  # 5 минут для теста
    needs_splitting = duration > CHUNK_DURATION
    
    if needs_splitting:
        print(f"   📊 Длительность {duration:.0f}с > {CHUNK_DURATION}с, используем разбиение...")
        
        chunks = split_audio_into_chunks(input_path, chunk_duration=CHUNK_DURATION, verbose=verbose)
        if not chunks:
            print(f"   ❌ Не удалось разбить файл, пробуем обработать целиком...")
            needs_splitting = False
        else:
            # Транскрибируем каждый чанк
            all_results = []
            for i, chunk in enumerate(chunks, 1):
                print(f"   🎯 Чанк {i}/{len(chunks)}: {chunk.name} ({chunk.stat().st_size} байт)...", flush=True)
                chunk_output = output_path.parent / f"_chunk_{i}.txt"
                
                if transcribe_chunk(chunk, chunk_output, model_name, language, verbose):
                    all_results.append(chunk_output)
                else:
                    print(f"   ⚠ Чанк {i} не обработан")
                    cleanup_chunks(chunks)
                    return False
            
            # Склеиваем результаты
            try:
                with open(output_path, 'w', encoding='utf-8') as outfile:
                    for chunk_output in all_results:
                        with open(chunk_output, 'r', encoding='utf-8') as infile:
                            outfile.write(infile.read())
                            outfile.write("\n")
                        chunk_output.unlink()  # Удаляем временный файл
                
                print(f"   ✅ Чанки склеены")
                cleanup_chunks(chunks)
                return True
            except Exception as e:
                print(f"   ❌ Ошибка склейки: {e}")
                cleanup_chunks(chunks)
                return False
    
    # 4. Обработка без разбиения (короткий файл)
    # --no-gpu и --no-flash-attn для Raspberry Pi
    cmd = [
        str(MAIN_BINARY),
        "-m", str(model_path),
        "-f", str(input_path),
        "-l", language,
        "-otxt",
        "-of", str(output_path.with_suffix('')),
        "--no-timestamps",
        "-t", str(multiprocessing.cpu_count()),
        "--no-gpu",
        "--no-flash-attn"
    ]

    if verbose:
        print(f"   ⚙ {' '.join(cmd)}")

    try:
        # Увеличено время ожидания с 600 до 7200 секунд (2 часа) для Raspberry Pi
        result = subprocess.run(cmd, capture_output=True, text=True, check=False, timeout=7200)

        if result.returncode == 0:
            if verbose:
                print(f"   ✅ Успешно")
            return True
        else:
            print(f"   ❌ Ошибка whisper.cpp (код {result.returncode})")
            if verbose and result.stderr:
                print(f"   {result.stderr.strip()[:500]}")
            return False

    except subprocess.TimeoutExpired:
        print(f"   ❌ Таймаут транскрибации")
        return False
    except Exception as e:
        print(f"   ❌ Исключение: {e}")
        return False

def get_audio_files(directory: Path):
    """Возвращает отсортированный список аудиофайлов."""
    if not directory.is_dir():
        return []
    files = [f for f in directory.iterdir() if f.is_file() and f.suffix.lower() in AUDIO_EXTENSIONS]
    return sorted(files)

def main():
    parser = argparse.ArgumentParser(description="🎙️ Транскрибация аудио (whisper.cpp wrapper)")
    parser.add_argument("--file", type=str, required=True, help="▶ Путь к файлу или директории")
    parser.add_argument("--lang", type=str, default="ru", help='▷ Язык')
    parser.add_argument("--output", type=str, default="transcription.txt", help='★ Имя выходного файла')
    parser.add_argument("--multiple", action="store_true", help="★ Обработать директорию")
    parser.add_argument("--live", action="store_true", help="▢ Подробный вывод")
    parser.add_argument("--model", type=str, default="base", choices=list(MODEL_MAP.keys()), help="🧠 Модель")
    parser.add_argument("--wait-time", type=int, default=60, help="⏳ Макс. время ожидания загрузки файла (сек)")

    args = parser.parse_args()
    check_setup()

    print(f"\n★ whisper.cpp Wrapper | Модель: {args.model} | Язык: {args.lang}")
    print(f"📂 Путь: {WHISPER_CPP_DIR}\n")

    targets = []
    input_path = Path(args.file)

    if args.multiple:
        if not input_path.is_dir():
            print(f"❌ Путь '{input_path}' не является директорией.")
            sys.exit(1)
        files = get_audio_files(input_path)
        if not files:
            print("❌ Аудиофайлы не найдены.")
            sys.exit(1)
        for f in files:
            targets.append((f, f.with_suffix('.txt')))
        print(f"▢ Найдено файлов: {len(targets)}")
    else:
        if not input_path.exists():
            print(f"❌ Файл '{input_path}' не найден.")
            sys.exit(1)
        targets.append((input_path, Path(args.output)))

    print(f"🚀 Старт обработки...\n")

    success_count = 0
    for i, (inp, out) in enumerate(targets, 1):
        prefix = f"[{i}/{len(targets)}]"
        print(f"{prefix} {inp.name}...", flush=True)
        
        if transcribe_file(inp, out, args.model, args.lang, args.live):
            success_count += 1
        else:
            print(f"   ⚠ Пропущено из-за ошибки.")

    print(f"\n✅ Готово: {success_count}/{len(targets)} завершено.")

if __name__ == "__main__":
    main()