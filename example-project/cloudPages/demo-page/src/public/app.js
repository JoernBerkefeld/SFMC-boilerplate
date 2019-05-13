/* eslint-env jquery, browser */

// frame-buster
if (top != self) {
	top.location = self.location;
}
test();
/**
 * does nothing
 * @returns {string} test
 */
function test() {
	return 'test';
}
