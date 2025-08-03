// Tab Navigation Fixed - Final Version - Aug 2, 2025
import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["grid"]
  static values = {
    mode: String,
    puzzleId: String,
    grid: Array
  }

  connect() {
    this.initializeGrid()
    this.bindEvents()
    
    // Initialize the clues preview
    if (this.modeValue === 'create') {
      setTimeout(() => {
        this.delegateToController('create-mode-clue-management', 'updateCluesPreview')
      }, 100)
    }
  }

  // State getters/setters that delegate to mode state management controller
  get selectedCell() { 
    const stateController = this.getController('mode-state-management')
    return stateController ? stateController.getSelectedCell() : null
  }
  set selectedCell(value) { 
    const stateController = this.getController('mode-state-management')
    if (stateController) stateController.setSelectedCell(value)
  }
  
  get selectedRow() { 
    const stateController = this.getController('mode-state-management')
    return stateController ? stateController.getSelectedRow() : null
  }
  set selectedRow(value) { 
    const stateController = this.getController('mode-state-management')
    if (stateController) stateController.setSelectedRow(value)
  }
  
  get selectedCol() { 
    const stateController = this.getController('mode-state-management')
    return stateController ? stateController.getSelectedCol() : null
  }
  set selectedCol(value) { 
    const stateController = this.getController('mode-state-management')
    if (stateController) stateController.setSelectedCol(value)
  }
  
  get direction() { 
    const stateController = this.getController('mode-state-management')
    return stateController ? stateController.getDirection() : 'across'
  }
  set direction(value) { 
    const stateController = this.getController('mode-state-management')
    if (stateController) stateController.setDirection(value)
  }
  
  get isBlockMode() { 
    const stateController = this.getController('mode-state-management')
    return stateController ? stateController.getIsBlockMode() : false
  }
  set isBlockMode(value) { 
    const stateController = this.getController('mode-state-management')
    if (stateController) stateController.setIsBlockMode(value)
  }
  
  get usedClueIds() { 
    const stateController = this.getController('mode-state-management')
    return stateController ? stateController.getUsedClueIds() : new Set()
  }
  set usedClueIds(value) { 
    const stateController = this.getController('mode-state-management')
    if (stateController) stateController.setUsedClueIds(value)
  }
  
  get appliedClues() { 
    const stateController = this.getController('mode-state-management')
    return stateController ? stateController.getAppliedClues() : new Map()
  }
  set appliedClues(value) { 
    const stateController = this.getController('mode-state-management')
    if (stateController) stateController.setAppliedClues(value)
  }

  // Helper method to get controllers with fallback handling
  getController(identifier) {
    return this.application.getControllerForElementAndIdentifier(this.element, identifier)
  }

  // Helper method to delegate to controller with fallback
  delegateToController(identifier, method, ...args) {
    const controller = this.getController(identifier)
    if (controller && typeof controller[method] === 'function') {
      return controller[method](...args)
    }
    return null
  }

  // Helper method to notify multiple controllers
  notifyControllers() {
    this.delegateToController('zoom', 'updateGridDimensions', this.gridWidth, this.gridHeight)
    this.delegateToController('highlight', 'updateGridDimensions', this.gridWidth, this.gridHeight)
    
    const navigationController = this.getController('navigation')
    if (navigationController) {
      navigationController.updateGridDimensions(this.gridWidth, this.gridHeight)
      navigationController.updateDirection(this.direction)
      navigationController.updateCurrentPosition(this.selectedRow, this.selectedCol)
      navigationController.setBlockMode(this.isBlockMode)
      navigationController.updateGridData(this.gridData)
    }
    
    this.delegateToController('grid-management', 'updateGridDimensions', this.gridWidth, this.gridHeight)
    
    // Sync clue data with create mode clue management controller
    if (this.modeValue === 'create') {
      this.delegateToController('create-mode-clue-management', 'syncClueData', this.usedClueIds, this.appliedClues)
    }
  }

  initializeGrid() {
    const gridContainer = this.element.querySelector('.crossword-interactive-grid')
    if (gridContainer) {
      // Initialize grid with grid management controller
      const gridController = this.application.getControllerForElementAndIdentifier(this.element, 'grid-management')
      if (gridController) {
        this.gridData = gridController.initializeGrid(this.gridValue)
      } else {
        this.gridData = this.gridValue || this.generateEmptyGrid()
      }
      
      // Get grid dimensions from data
      this.gridHeight = this.gridData.length
      this.gridWidth = this.gridData[0]?.length || 15

      // Load clues data for play mode via play mode clue management controller
      this.delegateToController('play-mode-clue-management', 'loadCluesData')

      // Notify all controllers of grid dimensions and state
      this.notifyControllers()
      
      // Update numbering for create mode after controllers are notified
      if (this.modeValue === 'create') {
        this.delegateToController('grid-management', 'updateNumbering', this.gridData)
      }
    }
  }

  bindEvents() {
    // Global events
    this.bindGlobalEvents()
    
    // Controller inter-communication events
    this.bindControllerEvents()
    
    // Mode-specific events
    this.bindModeSpecificEvents()
    
    // UI button events
    this.bindButtonEvents()
  }

  bindGlobalEvents() {
    const globalEvents = [
      { target: this.element, event: 'click', handler: 'handleCellClick' }
    ]
    
    this.addEventListeners(globalEvents)
  }

  bindControllerEvents() {
    const controllerEvents = [
      // Navigation controller events
      { event: 'move-to-cell', handler: 'handleMoveToCell' },
      { event: 'direction-changed', handler: 'handleDirectionChanged' },
      
      // Grid management controller events
      { event: 'grid-data-updated', handler: 'handleGridDataUpdated' },
      { event: 'grid-cleared', handler: 'handleGridCleared' },
      
      // Play mode operations controller events
      { event: 'cell-reveal', handler: 'handleCellReveal' },
      { event: 'word-reveal', handler: 'handleWordReveal' },
      { event: 'puzzle-reset', handler: 'handlePuzzleReset' },
      { event: 'puzzle-completed', handler: 'handlePuzzleCompleted' },
      { event: 'show-message', handler: 'handleShowMessage' }
    ]
    
    this.addEventListeners(controllerEvents, this.element)
  }

  bindModeSpecificEvents() {
    const modeEvents = {
      create: [
        { event: 'clue-applied', handler: 'handleClueApplied' },
        { event: 'clue-undone', handler: 'handleClueUndone' },
        { event: 'intersection-completed', handler: 'handleIntersectionCompleted' },
        { event: 'update-clues-preview', handler: 'handleUpdateCluesPreview' }
      ],
      play: [
        { event: 'clue-selected', handler: 'handleClueSelected' }
      ]
    }
    
    const currentModeEvents = modeEvents[this.modeValue]
    if (currentModeEvents) {
      this.addEventListeners(currentModeEvents, this.element)
    }
  }

  bindButtonEvents() {
    const commonButtons = [
      { selector: '#toggle-mode-btn', handler: 'toggleMode' },
      { selector: '#clear-grid-btn', handler: 'clearGrid' }
    ]
    
    const playModeButtons = [
      { selector: '#check-puzzle-btn', handler: 'checkPuzzle' },
      { selector: '#check-word-btn', handler: 'checkWord' },
      { selector: '#reveal-letter-btn', handler: 'revealLetter' },
      { selector: '#reveal-word-btn', handler: 'revealWord' },
      { selector: '#reset-puzzle-btn', handler: 'resetPuzzle' }
    ]
    
    // Bind common buttons
    this.bindButtonsFromConfig(commonButtons)
    
    // Bind mode-specific buttons
    if (this.modeValue === 'play') {
      this.bindButtonsFromConfig(playModeButtons)
    }
  }

  // Helper method to add event listeners from configuration
  addEventListeners(events, target = this.element) {
    events.forEach(({ event, handler, target: eventTarget }) => {
      const actualTarget = eventTarget || target
      actualTarget.addEventListener(event, this[handler].bind(this))
    })
  }

  // Helper method to bind buttons from configuration
  bindButtonsFromConfig(buttonConfigs) {
    buttonConfigs.forEach(({ selector, handler }) => {
      const button = this.element.querySelector(selector)
      if (button) {
        button.addEventListener('click', this[handler].bind(this))
      }
    })
  }

  handleCellClick(event) {
    const cell = event.target.closest('.crossword-cell')
    if (!cell) return

    const row = parseInt(cell.dataset.row)
    const col = parseInt(cell.dataset.col)

    if (this.modeValue === 'create' && this.isBlockMode) {
      // Delegate to grid management controller
      const gridController = this.application.getControllerForElementAndIdentifier(this.element, 'grid-management')
      if (gridController) {
        gridController.toggleBlock(row, col, this.gridData)
      } else {
        console.error('Grid management controller not found for block toggle')
      }
    } else {
      this.selectCell(row, col)
    }
  }

  selectCell(row, col) {
    // Remove previous selection and highlights
    if (this.selectedCell) {
      this.selectedCell.classList.remove('selected')
    }
    this.delegateToController('highlight', 'clearHighlights')

    // Select new cell
    const cell = this.getCellElement(row, col)
    if (cell && !cell.classList.contains('blocked')) {
      cell.classList.add('selected')
      cell.focus()
      this.selectedCell = cell
      this.selectedRow = row
      this.selectedCol = col

      // Notify navigation controller of position change
      this.delegateToController('navigation', 'updateCurrentPosition', row, col)

      // Only highlight and update direction in letter mode, not block mode
      if (!(this.modeValue === 'create' && this.isBlockMode)) {
        this.delegateToController('highlight', 'highlightCurrentWord', row, col, this.direction, this.gridData)
        
        // Notify navigation controller to update direction indicator
        this.delegateToController('navigation', 'updateDirectionIndicator')
        
        // For play mode, update current clue display
        if (this.modeValue === 'play') {
          this.delegateToController('play-mode-clue-management', 'updateCurrentClueFromPosition', row, col, this.direction)
        } else {
          // Show matching clues for the current word in create mode
          const currentWord = this.getCurrentWordInfo(row, col)
          if (currentWord) {
            this.delegateToController('clue-suggestions', 'updateCluesSuggestions', row, col, currentWord, this.gridData)
          }
        }
      }
    }
  }

  // Method to toggle direction - called by keyboard handler
  toggleDirection() {
    const keyboardHandler = this.getController('keyboard-handler')
    if (keyboardHandler) {
      keyboardHandler.toggleDirection()
    }
  }

  // Play mode clue management delegation methods
  loadCluesData() {
    return this.delegateToController('play-mode-clue-management', 'loadCluesData')
  }

  getCluesData() {
    return this.delegateToController('play-mode-clue-management', 'getCluesData')
  }

  getCurrentClue() {
    return this.delegateToController('play-mode-clue-management', 'getCurrentClue')
  }

  handleClueClick(event) {
    return this.delegateToController('play-mode-clue-management', 'handleClueClick', event)
  }

  updateCurrentClueFromPosition(row, col, direction) {
    return this.delegateToController('play-mode-clue-management', 'updateCurrentClueFromPosition', row, col, direction)
  }

  // UI Message & Display Management delegation methods
  setCellValue(row, col, value) {
    return this.delegateToController('ui-message-display', 'setCellValue', row, col, value)
  }

  clearCellError(row, col) {
    return this.delegateToController('ui-message-display', 'clearCellError', row, col)
  }

  fillClueWord(clue) {
    return this.delegateToController('ui-message-display', 'fillClueWord', clue)
  }

  showMessage(text, type = 'info') {
    return this.delegateToController('ui-message-display', 'showMessage', text, type)
  }

  showPuzzleCompletedMessage() {
    return this.delegateToController('ui-message-display', 'showPuzzleCompletedMessage')
  }

  // Check if the current word is completely filled after typing in a cell (delegate to word navigation)
  isWordComplete(row, col) {
    return this.delegateToController('word-navigation-logic', 'isWordComplete', row, col, this.direction)
  }

  // Get the bounds of the current word (delegate to word navigation)
  getCurrentWordBounds(row, col) {
    return this.delegateToController('word-navigation-logic', 'getCurrentWordBounds', row, col, this.direction, this.gridData, this.gridWidth, this.gridHeight)
  }

  // Move to the next unfilled word (delegate to word navigation)
  moveToNextUnfilledWord() {
    const nextPosition = this.delegateToController('word-navigation-logic', 'moveToNextUnfilledWord', this.selectedRow, this.selectedCol, this.direction)
    if (nextPosition) {
      this.direction = nextPosition.direction
      this.selectCell(nextPosition.row, nextPosition.col)
      return
    }

    // Fallback to normal navigation
    console.log('Falling back to normal navigation')
    const navigationController = this.getController('navigation')
    if (navigationController) {
      navigationController.moveInDirection(this.selectedRow, this.selectedCol, false)
    }
  }

  // Move to the previous unfilled word (delegate to word navigation)
  moveToPreviousUnfilledWord() {
    const prevPosition = this.delegateToController('word-navigation-logic', 'moveToPreviousUnfilledWord', this.selectedRow, this.selectedCol, this.direction)
    if (prevPosition) {
      this.direction = prevPosition.direction
      this.selectCell(prevPosition.row, prevPosition.col)
      return
    }

    // Fallback to normal navigation
    console.log('Falling back to normal navigation')
    const navigationController = this.getController('navigation')
    if (navigationController) {
      navigationController.moveInDirection(this.selectedRow, this.selectedCol, true) // Move backward
    }
  }

  // Get the number of the current word (delegate to word navigation)
  getCurrentWordNumber() {
    return this.delegateToController('word-navigation-logic', 'getCurrentWordNumber', this.selectedRow, this.selectedCol, this.gridData)
  }

  updateGridData() {
    const gridInput = document.getElementById('grid-data')
    if (gridInput) {
      gridInput.value = JSON.stringify(this.gridData)
    }
    
    // Update navigation controller with new grid data
    this.delegateToController('navigation', 'updateGridData', this.gridData)
  }

  // Delegate mode management to mode state management controller
  toggleMode() {
    return this.delegateToController('mode-state-management', 'toggleMode')
  }

  clearGrid() {
    return this.delegateToController('mode-state-management', 'clearGrid')
  }

  clearUserEntries() {
    return this.delegateToController('mode-state-management', 'clearUserEntries')
  }

  // Event handlers for navigation controller
  handleMoveToCell(event) {
    const { row, col } = event.detail
    this.selectCell(row, col)
  }

  handleDirectionChanged(event) {
    const { direction } = event.detail
    this.direction = direction
    this.delegateToController('highlight', 'clearHighlights')
    this.delegateToController('highlight', 'highlightCurrentWord', this.selectedRow, this.selectedCol, this.direction, this.gridData)
    
    // Update clue highlighting for the new direction in play mode
    if (this.modeValue === 'play' && this.selectedRow !== undefined && this.selectedCol !== undefined) {
      this.delegateToController('play-mode-clue-management', 'updateCurrentClueFromPosition', this.selectedRow, this.selectedCol, this.direction)
    }
    
    // Update clue suggestions for the new direction in create mode
    if (this.modeValue === 'create' && this.selectedRow !== undefined && this.selectedCol !== undefined) {
      const currentWord = this.getCurrentWordInfo(this.selectedRow, this.selectedCol)
      if (currentWord) {
        const clueController = this.application.getControllerForElementAndIdentifier(this.element, 'clue-suggestions')
        if (clueController) {
          clueController.updateCluesSuggestions(this.selectedRow, this.selectedCol, currentWord, this.gridData)
        }
      }
    }
  }

  // Event handlers for grid management controller
  handleGridDataUpdated(event) {
    const { gridData, needsNumberingUpdate, saveToServer, row, col, value } = event.detail
    this.gridData = gridData
    
    // Update the hidden form field with grid data
    this.updateGridData()
    
    // Save to server if in play mode
    if (saveToServer && this.puzzleIdValue && row !== undefined && col !== undefined) {
      this.saveCell(row, col, value)
    }
    
    // Update navigation controller with new grid data
    this.delegateToController('navigation', 'updateGridData', this.gridData)
    
    // If numbering needs to be updated (block mode changes in create mode)
    if (needsNumberingUpdate) {
      this.delegateToController('grid-management', 'updateNumbering', this.gridData)
    }
  }

  handleGridCleared(event) {
    // Clear all clue tracking
    this.usedClueIds.clear()
    this.appliedClues.clear()
    
    // Clear the clue suggestions panel and sync with clue controller
    const clueController = this.application.getControllerForElementAndIdentifier(this.element, 'clue-suggestions')
    if (clueController) {
      clueController.clearCluesSuggestions()
      clueController.syncUsedClues([])
      clueController.syncAppliedClues([])
    }
    
    // Update the clues preview via create mode clue management controller
    this.delegateToController('create-mode-clue-management', 'updateCluesPreview')
  }

  // Event handlers for clue suggestions controller
  handleClueApplied(event) {
    const { clueId, answer, wordInfo, completions, appliedClues, usedClueIds } = event.detail
    
    // Sync the clue tracking data
    this.usedClueIds = usedClueIds
    this.appliedClues = appliedClues
    
    // Fill in the answer in the grid using grid management controller
    const gridController = this.application.getControllerForElementAndIdentifier(this.element, 'grid-management')
    if (gridController) {
      gridController.fillCellsWithAnswer(wordInfo, answer, this.gridData)
    } else {
      // Fallback to direct grid operations
      if (wordInfo.direction === 'across') {
        for (let i = 0; i < answer.length; i++) {
          const col = wordInfo.startCol + i
          if (col < this.gridWidth) {
            this.setCellValue(wordInfo.startRow, col, answer[i])
          }
        }
      } else {
        for (let i = 0; i < answer.length; i++) {
          const row = wordInfo.startRow + i
          if (row < this.gridHeight) {
            this.setCellValue(row, wordInfo.startCol, answer[i])
          }
        }
      }
    }
  }

  handleClueUndone(event) {
    const { wordKey, wordInfo, appliedClues } = event.detail
    
    // Sync the applied clues data
    this.appliedClues = appliedClues
    
    // Clear letters using grid management controller
    const gridController = this.application.getControllerForElementAndIdentifier(this.element, 'grid-management')
    if (gridController) {
      gridController.clearCellsOfAnswer(wordInfo, this.gridData, this.appliedClues)
    } else {
      // Fallback to direct clearing
      const positions = this.getWordPositions(wordInfo)
      
      positions.forEach(({row, col}) => {
        // Check if this position is part of any other applied clue
        if (!this.isPositionUsedByOtherClues(row, col, wordKey)) {
          this.setCellValue(row, col, '')
        }
      })
    }
  }

  handleIntersectionCompleted(event) {
    const { completion } = event.detail
    console.log('✅ Processing intersection completion:', completion)
    // The intersection completion is handled by the clue suggestions controller
    // This event is just for logging/debugging purposes
  }

  handleUpdateCluesPreview(event) {
    const { appliedClues } = event.detail
    this.appliedClues = appliedClues
    
    // Delegate to create mode clue management controller
    const clueController = this.getController('create-mode-clue-management')
    if (clueController) {
      const numbering = this.calculateGridNumbering(this.gridData)
      clueController.processCluesPreviewUpdate(numbering)
    }
  }

  // Event handler for clue display controller
  handleClueSelected(event) {
    const { direction, row, col } = event.detail
    
    // Set direction and navigate to the clue's starting cell
    this.direction = direction
    this.selectCell(row, col)
    
    // Update navigation controller with new direction
    const navigationController = this.application.getControllerForElementAndIdentifier(this.element, 'navigation')
    if (navigationController) {
      navigationController.updateDirection(direction)
      navigationController.updateDirectionIndicator()
    }
  }

  saveCell(row, col, value) {
    this.delegateToController('play-mode-operations', 'saveCell', row, col, value)
  }

  // Grid management delegation methods
  calculateGridNumbering(grid) {
    return this.delegateToController('grid-management', 'calculateGridNumbering', grid) || {}
  }

  getCellElement(row, col) {
    return this.delegateToController('grid-management', 'getCellElement', row, col) || 
           this.element.querySelector(`.crossword-cell[data-row="${row}"][data-col="${col}"]`)
  }

  isValidPosition(row, col) {
    return this.delegateToController('grid-management', 'isValidPosition', row, col) ??
           (row >= 0 && row < this.gridHeight && col >= 0 && col < this.gridWidth)
  }

  isCellBlocked(row, col) {
    return this.delegateToController('grid-management', 'isCellBlocked', row, col, this.gridData) ??
           (!this.isValidPosition(row, col) || this.gridData[row][col] === '#')
  }

  getWordPositions(wordInfo) {
    return this.delegateToController('grid-management', 'getWordPositions', wordInfo) || []
  }

  isPositionUsedByOtherClues(row, col, excludeWordKey) {
    return this.delegateToController('grid-management', 'isPositionUsedByOtherClues', 
                                    row, col, excludeWordKey, this.appliedClues) ?? false
  }

  // Clue suggestion methods are now handled by CluesSuggestionsController

  getCurrentWordInfo(row, col) {
    // Delegate to word navigation logic controller
    return this.delegateToController('word-navigation-logic', 'getCurrentWordInfo', row, col, this.direction, this.gridData)
  }

  // Delegate intersecting constraints to create mode clue management controller
  getIntersectingConstraints(wordInfo) {
    const clueController = this.getController('create-mode-clue-management')
    if (clueController) {
      return clueController.getIntersectingConstraints(
        wordInfo, 
        this.gridData, 
        this.getWordPositions.bind(this), 
        this.calculateGridNumbering.bind(this)
      )
    }
    return []
  }

  // Delegate clue display and management to create mode clue management controller
  displayCluesSuggestions(clues, wordInfo) {
    this.delegateToController('create-mode-clue-management', 'displayCluesSuggestions', clues, wordInfo)
  }

  useClueForCurrentWord(clueId, answer, wordInfo, completions = []) {
    this.delegateToController('create-mode-clue-management', 'useClueForCurrentWord', clueId, answer, wordInfo, completions)
  }

  findWordInfoByNumber(number, direction) {
    return this.delegateToController('create-mode-clue-management', 'findWordInfoByNumber', number, direction) || null
  }

  savePuzzleClue(clueId, number, direction) {
    this.delegateToController('create-mode-clue-management', 'savePuzzleClue', clueId, number, direction)
  }

  undoClueForWord(wordKey, currentWordInfo) {
    this.delegateToController('create-mode-clue-management', 'undoClueForWord', wordKey, currentWordInfo)
  }

  clearCluesSuggestions() {
    this.delegateToController('create-mode-clue-management', 'clearCluesSuggestions')
  }

  updateCluesPreview() {
    // Skip clues preview update in play mode - clues are server-rendered
    if (this.modeValue === 'play') return
    
    this.delegateToController('create-mode-clue-management', 'updateCluesPreview')
  }

  // Puzzle validation and hint methods - delegate to play mode operations controller
  checkPuzzle() {
    const cluesData = this.delegateToController('play-mode-clue-management', 'getCluesData')
    this.delegateToController('play-mode-operations', 'checkPuzzle', 
                              cluesData, this.gridData, this.element.querySelector('.crossword-interactive-grid'))
  }

  checkWord() {
    const cluesData = this.delegateToController('play-mode-clue-management', 'getCluesData')
    this.delegateToController('play-mode-operations', 'checkWord', 
                              this.selectedRow, this.selectedCol, cluesData, this.gridData, this.direction)
  }

  revealLetter() {
    const cluesData = this.delegateToController('play-mode-clue-management', 'getCluesData')
    this.delegateToController('play-mode-operations', 'revealLetter', 
                              this.selectedRow, this.selectedCol, cluesData, this.gridData, this.direction)
  }

  revealWord() {
    const cluesData = this.delegateToController('play-mode-clue-management', 'getCluesData')
    this.delegateToController('play-mode-operations', 'revealWord', 
                              this.selectedRow, this.selectedCol, cluesData, this.gridData, this.direction)
  }

  resetPuzzle() {
    console.log('Main controller: resetPuzzle called')
    const playModeController = this.getController('play-mode-operations')
    if (playModeController) {
      console.log('Found play mode controller, calling resetPuzzle')
      const result = playModeController.resetPuzzle(this.gridData, this.gridHeight, this.gridWidth)
      if (result) {
        console.log('Reset puzzle returned true, reinitializing grid')
        // Puzzle was reset - update local state
        this.initializeGrid()
      } else {
        console.log('Reset puzzle returned false (user cancelled)')
      }
    } else {
      console.log('No play mode controller found')
    }
  }

  // Event handlers for play mode operations controller
  handleCellReveal(event) {
    const { row, col, value, message, messageType } = event.detail
    this.delegateToController('ui-message-display', 'setCellValue', row, col, value)
    this.delegateToController('ui-message-display', 'clearCellError', row, col)
    if (message) {
      this.delegateToController('ui-message-display', 'showMessage', message, messageType)
    }
  }

  handleWordReveal(event) {
    const { clue, message, messageType } = event.detail
    this.delegateToController('ui-message-display', 'fillClueWord', clue)
    if (message) {
      this.delegateToController('ui-message-display', 'showMessage', message, messageType)
    }
  }

  handlePuzzleReset(event) {
    const { message, messageType } = event.detail
    
    // Delegate to grid management controller to properly reset the grid
    const gridController = this.getController('grid-management')
    if (gridController) {
      gridController.resetPuzzleGrid(this.gridData)
    } else {
      console.error('Grid management controller not found for puzzle reset')
      // Fallback manual reset
      for (let row = 0; row < this.gridHeight; row++) {
        for (let col = 0; col < this.gridWidth; col++) {
          if (this.gridData[row][col] !== '#') {
            this.gridData[row][col] = null
            
            // Update the cell display
            const cell = this.getCellElement(row, col)
            if (cell) {
              cell.classList.remove('error', 'correct')
              // Keep the cell number but clear the letter
              const existingNumber = cell.querySelector('.cell-number')
              const numberHtml = existingNumber ? existingNumber.outerHTML : ''
              cell.innerHTML = numberHtml
            }
          }
        }
      }
      
      // Update the grid data input field
      this.updateGridData()
    }
    
    // Clear any current selection and highlights
    if (this.selectedCell) {
      this.selectedCell.classList.remove('selected')
      this.selectedCell = null
      this.selectedRow = null
      this.selectedCol = null
    }
    this.clearHighlights()
    
    // Show success message
    if (message) {
      this.delegateToController('ui-message-display', 'showMessage', message, messageType)
    }
  }

  handlePuzzleCompleted(event) {
    this.delegateToController('ui-message-display', 'showPuzzleCompletedMessage')
  }

  handleShowMessage(event) {
    const { text, type } = event.detail
    this.delegateToController('ui-message-display', 'showMessage', text, type)
  }

}
