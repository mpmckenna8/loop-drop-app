var electron = require('electron')
var insertCss = require('insert-css')
var h = require('lib/h')

var fs = require('fs')
var join = require('path').join

var Observ = require('mutant/value')
var Property = require('lib/property')
var watch = require('mutant/watch')
var FileObject = require('lib/file-object')

var noDrop = require('lib/no-drop')
var applyKeyboardTempo = require('lib/keyboard-tempo')
var renderNode = require('lib/render-node')

var MidiStream = require('web-midi')
var PeriodicWaves = require('lib/periodic-waves')

var version = require('./package.json').version

// apply css styles
insertCss(require('./styles'))
electron.webFrame.setZoomLevelLimits(1, 1)

// midi ports
var midiPorts = Observ()
midiPorts.open = MidiStream
midiPorts.openInput = MidiStream.openInput
midiPorts.openOutput = MidiStream.openOutput

MidiStream.watchPortNames(function (ports) {
  midiPorts.set(ports)
})

var unloadAction = 'close'
var interceptUnload = true

electron.ipcRenderer.on('reload', function () {
  unloadAction = 'reload'
  electron.remote.getCurrentWindow().reload()
})

window.onbeforeunload = function (e) {
  // ensure recording is saved on close
  if (interceptUnload && window.currentProject && window.currentProject.actions.prepareToClose) {
    window.currentProject.actions.prepareToClose(function () {
      interceptUnload = false
      if (unloadAction === 'reload') {
        electron.remote.getCurrentWindow().reload()
      } else {
        electron.remote.getCurrentWindow().close()
      }
    })
    return false
  }
}

// create root context
var audioContext = new global.AudioContext()
var nodes = require('./nodes')
var rootContext = window.rootContext = {
  fs: fs,
  audio: audioContext,
  periodicWaves: PeriodicWaves(audioContext),
  midiPorts: midiPorts,
  nodes: nodes.objectLookup,
  nodeInfo: nodes,
  zoom: Property(1.1),
  version: version
}

watch(rootContext.zoom, function (value) {
  electron.webFrame.setZoomFactor(value || 1)
})

noDrop(document)
require('lib/context-menu')

document.addEventListener('DOMContentLoaded', function (event) {
  electron.ipcRenderer.send('loaded')
})

electron.ipcRenderer.on('load-project', function (e, path) {
  // load project and initialize view

  var projectPath = join(path, 'project.json')
  var projectFile = FileObject(rootContext)

  projectFile.onLoad(function () {
    applyKeyboardTempo(projectFile.node)

    document.documentElement.replaceChild(h('body', [
      renderNode(projectFile.node)
    ]), document.body)

    window.currentProject = projectFile.node
  })

  projectFile.load(projectPath)
})
