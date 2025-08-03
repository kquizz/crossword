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
    this.initializeState()
    this.initializeGrid()
    this.bindEvents()
    
    // Initialize the clues preview
    if (this.modeValue === 'create') {
      setTimeout(() => this.updateCluesPreview(), 100)
    }
  }

  // Centralized state management
  initializeState() {
    this.state = {
      // Selection and navigation
      selectedCell: null,
      selectedRow: null,
      selectedCol: null,
      direction: 'across',
      
      // Grid state
      highlightedCells: [],
      
      // Mode state
      isBlockMode: false,
      
      // Clue tracking (create mode)
      usedClueIds: new Set(),
      appliedClues: new Map(),
      
      // Clue data (play mode)
      cluesData: null,
      currentClue: null
    }
  }

  // State getters for backward compatibility and cleaner access
  get selectedCell() { return this.state.selectedCell }
  set selectedCell(value) { this.state.selectedCell = value }
  
  get selectedRow() { return this.state.selectedRow }
  set selectedRow(value) { this.state.selectedRow = value }
  
  get selectedCol() { return this.state.selectedCol }
  set selectedCol(value) { this.state.selectedCol = value }
  
  get direction() { return this.state.direction }
  set direction(value) { this.state.direction = value }
  
  get highlightedCells() { return this.state.highlightedCells }
  set highlightedCells(value) { this.state.highlightedCells = value }
  
  get isBlockMode() { return this.state.isBlockMode }
  set isBlockMode(value) { this.state.isBlockMode = value }
  
  get usedClueIds() { return this.state.usedClueIds }
  set usedClueIds(value) { this.state.usedClueIds = value }
  
  get appliedClues() { return this.state.appliedClues }
  set appliedClues(value) { this.state.appliedClues = value }
  
  get cluesData() { return this.state.cluesData }
  set cluesData(value) { this.state.cluesData = value }
  
  get currentClue() { return this.state.currentClue }
  set currentClue(value) { this.state.currentClue = value }

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
    
    const navigationController = this.getController('navigation')
    if (navigationController) {
      navigationController.updateGridDimensions(this.gridWidth, this.gridHeight)
      navigationController.updateDirection(this.direction)
      navigationController.updateCurrentPosition(this.selectedRow, this.selectedCol)
      navigationController.setBlockMode(this.isBlockMode)
      navigationController.updateGridData(this.gridData)
    }
    
    this.delegateToController('grid-management', 'updateGridDimensions', this.gridWidth, this.gridHeight)
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

      // Load clues data for play mode
      this.loadCluesData()

      // Notify all controllers of grid dimensions and state
      this.notifyControllers()
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
      { target: document, event: 'keydown', handler: 'handleKeydown' },
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
        // Fallback implementation
        if (this.isValidPosition(row, col)) {
          const currentValue = this.gridData[row][col]
          const newValue = currentValue === '#' ? null : '#'
          this.gridData[row][col] = newValue
          
          const cell = this.getCellElement(row, col)
          if (cell) {
            if (newValue === '#') {
              cell.classList.add('blocked')
              cell.innerHTML = ''
            } else {
              cell.classList.remove('blocked')
              cell.innerHTML = ''
            }
          }
          
          this.updateGridData()
        }
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
    this.clearHighlights()

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
        this.highlightCurrentWord(row, col)
        
        // Notify navigation controller to update direction indicator
        this.delegateToController('navigation', 'updateDirectionIndicator')
        
        // For play mode, update current clue display
        if (this.modeValue === 'play') {
          this.delegateToController('clue-display', 'updateCurrentClueFromPosition', row, col, this.direction)
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

  clearHighlights() {
    this.highlightedCells.forEach(cell => {
      cell.classList.remove('highlighted')
    })
    this.highlightedCells = []
  }

  highlightCurrentWord(row, col) {
    if (this.direction === 'across') {
      this.highlightAcrossWord(row, col)
    } else {
      this.highlightDownWord(row, col)
    }
  }

  highlightAcrossWord(row, col) {
    // Find start of word (leftmost non-blocked cell)
    let startCol = col
    while (startCol > 0 && !this.isCellBlocked(row, startCol - 1)) {
      startCol--
    }

    // Find end of word (rightmost non-blocked cell)
    let endCol = col
    while (endCol < this.gridWidth - 1 && !this.isCellBlocked(row, endCol + 1)) {
      endCol++
    }

    // Highlight the word (only if it's more than 1 letter)
    if (endCol > startCol) {
      for (let c = startCol; c <= endCol; c++) {
        const cell = this.getCellElement(row, c)
        if (cell && !cell.classList.contains('blocked')) {
          cell.classList.add('highlighted')
          this.highlightedCells.push(cell)
        }
      }
    }
  }

  highlightDownWord(row, col) {
    // Find start of word (topmost non-blocked cell)
    let startRow = row
    while (startRow > 0 && !this.isCellBlocked(startRow - 1, col)) {
      startRow--
    }

    // Find end of word (bottommost non-blocked cell)
    let endRow = row
    while (endRow < this.gridHeight - 1 && !this.isCellBlocked(endRow + 1, col)) {
      endRow++
    }

    // Highlight the word (only if it's more than 1 letter)
    if (endRow > startRow) {
      for (let r = startRow; r <= endRow; r++) {
        const cell = this.getCellElement(r, col)
        if (cell && !cell.classList.contains('blocked')) {
          cell.classList.add('highlighted')
          this.highlightedCells.push(cell)
        }
      }
    }
  }

  handleKeydown(event) {
    // Don't handle keydown if user is typing in a form field
    if (this.shouldIgnoreKeydown(event)) return
    if (!this.selectedCell) return

    const context = this.getKeydownContext(event)
    
    // Handle keys based on mode
    if (context.isBlockMode) {
      this.handleBlockModeKey(event, context)
    } else {
      this.handleLetterModeKey(event, context)
    }
  }

  // Helper methods for keyboard handling
  shouldIgnoreKeydown(event) {
    const ignoreTags = ['INPUT', 'TEXTAREA', 'SELECT']
    return ignoreTags.includes(event.target.tagName)
  }

  getKeydownContext(event) {
    return {
      row: this.selectedRow,
      col: this.selectedCol,
      key: event.key,
      isShiftModifier: event.shiftKey,
      isBlockMode: this.modeValue === 'create' && this.isBlockMode,
      isPlayMode: this.modeValue === 'play',
      isCreateMode: this.modeValue === 'create'
    }
  }

  handleBlockModeKey(event, context) {
    const keyHandlers = this.getBlockModeKeyHandlers()
    const handler = keyHandlers[context.key]
    
    if (handler) {
      event.preventDefault()
      handler(context)
    }
  }

  handleLetterModeKey(event, context) {
    const keyHandlers = this.getLetterModeKeyHandlers()
    const handler = keyHandlers[context.key]
    
    if (handler) {
      event.preventDefault()
      // Special case for Tab key which needs the event object
      if (context.key === 'Tab') {
        handler(context, event)
      } else {
        handler(context)
      }
    } else if (context.key.match(/^[a-zA-Z]$/)) {
      event.preventDefault()
      this.handleLetterInput(context, context.key.toUpperCase())
    }
  }

  // Configuration for block mode key handlers
  getBlockModeKeyHandlers() {
    const navigationController = this.getController('navigation')
    
    return {
      'ArrowUp': (context) => {
        if (navigationController) {
          navigationController.moveSelection(context.row - 1, context.col)
        }
      },
      'ArrowDown': (context) => {
        if (navigationController) {
          navigationController.moveSelection(context.row + 1, context.col)
        }
      },
      'ArrowLeft': (context) => {
        if (navigationController) {
          navigationController.moveSelection(context.row, context.col - 1)
        }
      },
      'ArrowRight': (context) => {
        if (navigationController) {
          navigationController.moveSelection(context.row, context.col + 1)
        }
      },
      ' ': (context) => {
        const gridController = this.getController('grid-management')
        if (gridController) {
          gridController.toggleBlock(context.row, context.col, this.gridData)
        } else {
          this.toggleBlock(context.row, context.col)
        }
      }
    }
  }

  // Configuration for letter mode key handlers
  getLetterModeKeyHandlers() {
    const navigationController = this.getController('navigation')
    
    return {
      'Enter': (context) => {
        if (navigationController) {
          navigationController.toggleDirection()
        }
      },
      'ArrowUp': (context) => {
        this.handleArrowKey(context, 'down', context.row - 1, context.col)
      },
      'ArrowDown': (context) => {
        this.handleArrowKey(context, 'down', context.row + 1, context.col)
      },
      'ArrowLeft': (context) => {
        this.handleArrowKey(context, 'across', context.row, context.col - 1)
      },
      'ArrowRight': (context) => {
        this.handleArrowKey(context, 'across', context.row, context.col + 1)
      },
      'Backspace': (context) => this.handleDeleteKey(context, true),
      'Delete': (context) => this.handleDeleteKey(context, true),
      ' ': (context) => this.handleSpaceKey(context),
      'Tab': (context, event) => this.handleTabKey(context, event)
    }
  }

  // Specialized handlers for complex keys
  handleArrowKey(context, direction, newRow, newCol) {
    this.direction = direction
    const navigationController = this.getController('navigation')
    if (navigationController) {
      navigationController.updateDirection(direction)
      navigationController.moveSelection(newRow, newCol)
    }
  }

  handleDeleteKey(context, moveBackward) {
    const gridController = this.getController('grid-management')
    if (gridController) {
      gridController.setCellValue(context.row, context.col, '', this.gridData)
    } else {
      // Fallback implementation
      this.gridData[context.row][context.col] = null
      const cell = this.getCellElement(context.row, context.col)
      if (cell) {
        cell.classList.remove('blocked')
        const existingNumber = cell.querySelector('.cell-number')
        const numberHtml = existingNumber ? existingNumber.outerHTML : ''
        cell.innerHTML = numberHtml
      }
      this.updateGridData()
    }
    
    const navigationController = this.getController('navigation')
    if (navigationController) {
      navigationController.moveInDirection(context.row, context.col, moveBackward)
    }
  }

  handleSpaceKey(context) {
    if (context.isCreateMode) {
      const gridController = this.getController('grid-management')
      if (gridController) {
        gridController.toggleBlock(context.row, context.col, this.gridData)
      } else {
        this.toggleBlock(context.row, context.col)
      }
    } else {
      const navigationController = this.getController('navigation')
      if (navigationController) {
        navigationController.moveInDirection(context.row, context.col, false)
      }
    }
  }

  handleTabKey(context, event) {
    console.log('Tab pressed, shiftKey:', event.shiftKey, 'mode:', this.modeValue)
    if (context.isPlayMode) {
      // In play mode, use unfilled word navigation
      if (event.shiftKey) {
        console.log('Calling moveToPreviousUnfilledWord')
        this.moveToPreviousUnfilledWord()
      } else {
        console.log('Calling moveToNextUnfilledWord')
        this.moveToNextUnfilledWord()
      }
    } else {
      // In create mode, use basic word navigation
      const navigationController = this.getController('navigation')
      if (navigationController) {
        if (event.shiftKey) {
          navigationController.moveToPreviousWord()
        } else {
          navigationController.moveToNextWord()
        }
      }
    }
  }

  handleLetterInput(context, letter) {
    const gridController = this.getController('grid-management')
    if (gridController) {
      gridController.setCellValue(context.row, context.col, letter, this.gridData)
    } else {
      // Fallback implementation
      this.gridData[context.row][context.col] = letter
      const cell = this.getCellElement(context.row, context.col)
      if (cell) {
        cell.classList.remove('blocked', 'error')
        const existingNumber = cell.querySelector('.cell-number')
        const numberHtml = existingNumber ? existingNumber.outerHTML : ''
        cell.innerHTML = numberHtml + `<span class="cell-letter">${letter}</span>`
      }
      this.updateGridData()
      
      // If in play mode and puzzle exists, save to server
      if (context.isPlayMode && this.puzzleIdValue) {
        this.saveCell(context.row, context.col, letter)
      }
    }
    
    // Handle auto-advance in play mode
    if (context.isPlayMode && this.isWordComplete(context.row, context.col)) {
      console.log('Word completed at', context.row, context.col, '- auto-advancing to next unfilled word')
      this.moveToNextUnfilledWord()
    } else {
      const navigationController = this.getController('navigation')
      if (navigationController) {
        navigationController.moveInDirection(context.row, context.col, false)
      }
    }
  }

  toggleDirection() {
    // Don't toggle direction in block mode
    if (this.modeValue === 'create' && this.isBlockMode) {
      return
    }

    this.direction = this.direction === 'across' ? 'down' : 'across'
    this.clearHighlights()
    this.highlightCurrentWord(this.selectedRow, this.selectedCol)
    
    // Notify navigation controller to update direction indicator
    const navigationController = this.application.getControllerForElementAndIdentifier(this.element, 'navigation')
    if (navigationController) {
      navigationController.updateDirection(this.direction)
      navigationController.updateDirectionIndicator()
    }
    
    // Update clue highlighting for the new direction in play mode
    if (this.modeValue === 'play' && this.selectedRow !== undefined && this.selectedCol !== undefined) {
      const clueDisplayController = this.application.getControllerForElementAndIdentifier(this.element, 'clue-display')
      if (clueDisplayController) {
        clueDisplayController.updateCurrentClueFromPosition(this.selectedRow, this.selectedCol, this.direction)
      }
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

  // Check if the current word is completely filled after typing in a cell
  isWordComplete(row, col) {
    console.log(`Checking if word is complete at (${row}, ${col})`)
    
    // Ensure clues data is loaded
    if (!this.cluesData) {
      console.log('Clues data not loaded, attempting to load now')
      this.loadCluesData()
    }
    
    const playModeController = this.application.getControllerForElementAndIdentifier(this.element, 'play-mode-operations')
    if (playModeController) {
      const result = playModeController.isWordComplete(row, col, this.cluesData, this.gridData, this.direction)
      console.log(`Word complete result: ${result}`)
      return result
    }
    console.log('No play mode controller found')
    return false
  }

  // Get the bounds of the current word
  getCurrentWordBounds(row, col) {
    if (this.direction === 'across') {
      // Find start and end of across word
      let startCol = col
      while (startCol > 0 && !this.isCellBlocked(row, startCol - 1)) {
        startCol--
      }
      let endCol = col
      while (endCol < this.gridWidth - 1 && !this.isCellBlocked(row, endCol + 1)) {
        endCol++
      }
      
      // Only return bounds if it's a valid word (more than 1 letter)
      if (endCol > startCol) {
        return { startRow: row, endRow: row, startCol, endCol }
      }
    } else {
      // Find start and end of down word
      let startRow = row
      while (startRow > 0 && !this.isCellBlocked(startRow - 1, col)) {
        startRow--
      }
      let endRow = row
      while (endRow < this.gridHeight - 1 && !this.isCellBlocked(endRow + 1, col)) {
        endRow++
      }
      
      // Only return bounds if it's a valid word (more than 1 letter)
      if (endRow > startRow) {
        return { startRow, endRow, startCol: col, endCol: col }
      }
    }
    return null
  }

  // Move to the next unfilled word in the current direction, or switch directions
  moveToNextUnfilledWord() {
    console.log(`Main controller: moveToNextUnfilledWord called from (${this.selectedRow}, ${this.selectedCol}) direction: ${this.direction}`)
    
    // Ensure clues data is loaded
    if (!this.cluesData) {
      console.log('Clues data not loaded, attempting to load now')
      this.loadCluesData()
    }
    
    const playModeController = this.application.getControllerForElementAndIdentifier(this.element, 'play-mode-operations')
    if (playModeController) {
      console.log('Found play mode controller, calling moveToNextUnfilledWord')
      const nextPosition = playModeController.moveToNextUnfilledWord(this.cluesData, this.gridData, this.direction, this.selectedRow, this.selectedCol)
      if (nextPosition) {
        console.log(`Moving to next position: (${nextPosition.row}, ${nextPosition.col}) direction: ${nextPosition.direction}`)
        this.direction = nextPosition.direction
        this.selectCell(nextPosition.row, nextPosition.col)
        return
      } else {
        console.log('No next unfilled word found by play mode controller')
      }
    } else {
      console.log('No play mode controller found')
    }

    // Fallback to normal navigation
    console.log('Falling back to normal navigation')
    const navigationController = this.application.getControllerForElementAndIdentifier(this.element, 'navigation')
    if (navigationController) {
      navigationController.moveInDirection(this.selectedRow, this.selectedCol, false)
    }
  }

  moveToPreviousUnfilledWord() {
    console.log(`Main controller: moveToPreviousUnfilledWord called from (${this.selectedRow}, ${this.selectedCol}) direction: ${this.direction}`)
    const playModeController = this.application.getControllerForElementAndIdentifier(this.element, 'play-mode-operations')
    if (playModeController) {
      console.log('Found play mode controller, calling moveToPreviousUnfilledWord')
      const prevPosition = playModeController.moveToPreviousUnfilledWord(this.cluesData, this.gridData, this.direction, this.selectedRow, this.selectedCol)
      if (prevPosition) {
        console.log(`Moving to previous position: (${prevPosition.row}, ${prevPosition.col}) direction: ${prevPosition.direction}`)
        this.direction = prevPosition.direction
        this.selectCell(prevPosition.row, prevPosition.col)
        return
      } else {
        console.log('No previous unfilled word found by play mode controller')
      }
    } else {
      console.log('No play mode controller found')
    }

    // Fallback to normal navigation
    console.log('Falling back to normal navigation')
    const navigationController = this.application.getControllerForElementAndIdentifier(this.element, 'navigation')
    if (navigationController) {
      navigationController.moveInDirection(this.selectedRow, this.selectedCol, true) // Move backward
    }
  }

  // Get the number of the current word
  getCurrentWordNumber() {
    const numbering = this.calculateGridNumbering(this.gridData)
    const wordBounds = this.getCurrentWordBounds(this.selectedRow, this.selectedCol)
    if (!wordBounds) return null

    // For both across and down, we want the starting position of the word
    const startKey = `${wordBounds.startRow},${wordBounds.startCol}`
    return numbering[startKey] || null
  }

  updateGridData() {
    const gridInput = document.getElementById('grid-data')
    if (gridInput) {
      gridInput.value = JSON.stringify(this.gridData)
    }
    
    // Update navigation controller with new grid data
    this.delegateToController('navigation', 'updateGridData', this.gridData)
  }

  toggleMode() {
    this.isBlockMode = !this.isBlockMode

    // Notify navigation controller of block mode change
    this.delegateToController('navigation', 'setBlockMode', this.isBlockMode)

    // Clear highlights when entering block mode
    if (this.isBlockMode) {
      this.clearHighlights()
      // Also remove selected state since we can't select blocked cells in block mode
      if (this.selectedCell) {
        this.selectedCell.classList.remove('selected')
        this.selectedCell = null
      }
    }

    const toggleBtn = this.element.querySelector('#toggle-mode-btn')
    if (toggleBtn) {
      toggleBtn.textContent = this.isBlockMode ? 'Switch to Letter Mode' : 'Switch to Block Mode'
      toggleBtn.className = this.isBlockMode ?
        'btn btn-sm btn-outline-danger' :
        'btn btn-sm btn-outline-secondary'
    }
  }

  clearGrid() {
    if (confirm('Are you sure you want to clear the entire grid?')) {
      if (this.modeValue === 'play') {
        // In play mode, clear all user entries but keep the grid structure
        this.clearUserEntries()
      } else {
        // In create mode, delegate to grid management controller for full clear
        this.delegateToController('grid-management', 'clearGrid', this.gridData)
      }
    }
  }

  clearUserEntries() {
    // Clear all user-entered letters while preserving the grid structure
    for (let row = 0; row < this.gridHeight; row++) {
      for (let col = 0; col < this.gridWidth; col++) {
        if (this.gridData[row][col] && this.gridData[row][col] !== '#') {
          // Clear the letter but keep any block structure
          this.gridData[row][col] = null
          const cell = this.getCellElement(row, col)
          if (cell && !cell.classList.contains('blocked')) {
            // Keep the cell number but remove the letter
            const existingNumber = cell.querySelector('.cell-number')
            const numberHtml = existingNumber ? existingNumber.outerHTML : ''
            cell.innerHTML = numberHtml
            cell.classList.remove('error', 'correct')
          }
        }
      }
    }
    
    // Update the grid data
    this.updateGridData()
    
    // Save the cleared state to server if in play mode
    if (this.puzzleIdValue) {
      this.delegateToController('play-mode-operations', 'saveClearedPuzzle')
    }
    
    // Clear any selection and highlights
    if (this.selectedCell) {
      this.selectedCell.classList.remove('selected')
      this.selectedCell = null
      this.selectedRow = null
      this.selectedCol = null
    }
    this.clearHighlights()
  }

  // Event handlers for navigation controller
  handleMoveToCell(event) {
    const { row, col } = event.detail
    this.selectCell(row, col)
  }

  handleDirectionChanged(event) {
    const { direction } = event.detail
    this.direction = direction
    this.clearHighlights()
    this.highlightCurrentWord(this.selectedRow, this.selectedCol)
    
    // Update clue highlighting for the new direction in play mode
    if (this.modeValue === 'play' && this.selectedRow !== undefined && this.selectedCol !== undefined) {
      const clueDisplayController = this.application.getControllerForElementAndIdentifier(this.element, 'clue-display')
      if (clueDisplayController) {
        clueDisplayController.updateCurrentClueFromPosition(this.selectedRow, this.selectedCol, this.direction)
      }
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
    
    // Update the clues preview
    this.updateCluesPreview()
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
    this.updateCluesPreview()
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
    const result = this.delegateToController('grid-management', 'getWordPositions', wordInfo)
    if (result) return result
    
    // Fallback implementation
    const positions = []
    if (wordInfo.direction === 'across') {
      for (let i = 0; i < wordInfo.length; i++) {
        positions.push({
          row: wordInfo.startRow,
          col: wordInfo.startCol + i
        })
      }
    } else {
      for (let i = 0; i < wordInfo.length; i++) {
        positions.push({
          row: wordInfo.startRow + i,
          col: wordInfo.startCol
        })
      }
    }
    return positions
  }

  isPositionUsedByOtherClues(row, col, excludeWordKey) {
    const result = this.delegateToController('grid-management', 'isPositionUsedByOtherClues', 
                                            row, col, excludeWordKey, this.appliedClues)
    if (result !== null) return result
    
    // Fallback implementation
    for (const [wordKey, appliedClue] of this.appliedClues.entries()) {
      if (wordKey === excludeWordKey) continue
      
      const positions = this.getWordPositions(appliedClue.wordInfo)
      const isUsed = positions.some(pos => pos.row === row && pos.col === col)
      if (isUsed) return true
    }
    return false
  }

  // Clue suggestion methods are now handled by CluesSuggestionsController

  getCurrentWordInfo(row, col) {
    // Delegate to grid management controller
    const gridController = this.application.getControllerForElementAndIdentifier(this.element, 'grid-management')
    if (gridController) {
      return gridController.getCurrentWordInfo(row, col, this.direction, this.gridData)
    }
    
    // Fallback to original implementation
    const numbering = this.calculateGridNumbering(this.gridData)
    let wordInfo = null

    if (this.direction === 'across') {
      // Find start of current across word
      let startCol = col
      while (startCol > 0 && !this.isCellBlocked(row, startCol - 1)) {
        startCol--
      }

      // Find end of current across word
      let endCol = col
      while (endCol < this.gridWidth - 1 && !this.isCellBlocked(row, endCol + 1)) {
        endCol++
      }

      // Check if this word has a number (starts a word)
      const wordNumber = numbering[`${row},${startCol}`]
      if (wordNumber && endCol > startCol) {
        // Get current word pattern
        let pattern = ''
        for (let c = startCol; c <= endCol; c++) {
          const cellValue = this.gridData[row][c]
          pattern += cellValue || '_'
        }

        wordInfo = {
          number: wordNumber,
          direction: 'across',
          length: endCol - startCol + 1,
          pattern: pattern,
          startRow: row,
          startCol: startCol
        }
      }
    } else {
      // Find start of current down word
      let startRow = row
      while (startRow > 0 && !this.isCellBlocked(startRow - 1, col)) {
        startRow--
      }

      // Find end of current down word
      let endRow = row
      while (endRow < this.gridHeight - 1 && !this.isCellBlocked(endRow + 1, col)) {
        endRow++
      }

      // Check if this word has a number (starts a word)
      const wordNumber = numbering[`${startRow},${col}`]
      if (wordNumber && endRow > startRow) {
        // Get current word pattern
        let pattern = ''
        for (let r = startRow; r <= endRow; r++) {
          const cellValue = this.gridData[r][col]
          pattern += cellValue || '_'
        }

        wordInfo = {
          number: wordNumber,
          direction: 'down',
          length: endRow - startRow + 1,
          pattern: pattern,
          startRow: startRow,
          startCol: col
        }
      }
    }

    return wordInfo
  }

  getIntersectingConstraints(wordInfo) {
    const constraints = []
    const positions = this.getWordPositions(wordInfo)

    console.log(`🎯 Getting intersecting constraints for ${wordInfo.direction} word at ${wordInfo.startRow},${wordInfo.startCol}`)
    console.log('📍 Word positions:', positions)

    positions.forEach((pos, index) => {
      // For each position in the current word, check if there are intersecting words
      // that would constrain what letter can go there
      const intersectingWordInfo = this.getIntersectingWordAt(pos.row, pos.col, wordInfo.direction)
      
      if (intersectingWordInfo && intersectingWordInfo.hasConstraints) {
        const constraint = {
          position: index, // Position within the current word (0-based)
          intersecting_direction: intersectingWordInfo.direction,
          intersecting_number: intersectingWordInfo.number,
          intersecting_pattern: intersectingWordInfo.pattern,
          intersecting_position: intersectingWordInfo.intersectionPosition
        }
        constraints.push(constraint)
        console.log(`✓ Found constraint at position ${index}:`, constraint)
      } else {
        console.log(`○ No constraint at position ${index} (${pos.row},${pos.col})`)
      }
    })

    console.log('🔗 Final constraints:', constraints)
    return constraints
  }

  getIntersectingWordAt(row, col, currentDirection) {
    // Get the perpendicular direction
    const intersectingDirection = currentDirection === 'across' ? 'down' : 'across'
    
    let wordInfo = null
    const numbering = this.calculateGridNumbering(this.gridData)

    if (intersectingDirection === 'across') {
      // Find start of intersecting across word
      let startCol = col
      while (startCol > 0 && !this.isCellBlocked(row, startCol - 1)) {
        startCol--
      }

      // Find end of intersecting across word
      let endCol = col
      while (endCol < this.gridWidth - 1 && !this.isCellBlocked(row, endCol + 1)) {
        endCol++
      }

      // Check if this is a valid word (more than 1 letter)
      if (endCol > startCol) {
        let pattern = ''
        let hasConstraints = false
        
        for (let c = startCol; c <= endCol; c++) {
          const cellValue = this.gridData[row][c]
          if (cellValue && cellValue !== '#') {
            pattern += cellValue
            hasConstraints = true // Has existing letters
          } else {
            pattern += '_'
          }
        }

        // Even if no letters exist yet, this is still a constraint if it's a valid word slot
        // Check if this position would start a numbered word
        const wordNumber = numbering[`${row},${startCol}`]
        if (wordNumber || hasConstraints) {
          wordInfo = {
            direction: 'across',
            pattern: pattern,
            intersectionPosition: col - startCol, // This is the key fix - position within the intersecting word
            hasConstraints: hasConstraints || (endCol - startCol + 1) >= 3 // Constraint if it has letters OR is a valid word length
          }
          console.log(`🔍 Found intersecting across word at row ${row}, cols ${startCol}-${endCol}`)
          console.log(`   Pattern: "${pattern}", intersection at position ${col - startCol}`)
        }
      }
    } else {
      // Find start of intersecting down word
      let startRow = row
      while (startRow > 0 && !this.isCellBlocked(startRow - 1, col)) {
        startRow--
      }

      // Find end of intersecting down word
      let endRow = row
      while (endRow < this.gridHeight - 1 && !this.isCellBlocked(endRow + 1, col)) {
        endRow++
      }

      // Check if this is a valid word (more than 1 letter)
      if (endRow > startRow) {
        let pattern = ''
        let hasConstraints = false
        
        for (let r = startRow; r <= endRow; r++) {
          const cellValue = this.gridData[r][col]
          if (cellValue && cellValue !== '#') {
            pattern += cellValue
            hasConstraints = true // Has existing letters
          } else {
            pattern += '_'
          }
        }

        // Even if no letters exist yet, this is still a constraint if it's a valid word slot
        // Check if this position would start a numbered word
        const wordNumber = numbering[`${startRow},${col}`]
        if (wordNumber || hasConstraints) {
          wordInfo = {
            direction: 'down',
            pattern: pattern,
            intersectionPosition: row - startRow, // This is the key fix - position within the intersecting word
            hasConstraints: hasConstraints || (endRow - startRow + 1) >= 3 // Constraint if it has letters OR is a valid word length
          }
          console.log(`🔍 Found intersecting down word at col ${col}, rows ${startRow}-${endRow}`)
          console.log(`   Pattern: "${pattern}", intersection at position ${row - startRow}`)
        }
      }
    }

    return wordInfo
  }

  displayCluesSuggestions(clues, wordInfo) {
    const cluesPanel = this.element.querySelector('.clues-suggestions')
    if (!cluesPanel) return

    // Filter out clues that have already been used
    const availableClues = clues.filter(clue => !this.usedClueIds.has(clue.id.toString()))

    // Create a unique key for this word position
    const wordKey = `${wordInfo.startRow},${wordInfo.startCol},${wordInfo.direction}`
    const currentAppliedClue = this.appliedClues.get(wordKey)

    let html = `
      <div class="clues-header">
        <h4>Matching Clues</h4>
        <p>Word: ${wordInfo.number} ${wordInfo.direction} (${wordInfo.length} letters)</p>
        <p>Pattern: ${wordInfo.pattern.replace(/_/g, '□')}</p>
      </div>
    `

    // If there's already a clue applied to this word, show undo option
    if (currentAppliedClue) {
      html += `
        <div class="current-clue">
          <h5>Current Clue:</h5>
          <div class="clue-item applied">
            <div class="clue-text">${currentAppliedClue.clueText}</div>
            <div class="clue-answer">${currentAppliedClue.answer} (${currentAppliedClue.answer.length})</div>
          </div>
          <button class="btn btn-sm btn-outline-warning undo-clue-btn" data-word-key="${wordKey}">
            Undo This Clue
          </button>
        </div>
        <hr>
      `
    }

    if (availableClues.length === 0) {
      html += '<p class="no-clues">No unused matching clues found</p>'
    } else {
      html += '<div class="clues-list">'
      availableClues.forEach(clue => {
        let completionInfo = ''
        if (clue.completed_intersections && clue.completed_intersections.length > 0) {
          const completions = clue.completed_intersections.map(comp => 
            `${comp.number} ${comp.direction}: "${comp.clue_text}"`
          ).join(', ')
          completionInfo = `<div class="completion-info">✅ Will complete: ${completions}</div>`
        }
        
        html += `
          <div class="clue-item clickable" data-clue-id="${clue.id}" data-answer="${clue.answer}" data-completions='${JSON.stringify(clue.completed_intersections || [])}'>
            <div class="clue-text">${clue.clue_text}</div>
            <div class="clue-answer">${clue.answer} (${clue.answer.length})</div>
            ${completionInfo}
          </div>
        `
      })
      html += '</div>'
    }

    cluesPanel.innerHTML = html

    // Add event listeners for clickable clue items
    cluesPanel.querySelectorAll('.clue-item.clickable').forEach(item => {
      item.addEventListener('click', (e) => {
        const clueId = item.dataset.clueId
        const answer = item.dataset.answer
        const completions = JSON.parse(item.dataset.completions || '[]')
        this.useClueForCurrentWord(clueId, answer, wordInfo, completions)
      })
    })

    // Add event listener for undo button
    const undoBtn = cluesPanel.querySelector('.undo-clue-btn')
    if (undoBtn) {
      undoBtn.addEventListener('click', (e) => {
        const wordKey = e.target.dataset.wordKey
        this.undoClueForWord(wordKey, wordInfo)
      })
    }
  }

  useClueForCurrentWord(clueId, answer, wordInfo, completions = []) {
    console.log('🎯 Applying clue:', answer, 'with completions:', completions)
    
    // Add this clue to the used clues set
    this.usedClueIds.add(clueId.toString())

    // Create a unique key for this word position
    const wordKey = `${wordInfo.startRow},${wordInfo.startCol},${wordInfo.direction}`
    
    // If there was already a clue applied to this word, remove it from used clues
    const previousClue = this.appliedClues.get(wordKey)
    if (previousClue) {
      this.usedClueIds.delete(previousClue.clueId.toString())
    }

    // Store the applied clue information
    this.appliedClues.set(wordKey, {
      clueId: clueId,
      clueText: this.element.querySelector(`[data-clue-id="${clueId}"] .clue-text`).textContent,
      answer: answer,
      wordInfo: { ...wordInfo }
    })

    // Fill in the answer in the grid
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

    // Process any completed intersections
    completions.forEach(completion => {
      console.log('🔗 Auto-applying completed intersection:', completion)
      
      // Mark this clue as used
      this.usedClueIds.add(completion.clue_id.toString())
      
      // Find the word info for this intersecting word
      const intersectingWordInfo = this.findWordInfoByNumber(completion.number, completion.direction)
      if (intersectingWordInfo) {
        const intersectingWordKey = `${intersectingWordInfo.startRow},${intersectingWordInfo.startCol},${intersectingWordInfo.direction}`
        
        // Store the applied clue information
        this.appliedClues.set(intersectingWordKey, {
          clueId: completion.clue_id,
          clueText: completion.clue_text,
          answer: completion.answer,
          wordInfo: { ...intersectingWordInfo },
          autoApplied: true // Mark as automatically applied
        })
        
        console.log('✅ Auto-applied clue for', completion.number, completion.direction, ':', completion.answer)
      }
    })

    // Save the clue association to the puzzle (if we have a puzzle ID)
    if (this.puzzleIdValue) {
      this.savePuzzleClue(clueId, wordInfo.number, wordInfo.direction)
    }
    
    // Refresh the clues suggestions to show the undo option
    this.displayCluesSuggestions([], wordInfo)
    
    // Update the clues preview
    this.updateCluesPreview()
  }

  findWordInfoByNumber(number, direction) {
    // Search through the grid to find the word with this number and direction
    for (let row = 0; row < this.gridHeight; row++) {
      for (let col = 0; col < this.gridWidth; col++) {
        const cell = this.getCell(row, col)
        if (cell && cell.dataset.number == number) {
          // Check if this cell starts a word in the specified direction
          const wordInfo = this.getWordInfoAt(row, col, direction)
          if (wordInfo && wordInfo.number == number && wordInfo.direction === direction) {
            return wordInfo
          }
        }
      }
    }
    return null
  }

  savePuzzleClue(clueId, number, direction) {
    fetch('/crossword_game/save_puzzle_clue', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': document.querySelector('[name="csrf-token"]').content
      },
      body: JSON.stringify({
        puzzle_id: this.puzzleIdValue,
        clue_id: clueId,
        number: number,
        direction: direction
      })
    })
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        console.log(`Saved clue ${clueId} for word ${number} ${direction}`)
      } else {
        console.error('Failed to save puzzle clue:', data.error)
      }
    })
    .catch(error => {
      console.error('Error saving puzzle clue:', error)
    })
  }

  undoClueForWord(wordKey, currentWordInfo) {
    const appliedClue = this.appliedClues.get(wordKey)
    if (!appliedClue) return

    // Remove the clue from used clues set
    this.usedClueIds.delete(appliedClue.clueId.toString())

    // Remove the clue from applied clues
    this.appliedClues.delete(wordKey)

    // Clear letters that are unique to this word (not part of intersecting words)
    const wordInfo = appliedClue.wordInfo
    const positions = this.getWordPositions(wordInfo)
    
    positions.forEach(({row, col}) => {
      // Check if this position is part of any other applied clue
      if (!this.isPositionUsedByOtherClues(row, col, wordKey)) {
        this.setCellValue(row, col, '')
      }
    })

    // Refresh the clues suggestions
    const clueController = this.application.getControllerForElementAndIdentifier(this.element, 'clue-suggestions')
    if (clueController) {
      const currentWord = this.getCurrentWordInfo()
      clueController.updateCluesSuggestions(currentWordInfo.startRow, currentWordInfo.startCol, currentWord, this.gridData)
    }
    
    // Update the clues preview
    this.updateCluesPreview()
  }

  clearCluesSuggestions() {
    const cluesPanel = this.element.querySelector('.clues-suggestions')
    if (cluesPanel) {
      cluesPanel.innerHTML = '<p class="no-selection">Select a word to see matching clues</p>'
    }
  }

  updateCluesPreview() {
    // Skip clues preview update in play mode - clues are server-rendered
    if (this.modeValue === 'play') return
    
    const acrossList = this.element.querySelector('#across-clues-list')
    const downList = this.element.querySelector('#down-clues-list')
    
    if (!acrossList || !downList) return

    const acrossClues = []
    const downClues = []
    const numbering = this.calculateGridNumbering(this.gridData)

    // Collect all applied clues organized by number and direction
    for (const [wordKey, appliedClue] of this.appliedClues.entries()) {
      const wordInfo = appliedClue.wordInfo
      const wordNumber = numbering[`${wordInfo.startRow},${wordInfo.startCol}`]
      
      if (wordNumber) {
        const clueEntry = {
          number: wordNumber,
          clueText: appliedClue.clueText,
          answer: appliedClue.answer
        }
        
        if (wordInfo.direction === 'across') {
          acrossClues.push(clueEntry)
        } else {
          downClues.push(clueEntry)
        }
      }
    }

    // Sort by number
    acrossClues.sort((a, b) => a.number - b.number)
    downClues.sort((a, b) => a.number - b.number)

    // Update across clues
    if (acrossClues.length === 0) {
      acrossList.innerHTML = '<p class="no-clues-yet">No across clues yet</p>'
    } else {
      acrossList.innerHTML = acrossClues.map(clue => 
        `<div class="clue-entry">
          <span class="clue-number">${clue.number}.</span> ${clue.clueText}
        </div>`
      ).join('')
    }

    // Update down clues
    if (downClues.length === 0) {
      downList.innerHTML = '<p class="no-clues-yet">No down clues yet</p>'
    } else {
      downList.innerHTML = downClues.map(clue => 
        `<div class="clue-entry">
          <span class="clue-number">${clue.number}.</span> ${clue.clueText}
        </div>`
      ).join('')
    }
  }

  // New methods for play mode clue functionality
  loadCluesData() {
    // First try to load clues data from the grid element's data attribute
    const gridElement = this.element.querySelector('.crossword-interactive-grid')
    if (gridElement && gridElement.dataset.clues) {
      try {
        this.cluesData = JSON.parse(gridElement.dataset.clues)
        console.log('📋 Loaded clues data from grid element:', this.cluesData)
        return
      } catch (e) {
        console.error('Failed to parse clues data:', e)
      }
    }

    // Try to get clues data from clue display controller
    const clueDisplayController = this.application.getControllerForElementAndIdentifier(this.element, 'clue-display')
    if (clueDisplayController && clueDisplayController.cluesData) {
      this.cluesData = clueDisplayController.cluesData
      console.log('📋 Loaded clues data from clue display controller:', this.cluesData)
      return
    }

    // Check if there's global clues data
    if (window.cluesData) {
      this.cluesData = window.cluesData
      console.log('📋 Loaded clues data from window:', this.cluesData)
      return
    }

    console.log('No clues data found anywhere')
    this.cluesData = { across: [], down: [] }
    
    // In play mode, also set up protection for server-rendered clues
    if (this.modeValue === 'play') {
      this.protectServerRenderedClues()
    }
  }

  protectServerRenderedClues() {
    const acrossList = this.element.querySelector('#across-clues-list')
    const downList = this.element.querySelector('#down-clues-list')
    
    if (acrossList && downList) {
      // Store original innerHTML to prevent it from being cleared
      const originalAcrossHTML = acrossList.innerHTML
      const originalDownHTML = downList.innerHTML
      
      // Override innerHTML setter to prevent clearing in play mode
      Object.defineProperty(acrossList, 'innerHTML', {
        get: function() { return this._innerHTML || originalAcrossHTML },
        set: function(value) {
          // Silently ignore attempts to change innerHTML in play mode
        }
      })
      
      Object.defineProperty(downList, 'innerHTML', {
        get: function() { return this._innerHTML || originalDownHTML },
        set: function(value) {
          // Silently ignore attempts to change innerHTML in play mode
        }
      })
    }
  }

  handleClueClick(event) {
    const clueItem = event.target.closest('.clue-item')
    if (!clueItem) return

    event.preventDefault()
    
    const direction = clueItem.dataset.direction
    const number = parseInt(clueItem.dataset.number)
    const row = parseInt(clueItem.dataset.row)
    const col = parseInt(clueItem.dataset.col)

    // Set direction and navigate to the clue's starting cell
    this.direction = direction
    this.selectCell(row, col)
    this.setActiveClue(clueItem, direction, number)
  }

  setActiveClue(clueItem, direction, number) {
    // Remove active class from all clue items
    this.element.querySelectorAll('.clue-item').forEach(item => {
      item.classList.remove('active')
    })

    // Add active class to clicked clue
    clueItem.classList.add('active')

    // Scroll the clue into view
    this.scrollClueIntoView(clueItem)

    // Update current clue display
    const clueText = clueItem.querySelector('.clue-text').textContent
    const clueLength = clueItem.querySelector('.clue-length').textContent
    
    this.updateCurrentClueDisplay(direction, number, clueText, clueLength)
    this.currentClue = { direction, number, clueText }
  }

  scrollClueIntoView(clueItem) {
    // Find the clues panel container
    const cluesPanel = clueItem.closest('.clues-panel')
    if (!cluesPanel) return

    // Get the bounds of the clue item and container
    const clueRect = clueItem.getBoundingClientRect()
    const panelRect = cluesPanel.getBoundingClientRect()

    // Check if the clue is outside the visible area
    const isAbove = clueRect.top < panelRect.top
    const isBelow = clueRect.bottom > panelRect.bottom

    if (isAbove || isBelow) {
      // Scroll the clue into view with some padding
      clueItem.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      })
    }
  }

  updateCurrentClueDisplay(direction, number, clueText, clueLength) {
    const titleElement = this.element.querySelector('#current-clue-title')
    const textElement = this.element.querySelector('#current-clue-text')

    if (titleElement && textElement) {
      titleElement.textContent = `${number} ${direction.charAt(0).toUpperCase() + direction.slice(1)}`
      textElement.textContent = `${clueText} ${clueLength}`
    }
  }

  updateCurrentClueFromPosition(row, col) {
    if (!this.cluesData) return

    // Find the clue that matches the current position and direction
    const clues = this.cluesData[this.direction] || []
    const matchingClue = clues.find(clue => {
      if (this.direction === 'across') {
        return clue.row === row && clue.col <= col && 
               col < clue.col + clue.answer.length
      } else {
        return clue.col === col && clue.row <= row && 
               row < clue.row + clue.answer.length
      }
    })

    if (matchingClue) {
      // Find and activate the corresponding clue item
      const clueItem = this.element.querySelector(
        `.clue-item[data-direction="${this.direction}"][data-number="${matchingClue.number}"]`
      )
      if (clueItem) {
        this.setActiveClue(clueItem, this.direction, matchingClue.number)
      }
    }
  }

  // Puzzle validation and hint methods - delegate to play mode operations controller
  checkPuzzle() {
    this.delegateToController('play-mode-operations', 'checkPuzzle', 
                              this.cluesData, this.gridData, this.element.querySelector('.crossword-interactive-grid'))
  }

  checkWord() {
    this.delegateToController('play-mode-operations', 'checkWord', 
                              this.selectedRow, this.selectedCol, this.cluesData, this.gridData, this.direction)
  }

  revealLetter() {
    this.delegateToController('play-mode-operations', 'revealLetter', 
                              this.selectedRow, this.selectedCol, this.cluesData, this.gridData, this.direction)
  }

  revealWord() {
    this.delegateToController('play-mode-operations', 'revealWord', 
                              this.selectedRow, this.selectedCol, this.cluesData, this.gridData, this.direction)
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
    this.setCellValue(row, col, value)
    this.clearCellError(row, col)
    if (message) {
      this.showMessage(message, messageType)
    }
  }

  handleWordReveal(event) {
    const { clue, message, messageType } = event.detail
    this.fillClueWord(clue)
    if (message) {
      this.showMessage(message, messageType)
    }
  }

  handlePuzzleReset(event) {
    const { message, messageType } = event.detail
    
    // Clear all cells in the grid data
    for (let row = 0; row < this.gridHeight; row++) {
      for (let col = 0; col < this.gridWidth; col++) {
        if (this.gridData[row][col] !== '#') {
          this.gridData[row][col] = null
          
          // Update the cell display
          const cell = this.getCellElement(row, col)
          if (cell) {
            cell.classList.remove('error')
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
    
    // Show success message
    if (message) {
      this.showMessage(message, messageType)
    }
  }

  handlePuzzleCompleted(event) {
    this.showPuzzleCompletedMessage()
  }

  handleShowMessage(event) {
    const { text, type } = event.detail
    this.showMessage(text, type)
  }

  // Helper methods that are still needed for delegation
  setCellValue(row, col, value) {
    const gridController = this.application.getControllerForElementAndIdentifier(this.element, 'grid-management')
    if (gridController) {
      gridController.setCellValue(row, col, value, this.gridData)
    }
  }

  clearCellError(row, col) {
    const cell = this.getCellElement(row, col)
    if (cell) {
      cell.classList.remove('error')
    }
  }

  fillClueWord(clue) {
    for (let i = 0; i < clue.answer.length; i++) {
      let fillRow, fillCol
      if (clue.direction === 'across') {
        fillRow = clue.row
        fillCol = clue.col + i
      } else {
        fillRow = clue.row + i
        fillCol = clue.col
      }

      this.setCellValue(fillRow, fillCol, clue.answer[i])
      this.clearCellError(fillRow, fillCol)
    }
  }

  showPuzzleCompletedMessage() {
    const message = document.createElement('div')
    message.className = 'puzzle-completed-message'
    message.innerHTML = `
      <div class="completion-content">
        <h2>🎉 Congratulations! 🎉</h2>
        <p>You've completed the puzzle!</p>
        <button class="btn btn-primary" onclick="this.parentElement.parentElement.remove()">
          Continue
        </button>
      </div>
    `
    
    // Add to the page
    document.body.appendChild(message)
    
    // Auto-remove after 10 seconds
    setTimeout(() => {
      if (message.parentElement) {
        message.remove()
      }
    }, 10000)
  }

  showMessage(text, type = 'info') {
    const message = document.createElement('div')
    message.className = `alert alert-${type} puzzle-message`
    message.textContent = text
    
    // Find a good place to show the message
    const controls = this.element.querySelector('.game-controls')
    if (controls) {
      controls.appendChild(message)
    } else {
      document.body.appendChild(message)
    }
    
    // Auto-remove after 3 seconds
    setTimeout(() => {
      if (message.parentElement) {
        message.remove()
      }
    }, 3000)
  }

}
