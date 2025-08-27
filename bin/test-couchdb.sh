#!/bin/bash
debug () {
	if [ -n "$DEBUG" ]; then
		echo "$1"
	fi
}

debug_inline () {
	if [ -n "$DEBUG" ]; then
		printf "$1"
	fi
}

error_and_exit () {
	echo $1 || "error"
	exit 1
}

assert_arg () {
	arg=$1

	if [ -z "$arg" ]; then
		return 1
	fi
	return 0
}

wait_for_url () {
	assert_arg "$1" && url="$1" || error_and_exit "url not provided, exiting"
	assert_arg "$2" && iterations="$2" || iterations=3
	assert_arg "$3" && duration="$3" || duration=1

	debug "called wait_for_url(url=$url, duration=$duration, iterations=$iterations)"

	waiting=0
	cmd="curl --output /dev/null --silent --insecure --head --fail --max-time 2 $url"

	debug_inline "waiting for $url "
	until ($cmd); do
		if [ $waiting -eq $iterations ]; then
			after=`expr $duration \* $iterations`
			debug_inline "failed, $url can not be reached after $after seconds\n"
			return 1
		fi
		debug_inline .
		waiting=`expr $waiting + 1`
		sleep $duration
	done
	debug_inline " succeeded\n"
}

# clone CouchDB special branch for now, we can do depth=1 when
# it has been merged

# Todo install dependencies, for now this only works on CouchDB dev
# machines. See README-DEV.md in CouchDB repo
git clone https://github.com/apache/couchdb.git
cd couchdb
  git checkout pouchdb-server
  ./configure --dev --disable-spidermonkey
  # make # TODO check if this full source build is required
cd -


# match CouchDB test suite target port
./packages/node_modules/pouchdb-server/bin/pouchdb-server -m -p 15984 &
export POUCHDB_SERVER_PID=$!
wait_for_url http://127.0.0.1:15984/

# create admin user expected by CouchDB tests
curl -X PUT http://127.0.0.1:15984/_node/_local/_config/admins/adm -d '"pass"'

cd couchdb
  make elixir-pouchdb
  EXIT_STATUS=$?
cd -

if [[ ! -z $POUCHDB_SERVER_PID ]]; then
  kill $POUCHDB_SERVER_PID
fi
exit $EXIT_STATUS
