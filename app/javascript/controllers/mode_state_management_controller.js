// Mode & State Management Controller - Aug 3, 2025
import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = []
  static values = {
    mode: String
  }

  connect() {
    this.initializeState()
  }

  // Get access to main controller for delegation and grid access
  getMainController() {
    return this.application.getControllerForElementAndIdentifier(this.element, 'crossword-game')
  }

  // Initialize all state variables in one place
  initializeState() {
    this.state = {
      // Selection and navigation
      selectedCell: null,
      selectedRow: null,
      selectedCol: null,
      direction: 'across',
      
      // Mode state
      isBlockMode: false,
      
      // Clue tracking (create mode)
      usedClueIds: new Set(),
      appliedClues: new Map()
    }
  }

  // State getters and setters
  getSelectedCell() { return this.state.selectedCell }
  setSelectedCell(value) { this.state.selectedCell = value }
  
  getSelectedRow() { return this.state.selectedRow }
  setSelectedRow(value) { this.state.selectedRow = value }
  
  getSelectedCol() { return this.state.selectedCol }
  setSelectedCol(value) { this.state.selectedCol = value }
  
  getDirection() { return this.state.direction }
  setDirection(value) { this.state.direction = value }
  
  getIsBlockMode() { return this.state.isBlockMode }
  setIsBlockMode(value) { this.state.isBlockMode = value }
  
  getUsedClueIds() { return this.state.usedClueIds }
  setUsedClueIds(value) { this.state.usedClueIds = value }
  
  getAppliedClues() { return this.state.appliedClues }
  setAppliedClues(value) { this.state.appliedClues = value }

  // Toggle between block mode and letter mode (create mode only)
  toggleMode() {
    this.state.isBlockMode = !this.state.isBlockMode

    const mainController = this.getMainController()
    if (!mainController) return

    // Notify navigation controller of block mode change
    mainController.delegateToController('navigation', 'setBlockMode', this.state.isBlockMode)

    // Clear highlights when entering block mode
    if (this.state.isBlockMode) {
      mainController.delegateToController('highlight', 'clearHighlights')
      // Also remove selected state since we can't select blocked cells in block mode
      if (this.state.selectedCell) {
        this.state.selectedCell.classList.remove('selected')
        this.state.selectedCell = null
        this.state.selectedRow = null
        this.state.selectedCol = null
      }
    }

    this.updateToggleButton()
  }

  // Update the toggle button text and styling
  updateToggleButton() {
    const toggleBtn = this.element.querySelector('#toggle-mode-btn')
    if (toggleBtn) {
      toggleBtn.textContent = this.state.isBlockMode ? 'Switch to Letter Mode' : 'Switch to Block Mode'
      toggleBtn.className = this.state.isBlockMode ?
        'btn btn-sm btn-outline-danger' :
        'btn btn-sm btn-outline-secondary'
    }
  }

  // Clear the entire grid (with confirmation)
  clearGrid() {
    if (confirm('Are you sure you want to clear the entire grid?')) {
      const mainController = this.getMainController()
      if (!mainController) return

      if (this.modeValue === 'play') {
        // In play mode, clear all user entries but keep the grid structure
        this.clearUserEntries()
      } else {
        // In create mode, delegate to grid management controller for full clear
        mainController.delegateToController('grid-management', 'clearGrid', mainController.gridData)
      }
    }
  }

  // Clear user entries while preserving grid structure (play mode)
  clearUserEntries() {
    const mainController = this.getMainController()
    if (!mainController) return

    // Clear all user-entered letters while preserving the grid structure
    for (let row = 0; row < mainController.gridHeight; row++) {
      for (let col = 0; col < mainController.gridWidth; col++) {
        if (mainController.gridData[row][col] && mainController.gridData[row][col] !== '#') {
          // Clear the letter but keep any block structure
          mainController.gridData[row][col] = null
          const cell = mainController.getCellElement(row, col)
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
    mainController.updateGridData()
    
    // Save the cleared state to server if in play mode
    if (mainController.puzzleIdValue) {
      mainController.delegateToController('play-mode-operations', 'saveClearedPuzzle')
    }
    
    // Clear any selection and highlights
    this.clearSelection()
    mainController.delegateToController('highlight', 'clearHighlights')
  }

  // Clear current selection state
  clearSelection() {
    if (this.state.selectedCell) {
      this.state.selectedCell.classList.remove('selected')
      this.state.selectedCell = null
      this.state.selectedRow = null
      this.state.selectedCol = null
    }
  }

  // Reset state to initial values
  resetState() {
    this.clearSelection()
    this.state.direction = 'across'
    this.state.isBlockMode = false
    this.state.usedClueIds.clear()
    this.state.appliedClues.clear()
    this.updateToggleButton()
  }

  // Check if in create mode
  isCreateMode() {
    return this.modeValue === 'create'
  }

  // Check if in play mode
  isPlayMode() {
    return this.modeValue === 'play'
  }

  // Check if currently in block mode (create mode only)
  isInBlockMode() {
    return this.isCreateMode() && this.state.isBlockMode
  }

  // Get current state snapshot for debugging
  getStateSnapshot() {
    return {
      selectedRow: this.state.selectedRow,
      selectedCol: this.state.selectedCol,
      direction: this.state.direction,
      isBlockMode: this.state.isBlockMode,
      mode: this.modeValue,
      usedCluesCount: this.state.usedClueIds.size,
      appliedCluesCount: this.state.appliedClues.size
    }
  }

  // Sync state from main controller (for migration period)
  syncFromMainController(mainController) {
    if (mainController.selectedCell !== undefined) {
      this.state.selectedCell = mainController.selectedCell
    }
    if (mainController.selectedRow !== undefined) {
      this.state.selectedRow = mainController.selectedRow
    }
    if (mainController.selectedCol !== undefined) {
      this.state.selectedCol = mainController.selectedCol
    }
    if (mainController.direction !== undefined) {
      this.state.direction = mainController.direction
    }
    if (mainController.isBlockMode !== undefined) {
      this.state.isBlockMode = mainController.isBlockMode
    }
    if (mainController.usedClueIds !== undefined) {
      this.state.usedClueIds = mainController.usedClueIds
    }
    if (mainController.appliedClues !== undefined) {
      this.state.appliedClues = mainController.appliedClues
    }
  }

  // Sync state back to main controller (for migration period)
  syncToMainController(mainController) {
    if (mainController) {
      mainController.selectedCell = this.state.selectedCell
      mainController.selectedRow = this.state.selectedRow
      mainController.selectedCol = this.state.selectedCol
      mainController.direction = this.state.direction
      mainController.isBlockMode = this.state.isBlockMode
      mainController.usedClueIds = this.state.usedClueIds
      mainController.appliedClues = this.state.appliedClues
    }
  }
}
