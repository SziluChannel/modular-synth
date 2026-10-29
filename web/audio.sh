#!/bin/bash
# audio.sh mute|unmute  -- mutes the Chrome instance running Circuit Studio
ACT="$1"
pactl list sink-inputs 2>/dev/null | awk -v act="$ACT" '
/^Sink Input #/ { id=substr($3,2) }
/application.name = "cs2"/ || /application.name = "Google Chrome"/ { print id }
' | sort -u | while read -r id; do
  [ -n "$id" ] && pactl set-sink-input-mute "$id" $([ "$ACT" = mute ] && echo 1 || echo 0)
done
pactl list sink-inputs 2>/dev/null | grep -E "^Sink Input|Mute:|application.name" | paste - - - 2>/dev/null | sed 's/\t/ | /g'
