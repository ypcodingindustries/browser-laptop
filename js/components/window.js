/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

// Controller view which manages the top level immutable state for the app

const React = require('react')
const Immutable = require('immutable')
const windowStore = require('../stores/windowStore')
const appStoreRenderer = require('../stores/appStoreRenderer')
const windowActions = require('../actions/windowActions')
const appActions = require('../actions/appActions')
const Main = require('./main')
const SiteTags = require('../constants/siteTags')
const {currentWindowId} = require('../../app/renderer/currentWindow')
const cx = require('../lib/classSet')
const {getPlatformStyles} = require('../../app/common/lib/platformUtil')
const {getDetailFromFrame, getDetailFromTab, getSiteKey, siteSort} = require('../state/siteUtil')

// Stores the site keys of sites which are pinned
// It currently only allows you to pin one site per partition and location
const alreadyPinnedSites = new Set()

class Window extends React.Component {
  constructor (props) {
    super(props)
    // initialize appState from props
    // and then listen for updates
    this.appState = appStoreRenderer.state
    this.windowState = Immutable.fromJS(this.props.initWindowState) || windowStore.getState()
    this.state = {
      immutableData: {
        windowState: this.windowState,
        appState: this.appState
      }
    }
    if (this.props.initWindowState) {
      windowActions.setState(this.windowState)
    }

    this.onChange = this.onChange.bind(this)
    this.onAppStateChange = this.onAppStateChange.bind(this)
    windowStore.addChangeListener(this.onChange)
    appStoreRenderer.addChangeListener(this.onAppStateChange)
  }

  componentWillMount () {
    if (!this.props.initWindowState || this.props.initWindowState.frames.length === 0) {
      if (this.props.frames.length === 0) {
        appActions.createTabRequested({})
      } else {
        this.props.frames.forEach((frame, i) => {
          if (frame.guestInstanceId) {
            appActions.newWebContentsAdded(currentWindowId, frame)
            return
          }
          appActions.createTabRequested({
            url: frame.location,
            partitionNumber: frame.partitionNumber,
            isPrivate: frame.isPrivate,
            active: i === 0
          })
        })
      }
    }
  }

  render () {
    let classes = {}
    classes['windowContainer'] = true

    const platformClasses = getPlatformStyles()
    platformClasses.forEach((className) => {
      classes[className] = true
    })

    // Windows puts a 1px border around frameless window
    // For Windows 10, this defaults to blue. When window
    // becomes inactive it needs to change to gray.
    if (classes['win10']) {
      classes['inactive'] = !this.windowState.getIn(['ui', 'hasFocus'])
    }

    return <div id='windowContainer' className={cx(classes)} >
      <Main windowState={this.state.immutableData.windowState}
        appState={this.state.immutableData.appState} />
    </div>
  }

  componentWillUnmount () {
    windowStore.removeChangeListener(this.onChange)
    appStoreRenderer.removeChangeListener(this.onAppStateChange)
  }

  shouldComponentUpdate (nextProps, nextState) {
    return nextState.immutableData !== this.state.immutableData
  }

  onChange () {
    this.windowState = windowStore.getState()
    this.setState({
      immutableData: {
        windowState: this.windowState,
        appState: this.appState
      }
    })
  }

  onAppStateChange () {
    this.appState = appStoreRenderer.state
    this.setState({
      immutableData: {
        windowState: this.windowState,
        appState: this.appState
      }
    })

    if (!this.props.includePinnedSites) {
      return
    }

    const sites = this.appState.get('sites')
    const tabs = this.appState.get('tabs')
    const frames = this.windowState.get('frames')

    // Check for new pinned sites which we don't already know about
    const tabsToAdd = tabs
      .filter((tab) => tab.get('pinned') &&
          tab.get('windowId') !== currentWindowId &&
          !alreadyPinnedSites.has(getSiteKey(getDetailFromTab((tab)))))


      if (!this.t) {
appActions.createTabRequested({
url: 'https://www.brave.com',
pinned: true
})
}
      this.t = true

    console.log('------tabs to add:', tabsToAdd.toJS())
    tabsToAdd.toList().forEach((tab) => {
      console.log('------add tab:', tab.toJS())
      alreadyPinnedSites.add(getSiteKey(getDetailFromTab((tab))))
      appActions.createTabRequested({
        url: tab.get('url'),
        windowId: currentWindowId,
        partition: tab.get('partition'),
        pinned: true,
        active: false
      })
    })
    // Check for unpinned sites which should be closed
    const framesToClose = frames.filter((frame) =>
      frame.get('pinnedLocation') &&
      // Compare to the original src of the pinned frame
      !sites.find((site) => frame.get('pinnedLocation') === site.get('location') &&
        (frame.get('partitionNumber') || 0) === (site.get('partitionNumber') || 0) && site.get('tags').includes(SiteTags.PINNED)))
    framesToClose.forEach((frameProps) => {
      const site = getDetailFromFrame(frameProps)
      const pinnedSiteKey = getSiteKey(site)
      const hasPinnedSite = alreadyPinnedSites.has(pinnedSiteKey)
      if (hasPinnedSite) {
        console.log('deleting frame!!!!!', pinnedSiteKey)
        alreadyPinnedSites.delete(pinnedSiteKey)
        windowActions.closeFrame(frames, frameProps, true)
      }
    })
  }
}
Window.propTypes = { appState: React.PropTypes.object, frames: React.PropTypes.array, initWindowState: React.PropTypes.object }

module.exports = Window
