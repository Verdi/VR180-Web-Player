#!/bin/sh
# Makes a 60-second 2D HLS test stream (3K, 2K, 1K), in test-media/hls-2d/. dev.html plays it in 2D (data-2d-src).
# It has only the left-eye picture of the side-by-side video, so 2D viewers do not download the
# right half of each frame, which 2D never shows. It is H.264, which every browser can play.
# Usage: tools/make-test-hls-2d.sh path/to/source-video.mp4
# The source should be 8192x4096 side-by-side video. Run this from the repository folder.
# It needs ffmpeg with VideoToolbox (on a Mac).
set -e
SOURCE=${1:?Give the source video, for example: tools/make-test-hls-2d.sh /path/to/video.mp4}
OUT=test-media/hls-2d
LENGTH=60
rm -rf "$OUT"
mkdir -p "$OUT"

# name size video-bitrate (the frames are square: size x size)
# VideoToolbox often makes less than the bitrate it is asked for, so these ask for more.
# 3072 x 3072 is the largest square that fits H.264 level 5.1 and 5.2 (5.2 at 60 fps), which most devices can play.
LADDER="3k 3072 20M
2k 2048 12M
1k 1024 4M"

echo "$LADDER" | while read -r name size bitrate; do
	echo "Encoding $name ($size x $size, $bitrate)"
	mkdir -p "$OUT/$name"
	# crop: the left half of the frame is the left-eye picture.
	# A keyframe every 2 seconds in every quality, so all qualities cut their pieces at the same times.
	ffmpeg -v error -y -t "$LENGTH" -i "$SOURCE" \
		-vf "crop=iw/2:ih:0:0,scale=$size:$size" -c:v h264_videotoolbox -profile:v high -b:v "$bitrate" -maxrate "$bitrate" \
		-force_key_frames "expr:gte(t,n_forced*2)" -c:a aac -b:a 128k \
		-f hls -hls_time 4 -hls_playlist_type vod -hls_segment_type fmp4 \
		-hls_fmp4_init_filename init.mp4 -hls_segment_filename "$OUT/$name/seg%03d.m4s" "$OUT/$name/stream.m3u8" < /dev/null
done

# Write the multivariant playlist, with the real bitrates and codec levels.
{
	echo '#EXTM3U'
	echo '#EXT-X-VERSION:7'
	echo '#EXT-X-INDEPENDENT-SEGMENTS'
	echo "$LADDER" | while read -r name size bitrate; do
		bytes=$(cat "$OUT/$name"/seg*.m4s | wc -c)
		peak=$(ls -l "$OUT/$name"/seg*.m4s | awk '{print $5}' | sort -n | tail -1)
		average=$((bytes * 8 / LENGTH))
		peak=$((peak * 8 / 4))
		# The level is known only with a piece of video, so read the start file and the first piece together.
		cat "$OUT/$name/init.mp4" "$OUT/$name/seg000.m4s" > "$OUT/$name/probe.mp4"
		level=$(ffprobe -v error -select_streams v:0 -show_entries stream=level -of csv=p=0 "$OUT/$name/probe.mp4")
		rm "$OUT/$name/probe.mp4"
		codec=$(printf 'avc1.6400%02x' "$level")
		echo "#EXT-X-STREAM-INF:BANDWIDTH=$peak,AVERAGE-BANDWIDTH=$average,RESOLUTION=${size}x${size},FRAME-RATE=59.940,CODECS=\"$codec,mp4a.40.2\""
		echo "$name/stream.m3u8"
	done
} > "$OUT/master.m3u8" < /dev/null
cat "$OUT/master.m3u8"
du -sh "$OUT"
