#!/usr/bin/env python3

"""
Audio Transcription Script using OpenAI Whisper
Transcribes single file or batch-processes all audio files in a directory.
"""

import torch
import whisper
import argparse
from pathlib import Path

# Поддерживаемые аудио-расширения
AUDIO_EXTENSIONS = {".mp3", ".wav", ".m4a", ".flac", ".ogg", ".wma", ".aac", ".opus"}

def get_audio_files(directory: Path, extensions=None):
    """Возвращает отсортированный список аудиофайлов в директории (без рекурсии)."""
    extensions = extensions or AUDIO_EXTENSIONS
    files = [f for f in directory.iterdir() if f.is_file() and f.suffix.lower() in extensions]
    return sorted(files)


def transcribe_file(model, audio_path: Path, language, verbose=False, output_path=None):
    """Транскрибирует один файл и сохраняет результат."""
    try:
        print(f"[STATUS] PREPARING", flush=True)
        print(f"⚙ Транскрибация: {audio_path.name}", flush=True)

        # Загружаем аудио сами для расчета длительности
        audio = whisper.load_audio(str(audio_path))
        duration = audio.shape[0] / whisper.audio.SAMPLE_RATE
        print(f"[DURATION] {duration:.2f}", flush=True)

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
    parser = argparse.ArgumentParser(description="🎙️ Транскрибация аудио с выводом по кусочкам")

    parser.add_argument(
        "--file", type=str,
        help="▶ Путь к аудиофайлу или директории (опционально, если --multiple)"
    )
    parser.add_argument(
        "--lang", type=str, default="ru",
        help='▷ Язык аудио (по умолчанию: "ru"). Пусто — автоопределение'
    )
    parser.add_argument(
        "--threads", type=int, default=2,
        help="⚡ Количество CPU-потоков (по умолчанию: 2)"
    )
    parser.add_argument(
        "--output", type=str, default="transcribe.txt",
        help='★ Файл для сохранения полного текста (по умолчанию: "transcribe.txt"), игнорируется при --multiple'
    )
    parser.add_argument(
        "--live", action="store_true", default=False,
        help="▢ Выводить каждый распознанный кусочек сразу (в консоль)"
    )
    parser.add_argument(
        "--multiple", action="store_true", default=False,
        help="★ Обработать все аудиофайлы в директории. Без --file — текущая директория."
    )

    args = parser.parse_args()

    # Настройка PyTorch
    torch.set_num_threads(args.threads)
    print(f"⚡ Используется CPU-потоков: {args.threads}")

    # Загрузка модели
    print("⋯ Загрузка модели 'small'...")
    model = whisper.load_model("small")

    # Язык
    language = args.lang or None
    lang_display = args.lang if args.lang else "автоопределение"
    print(f"▷ Язык: {lang_display}")

    # Режим: один файл или несколько
    if args.multiple:
        # Определяем директорию
        directory = Path(args.file) if args.file else Path(".")
        if not directory.exists():
            print(f"❌ Директория не найдена: {directory}")
            return
        if not directory.is_dir():
            print(f"❌ Путь не является директорией: {directory}")
            return

        audio_files = get_audio_files(directory)
        if not audio_files:
            print(f"❌ В директории нет поддерживаемых аудиофайлов: {directory}")
            return

        print(f"▢ Найдено файлов: {len(audio_files)}")
        for f in audio_files:
            print(f" ├─ {f.name}")

        print(f"\n★ Начинаем обработку {len(audio_files)} файлов...\n")

        success_count = 0
        for i, audio_file in enumerate(audio_files, 1):
            output_file = audio_file.with_suffix(".txt")
            print(f"▷ [{i}/{len(audio_files)}] ▶ Обработка: {audio_file.name}")
            if transcribe_file(model, audio_file, language, verbose=False, output_path=output_file):
                success_count += 1

        print(f"\n✅ Готово: {success_count}/{len(audio_files)} файлов обработано.")

    else:
        # Режим одного файла
        if not args.file:
            parser.error("--file обязателен, если не используется --multiple")

        audio_path = Path(args.file)
        if not audio_path.exists():
            print(f"❌ Файл не найден: {audio_path}")
            return
        if not audio_path.is_file():
            print(f"❌ Это не файл: {audio_path}")
            return
        if audio_path.suffix.lower() not in AUDIO_EXTENSIONS:
            print(f"⚠️  Предупреждение: формат '{audio_path.suffix}' может не поддерживаться.")

        print(f"▶ Начинаем транскрибацию: {audio_path.name}")
        if args.live:
            print("⚡ Режим live: каждая распознанная фраза будет показана сразу")

        output_path = Path(args.output)
        transcribe_file(model, audio_path, language, verbose=args.live, output_path=output_path)


if __name__ == "__main__":
    print("★ Запуск скрипта транскрибации...")
    main()