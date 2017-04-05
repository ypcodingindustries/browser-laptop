/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

const Immutable = require('immutable')
const { makeImmutable, isMap, isList } = require('./immutableUtil')
const assert = require('assert')
const frameState = require('./frameState')
const getSetting = require('../../../js/settings').getSetting
const settings = require('../../../js/constants/settings')
// this file should eventually replace frameStateUtil
const frameStateUtil = require('../../../js/state/frameStateUtil')

const validateId = function (propName, id) {
  assert.ok(id, `${propName} cannot be null`)
  id = parseInt(id)
  assert.ok(id === -1 || id > 0, `${propName} must be positive`)
  return id
}

const validateTabs = function (tabs) {
  tabs = makeImmutable(tabs)
  assert.ok(isList(tabs), 'tabs must be an Immutable.List')
  tabs.forEach((tab) => validateTabValue(tab))
  return tabs
}

const validateState = function (state) {
  state = makeImmutable(state)
  assert.ok(isMap(state), 'state must be an Immutable.Map')
  assert.ok(isList(state.get('tabs')), 'state must contain an Immutable.List of tabs')
  return state
}

const validateWindowValue = function (windowValue) {
  windowValue = makeImmutable(windowValue)
  assert.ok(isMap(windowValue), 'windowValue must be an Immutable.Map')
  assert.ok(windowValue.get('windowId'), 'window must have a windowId')
  return windowValue
}

const validateTabValue = function (tabValue) {
  tabValue = makeImmutable(tabValue)
  assert.ok(isMap(tabValue), 'tabValue must be an Immutable.Map')
  assert.ok(tabValue.get('tabId'), 'tab must have a tabId')
  return tabValue
}

const validateAction = function (action) {
  action = makeImmutable(action)
  assert.ok(isMap(action), 'action must be an Immutable.Map')
  return action
}

const matchTab = function (queryInfo, tab) {
  queryInfo = queryInfo.toJS ? queryInfo.toJS() : queryInfo
  return !Object.keys(queryInfo).map((queryKey) => (tab.get(queryKey) === queryInfo[queryKey])).includes(false)
}

