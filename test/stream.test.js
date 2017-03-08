'use strict';

const PORT = 8080,
	HOST = 'localhost',
    TOPIC = 'message';

var cp     = require('child_process'),
	assert = require('assert'),
    Mosca = require('mosca'),
	stream;

describe('Stream', function () {
	this.slow(5000);

	after('terminate child process', function (done) {
	    this.timeout(15000);
	    setTimeout(() => {
            stream.kill('SIGKILL');
            done();
        }, 10000);
	});

	describe('#spawn', function () {
		it('should spawn a child process', function () {
			assert.ok(stream = cp.fork(process.cwd()), 'Child process not spawned.');
		});
	});

	describe('#handShake', function () {
		it('should notify the parent process when ready within 5 seconds', function (done) {
			this.timeout(10000);

            let server = new Mosca.Server({port: PORT});

			stream.on('message', function (message) {
				if (message.type === 'ready'){
				    server.close();
                    done();
                }
			});

			server.on('ready', () => {
                console.log('Server running');

                stream.send({
                    type: 'ready',
                    data: {
                        options: {
                            host: HOST,
                            port: PORT,
                            topic: TOPIC
                        }
                    }
                }, function (error) {
                    assert.ifError(error);
                });
            });

			server.on('clientConnected', function(client) {
                console.log('Client connected', client.id);

                console.log('publishing');
                server.publish({
                    topic: TOPIC,
                    payload: JSON.stringify({device: 'device1', data: 'test data'})
                });
                console.log('published');
            });
		});
	});
});