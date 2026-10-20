#!/bin/sh
# Makes a 30-second HLS test stream from the demo video, in test-media/hls/. dev.html plays it.
# It has two qualities, so you can test quality switching:
# - high/: the original 3840x1920 video, not encoded again.
# - low/: 1920x960 at about 1.5 Mbps.
# Run this from the repository folder. It needs ffmpeg (with VideoToolbox, on a Mac).
set -e
OUT=test-media/hls
SECONDS_LONG=30
rm -rf "$OUT"
mkdir -p "$OUT/high" "$OUT/low"

segment() { # $1 = folder; the other arguments go to ffmpeg before the output options.
	dir=$1; shift
	ffmpeg -v error -y -t "$SECONDS_LONG" -i sbs-video.mp4 "$@" -tag:v hvc1 -c:a copy \
		-f hls -hls_time 6 -hls_playlist_type vod -hls_segment_type fmp4 \
		-hls_fmp4_init_filename init.mp4 -hls_segment_filename "$OUT/$dir/seg%03d.m4s" "$OUT/$dir/stream.m3u8"
}

segment high -c:v copy
# A keyframe every 28 frames, like the original, so both qualities cut their pieces at the same times.
segment low -vf scale=1920:960 -c:v hevc_videotoolbox -b:v 3M -maxrate 4M -g 28 -profile:v main

cat > "$OUT/master.m3u8" <<'PLAYLIST'
#EXTM3U
#EXT-X-VERSION:7
#EXT-X-INDEPENDENT-SEGMENTS
#EXT-X-STREAM-INF:BANDWIDTH=7400000,AVERAGE-BANDWIDTH=7200000,RESOLUTION=3840x1920,FRAME-RATE=59.940,CODECS="hvc1.1.6.L153.90,mp4a.40.2"
high/stream.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=1700000,AVERAGE-BANDWIDTH=1400000,RESOLUTION=1920x960,FRAME-RATE=59.940,CODECS="hvc1.1.6.L120.90,mp4a.40.2"
low/stream.m3u8
PLAYLIST
echo "Made $OUT/master.m3u8"