const tabState = {
  queryTab: (state, queryInfo) => {
    state = validateState(state)
    return state.get('tabs').filter(matchTab.bind(null, queryInfo)).get(0)
  },

  getTabIndex: (state, tabValue) => {
    state = validateState(state)
    tabValue = validateTabValue(tabValue)
    let tabId = validateId('tabId', tabValue.get('tabId'))
    return tabState.getTabIndexByTabId(state, tabId)
  },

  getTabIndexByTabId: (state, tabId) => {
    tabId = validateId('tabId', tabId)
    state = validateState(state)

    return state.get('tabs').findIndex((tab) => tab.get('tabId') === tabId)
  },

  getActiveTabValue: (state, windowId) => {
    windowId = validateId('windowId', windowId)
    state = validateState(state)
    return state.get('tabs').find((tab) => tab.get('windowId') === windowId && tab.get('active'))
  },

  removeTabByTabId: (state, tabId) => {
    tabId = validateId('tabId', tabId)
    state = validateState(state)

    let index = tabState.getTabIndexByTabId(state, tabId)
    if (index === -1) {
      return state
    }
    return tabState.removeTabByIndex(state, index)
  },

  removeTabByIndex: (state, index) => {
    index = parseInt(index)
    assert.ok(index >= 0, 'index must be positive')
    state = validateState(state)
    return state.set('tabs', state.get('tabs').delete(index))
  },

  removeTab: (state, action) => {
    action = validateAction(action)
    state = validateState(state)
    let tabValue = validateTabValue(action.get('tabValue'))
    let tabId = validateId('tabId', tabValue.get('tabId'))
    return tabState.removeTabByTabId(state, tabId)
  },

  insertTab: (state, action) => {
    action = validateAction(action)
    state = validateState(state)
    let tabValue = validateTabValue(action.get('tabValue'))
    assert.ok(!tabState.getTab(state, tabValue), 'Tab already exists')
    return state.set('tabs', state.get('tabs').push(tabValue))
  },

  maybeCreateTab: (state, action) => {
    action = validateAction(action)
    state = validateState(state)
    let tabValue = validateTabValue(action.get('tabValue'))

    if (tabState.getTab(state, tabValue)) {
      return tabState.updateTab(state, action)
    } else {
      return tabState.insertTab(state, action)
    }
  },

  getTabsByWindowId: (state, windowId) => {
    state = validateState(state)
    windowId = validateId('windowId', windowId)
    return state.get('tabs').filter((tab) => tab.get('windowId') === windowId)
  },

  getPinnedTabs: (state) => {
    state = validateState(state)
    return state.get('tabs').filter((tab) => tab.get('pinned'))
  },

  getPinnedTabsByWindowId: (state, windowId) => {
    state = validateState(state)
    windowId = validateId('windowId', windowId)
    return tabState.getPinnedTabs(state).filter((tab) => tab.get('windowId') === windowId)
  },

  getMatchingTab: (state, createProperties) => {
    state = validateState(state)
    const windowId = validateId('windowId', createProperties.get('windowId'))
    return state.get('tabs').find(
      (tab) => tab.get('windowId') === windowId &&
        tab.get('url') === createProperties.get('url') &&
        (tab.get('partition') || 'default') === (createProperties.get('partition') || 'default'))
  },

  getTabsByWindow: (state, windowValue) => {
    state = validateState(state)
    windowValue = validateWindowValue(windowValue)
    let windowId = validateId('windowId', windowValue.get('windowId'))
    return state.get('tabs').filter((tab) => tab.get('windowId') === windowId)
  },

  getByTabId: (state, tabId) => {
    state = validateState(state)
    tabId = validateId('tabId', tabId)

    return state.get('tabs').find((tab) => tab.get('tabId') === tabId)
  },

  getTab: (state, tabValue) => {
    state = validateState(state)
    tabValue = validateTabValue(tabValue)
    let tabId = validateId('tabId', tabValue.get('tabId'))
    return tabState.getByTabId(state, tabId)
  },

  updateTab: (state, action) => {
    state = validateAction(state)
    action = validateAction(action)
    return tabState.updateTabValue(state, action.get('tabValue'), action.get('replace'))
  },

  getTabs: (state) => {
    state = validateState(state)
    return state.get('tabs')
  },

  setTabs: (state, tabs) => {
    state = validateState(state)
    tabs = validateTabs(tabs)
    return state.set('tabs', tabs)
  },

  updateTabValue: (state, tabValue, replace = false) => {
    tabValue = validateTabValue(tabValue)
    const tabs = state.get('tabs')
    const index = tabState.getTabIndex(state, tabValue)
    if (index === -1) {
      return state
    }

    let currentTabValue = tabs.get(index)

    let tabId = tabValue.get('tabId')
    if (tabId) {
      tabId = validateId('tabId', tabId)
      let currentTabId = currentTabValue.get('tabId')
      if (currentTabId) {
        assert.ok(tabId === currentTabId, 'Changing a tabId is not allowed')
      }
    }
    if (!replace) {
      tabValue = currentTabValue.mergeDeep(tabValue)
    }

    return state.set('tabs', tabs.delete(index).insert(index, tabValue))
  },

  removeTabField: (state, field) => {
    state = makeImmutable(state)

    let tabs = state.get('tabs')
    if (!tabs) {
      return state
    }
    for (let i = 0; i < tabs.size; i++) {
      tabs = tabs.deleteIn([i, field])
    }
    return state.set('tabs', tabs)
  },

  updateFrame: (state, action) => {
    state = validateState(state)
    action = validateAction(action)
    const tabId = action.getIn(['frame', 'tabId'])
    if (!tabId) {
      return state
    }

    let tabValue = tabState.getByTabId(state, tabId)
    if (!tabValue) {
      return state
    }

    tabValue = tabValue.set('frame', makeImmutable(action.get('frame')))
    return tabState.updateTabValue(state, tabValue)
  },

  getTabValueById: (state, tabId, key) => {
    state = validateState(state)
    tabId = validateId('tabId', tabId)
    const tab = tabState.getByTabId(state, tabId)
    if (!tab) {
      return
    }
    return tab.get(key)
  },

  canGoForward: (state, tabId) => {
    return tabState.getTabValueById(state, tabId, 'canGoForward') || false
  },

  canGoBack: (state, tabId) => {
    return tabState.getTabValueById(state, tabId, 'canGoBack') || false
  },

  isShowingMessageBox: (state, tabId) => {
    return tabState.getTabValueById(state, tabId, 'messageBoxDetail') || false
  },

  getTitle: (state, tabId) => {
    return tabState.getTabValueById(state, tabId, 'title') || ''
  },

  getFrameByTabId: (state, tabId) => {
    const currentWindow = state.get('currentWindow')
    if (currentWindow) {
      return frameState.getFrameByTabId(currentWindow, tabId)
    } else {
      const tab = tabState.getByTabId(state, tabId)
      if (tab) {
        return tab.get('frame')
      }
    }
  },

  isSecure: (state, tabId) => {
    const frame = tabState.getFrameByTabId(state, tabId)
    return frameStateUtil.isFrameSecure(frame)
  },

  isLoading: (state, tabId) => {
    const frame = tabState.getFrameByTabId(state, tabId)
    return frameStateUtil.isFrameLoading(frame)
  },

  startLoadTime: (state, tabId) => {
    const frame = tabState.getFrameByTabId(state, tabId)
    return frameStateUtil.startLoadTime(frame)
  },

  endLoadTime: (state, tabId) => {
    const frame = tabState.getFrameByTabId(state, tabId)
    return frameStateUtil.endLoadTime(frame)
  },

  locationValueSuffix: (state, tabId) => {
    const frame = tabState.getFrameByTabId(state, tabId)
    return (frame && frame.getIn(['navbar', 'urlbar', 'suggestions', 'urlSuffix'])) || ''
  },

  hasLocationValueSuffix: (state, tabId) => {
    const frame = tabState.getFrameByTabId(state, tabId)
    return !!(frame && frame.getIn(['navbar', 'urlbar', 'suggestions', 'urlSuffix']))
  },

  getHistory: (state, tabId) => {
    const frame = tabState.getFrameByTabId(state, tabId)
    return frameStateUtil.getHistory(frame)
  },

  getLocation: (state, tabId) => {
    const frame = tabState.getFrameByTabId(state, tabId)
    return (frame && frame.get('location')) || ''
  },

  getUrlBar: (state, tabId) => {
    const frame = tabState.getFrameByTabId(state, tabId)
    return (frame && frame.getIn(['navbar', 'urlbar'])) || new Immutable.Map()
  },

  // TODO(bridiver) - refactor this so it doesn't require windowState
  isTitleMode: (state, tabId) => {
    const windowState = state.get('currentWindow')
    assert.ok(windowState, `isTitleMode requires windowState`)
    const mouseInTitlebar = windowState.getIn(['ui', 'mouseInTitlebar'])
    const bookmarkDetail = windowState.get('bookmarkDetail')
    const location = tabState.getLocation(state, tabId)
    const urlbar = tabState.getUrlBar(state, tabId)
    return tabState.isShowingMessageBox(state, tabId) ||
      (
        mouseInTitlebar === false &&
        !bookmarkDetail &&
        tabState.getTitle(state, tabId) &&
        !['about:blank', 'about:newtab'].includes(location) &&
        !tabState.isLoading(state, tabId) &&
        !urlbar.get('focused') &&
        !urlbar.get('active') &&
        getSetting(settings.DISABLE_TITLE_MODE) === false
      )
  },

  getPersistentState: (state) => {
    state = makeImmutable(state)

    state = tabState.removeTabField(state, 'messageBoxDetail')
    state = tabState.removeTabField(state, 'frame')
    return state.delete('tabs')
  }
}

module.exports = tabState
