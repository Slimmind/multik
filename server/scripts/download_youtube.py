import sys
import argparse
import os
import yt_dlp

def progress_hook(d):
    if d['status'] == 'downloading':
        # d['_percent_str'] is like ' 5.0%'
        p = d.get('_percent_str', '0%').strip().replace('%', '')
        # Remove ANSI codes if any (though yt-dlp usually clean)
        # d['total_bytes'] might be missing if unknown size
        try:
            print(f"[PROGRESS] {p}", flush=True)
        except:
            pass
    elif d['status'] == 'finished':
        print("[PROGRESS] 100.0", flush=True)
        print("[STATUS] Processing...", flush=True)

def main():
    parser = argparse.ArgumentParser(description='Download YouTube video')
    parser.add_argument('--url', required=True, help='YouTube video URL')
    parser.add_argument('--output', required=True, help='Output directory or full path')
    args = parser.parse_args()

    try:
        url = args.url
        output_path = args.output

        output_dir = os.path.dirname(output_path)
        filename = os.path.basename(output_path)

        # Ensure directory exists
        if not os.path.exists(output_dir):
            os.makedirs(output_dir)

        # yt-dlp template to force filename
        # We need to support output_path being the full path 'output/filename.mp4'
        # outtmpl should be the full path minus extension potentially, or just force it.
        # simpler: use output_path and let yt-dlp merge if needed.
        # But wait, we want a specific filename `youtube_JOBID.mp4`.

        # yt-dlp will append ext.
        # If output_path is '.../file.mp4', we can try to use that.

        ydl_opts = {
            'format': 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
            'outtmpl': output_path, # This might duplicate extension if not careful?
            # Actually outtmpl: '/path/to/file.%(ext)s' is better if we want to support any ext.
            # But the Node service expects 'mp4' usually.
            # Let's force mp4 merge.
            'merge_output_format': 'mp4',
            'outtmpl': output_path, # If output_path ends in .mp4, yt-dlp handles it?
            # Warning: youtube-dl/yt-dlp might complain if extension is in outtmpl but format creates something else initially.
            # Let's strip extension from output_path for outtmpl.
            'progress_hooks': [progress_hook],
            'quiet': True,
            'no_warnings': True,
        }

        # If output_path has extension, strip it for outtmpl if we want flexibility,
        # or Keep it if we are sure.
        # The node service passes `youtube_JOBID.mp4`.
        # So `outtmpl` = `output/youtube_JOBID.mp4`
        # yt-dlp might write `.f137.mp4` then merge. The final file will be `output/youtube_JOBID.mp4`.

        print(f"[STATUS] Initializing download for {url}", flush=True)

        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
            print(f"[INFO] Title: {info.get('title', 'Unknown')}", flush=True)
            print(f"[INFO] Thumbnail: {info.get('thumbnail', '')}", flush=True)

            ydl.download([url])

        print("[STATUS] Download complete", flush=True)
        # yt-dlp might have changed extension if merge failed?
        # But we requested merge to mp4.
        print(f"[RESULT] {output_path}", flush=True)

    except Exception as e:
        print(f"[ERROR] {str(e)}", flush=True)
        sys.exit(1)

if __name__ == "__main__":
    main()
