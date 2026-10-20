#!/bin/sh
# Makes a 20-second HLS test stream with 5 qualities, in test-media/hls/. dev.html plays it.
# Usage: tools/make-test-hls.sh path/to/source-video.mp4
# The source should be 8192x4096 side-by-side video. Run this from the repository folder.
# It needs ffmpeg with VideoToolbox (on a Mac).
set -e
SOURCE=${1:?Give the source video, for example: tools/make-test-hls.sh /path/to/video.mp4}
OUT=test-media/hls
LENGTH=20
rm -rf "$OUT"
mkdir -p "$OUT"

# name width height video-bitrate
LADDER="8k 8192 4096 24M
6k 5760 2880 14M
4k 3840 1920 8M
2k5 2560 1280 4M
2k 1920 960 2M"

echo "$LADDER" | while read -r name width height bitrate; do
	echo "Encoding $name ($width x $height, $bitrate)"
	mkdir -p "$OUT/$name"
	# A keyframe every 2 seconds in every quality, so all qualities cut their pieces at the same times.
	ffmpeg -v error -y -t "$LENGTH" -i "$SOURCE" \
		-vf "scale=$width:$height" -c:v hevc_videotoolbox -profile:v main -b:v "$bitrate" -maxrate "$bitrate" \
		-force_key_frames "expr:gte(t,n_forced*2)" -tag:v hvc1 -c:a aac -b:a 128k \
		-f hls -hls_time 4 -hls_playlist_type vod -hls_segment_type fmp4 \
		-hls_fmp4_init_filename init.mp4 -hls_segment_filename "$OUT/$name/seg%03d.m4s" "$OUT/$name/stream.m3u8" < /dev/null
done

# Write the multivariant playlist, with the real bitrates and codec levels.
{
	echo '#EXTM3U'
	echo '#EXT-X-VERSION:7'
	echo '#EXT-X-INDEPENDENT-SEGMENTS'
	echo "$LADDER" | while read -r name width height bitrate; do
		bytes=$(cat "$OUT/$name"/seg*.m4s | wc -c)
		peak=$(ls -l "$OUT/$name"/seg*.m4s | awk '{print $5}' | sort -n | tail -1)
		average=$((bytes * 8 / LENGTH))
		peak=$((peak * 8 / 4))
		level=$(ffprobe -v error -select_streams v:0 -show_entries stream=level -of csv=p=0 "$OUT/$name/init.mp4")
		echo "#EXT-X-STREAM-INF:BANDWIDTH=$peak,AVERAGE-BANDWIDTH=$average,RESOLUTION=${width}x${height},FRAME-RATE=59.940,CODECS=\"hvc1.1.6.L${level}.90,mp4a.40.2\""
		echo "$name/stream.m3u8"
	done
} > "$OUT/master.m3u8" < /dev/null
cat "$OUT/master.m3u8"
du -sh "$OUT"
