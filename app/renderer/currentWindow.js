const currentWindow = require('electron').remote.getCurrentWindow()
const currentWindowId = currentWindow.id
let isFocused = currentWindow.isFocused()
let isMaximized = currentWindow.isMaximized()
let isFullScreen = currentWindow.isFullScreen()

currentWindow.on('maximize', function (wnd) {
  isMaximized = true
})

currentWindow.on('unmaximize', function (wnd) {
  isMaximized = false
})

currentWindow.on('focus', function (wnd) {
  isFocused = true
})

currentWindow.on('blur', function (wnd) {
  isFocused = false
})

currentWindow.on('enter-full-screen', function (wnd) {
  isFullScreen = true
})

currentWindow.on('leave-full-screen', function (wnd) {
  isFullScreen = false
})

module.exports = {
  currentWindow,
  currentWindowId,
  currentWindowWebContents: currentWindow.webContents,
  isMaximized: () => isMaximized,
  isFocused: () => isFocused,
  isFullScreen: () => isFullScreen
}
