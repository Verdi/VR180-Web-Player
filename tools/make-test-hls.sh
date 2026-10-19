#!/bin/sh
# Makes an HLS test stream from the demo video, in test-media/hls/. dev.html plays it.
# Run this from the repository folder. It needs ffmpeg.
set -e
mkdir -p test-media/hls
ffmpeg -v error -y -i sbs-video.mp4 -c copy -tag:v hvc1 -f hls -hls_time 6 -hls_playlist_type vod \
	-hls_segment_type fmp4 -hls_fmp4_init_filename init.mp4 \
	-hls_segment_filename 'test-media/hls/seg%03d.m4s' test-media/hls/stream.m3u8
cat > test-media/hls/master.m3u8 <<'PLAYLIST'
#EXTM3U
#EXT-X-VERSION:7
#EXT-X-INDEPENDENT-SEGMENTS
#EXT-X-STREAM-INF:BANDWIDTH=7500000,AVERAGE-BANDWIDTH=7000000,RESOLUTION=3840x1920,FRAME-RATE=59.940,CODECS="hvc1.1.6.L153.90,mp4a.40.2"
stream.m3u8
PLAYLIST
echo "Made test-media/hls/master.m3u8"
