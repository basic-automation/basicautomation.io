#!/bin/sh
# Runs the site and the onion gateway side by side in one container.
#
# Two processes rather than two containers because the gateway is a front for
# this exact site: it proxies over loopback, and it writes its address to a file
# the site reads back. Split across containers, both of those become network and
# shared-volume problems for no gain.
#
# Neither is supervised by the other. If either exits, this exits with its
# status and the container stops — which is what the restart policy and the
# healthcheck are for. A gateway that has quietly died beside a healthy site is
# worse than a container that went away.
set -eu

: "${PORT:=3000}"
: "${ONION_ENABLED:=1}"

term() {
	# Forward the signal on so both get a chance to shut down cleanly; onyums
	# unpublishes its descriptor on shutdown, which is worth waiting for.
	[ -n "${site_pid:-}" ] && kill -TERM "$site_pid" 2>/dev/null || true
	[ -n "${onion_pid:-}" ] && kill -TERM "$onion_pid" 2>/dev/null || true
	wait
	exit 0
}
trap term TERM INT

node .output/server/index.mjs &
site_pid=$!

if [ "$ONION_ENABLED" = "1" ]; then
	# Tor bootstrap is minutes on a cold cache, so this is started immediately
	# and left to catch up rather than gated on the site being ready. The proxy
	# returns 502 until the site answers, which only matters to a visitor who
	# found the address before the site finished starting.
	./onion-gateway &
	onion_pid=$!
	echo "entrypoint: site pid $site_pid, onion gateway pid $onion_pid"
else
	echo "entrypoint: site pid $site_pid, onion gateway disabled"
fi

# Exit as soon as either does, carrying its status.
while :; do
	if ! kill -0 "$site_pid" 2>/dev/null; then
		wait "$site_pid" || status=$?
		echo "entrypoint: site exited (${status:-0})"
		exit "${status:-0}"
	fi
	if [ -n "${onion_pid:-}" ] && ! kill -0 "$onion_pid" 2>/dev/null; then
		wait "$onion_pid" || status=$?
		echo "entrypoint: onion gateway exited (${status:-0})"
		exit "${status:-0}"
	fi
	sleep 2
done
