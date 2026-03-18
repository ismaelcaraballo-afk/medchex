import '@testing-library/jest-dom'

// jsdom doesn't implement requestAnimationFrame
let rafId = 0
global.requestAnimationFrame = (cb) => { setTimeout(cb, 0); return ++rafId }
global.cancelAnimationFrame = () => {}

// jsdom doesn't implement HTMLMediaElement media APIs — silence them
// so the native scan path (which renders <video autoPlay>) doesn't throw
Object.defineProperty(window.HTMLMediaElement.prototype, 'srcObject', {
  set: () => {},
  get: () => null,
  configurable: true,
})
Object.defineProperty(window.HTMLMediaElement.prototype, 'play', {
  value: () => Promise.resolve(),
  configurable: true,
})
Object.defineProperty(window.HTMLMediaElement.prototype, 'pause', {
  value: () => {},
  configurable: true,
})
