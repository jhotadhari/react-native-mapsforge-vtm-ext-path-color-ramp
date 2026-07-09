// Configure the testing environment for React's act().
// eslint-disable-next-line no-undef
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// Suppress react-test-renderer deprecation warning (React 19 ships a
// console.error in the renderer itself; we can't avoid it until the
// test suite migrates to a React 19-compatible test renderer).
const originalError = console.error;
console.error = (...args) => {
	if (
		typeof args[0] === 'string' &&
		args[0].includes('react-test-renderer is deprecated')
	) {
		return;
	}
	originalError.call(console, ...args);
};
