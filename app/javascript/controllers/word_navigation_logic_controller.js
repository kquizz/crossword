// Word Navigation Logic Controller - Aug 2, 2025
import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = []
  static values = {
    mode: String
  }

  connect() {
    // Ready to handle word navigation logic
  }

  // Get access to main controller for state and grid data
  getMainController() {
    return this.application.getControllerForElementAndIdentifier(this.element, 'crossword-game')
  }

  // Check if the current word is completely filled after typing in a cell
  isWordComplete(row, col, direction) {
    console.log(`Checking if word is complete at (${row}, ${col})`)
    
    const mainController = this.getMainController()
    if (!mainController) return false

    // Ensure clues data is loaded via play mode clue management controller
    const cluesData = mainController.delegateToController('play-mode-clue-management', 'getCluesData')
    if (!cluesData) {
      console.log('Clues data not loaded, attempting to load now')
      mainController.delegateToController('play-mode-clue-management', 'reloadCluesData')
    }
    
    const playModeController = mainController.getController('play-mode-operations')
    if (playModeController) {
      const result = playModeController.isWordComplete(row, col, cluesData, mainController.gridData, direction)
      console.log(`Word complete result: ${result}`)
      return result
    }
    console.log('No play mode controller found')
    return false
  }

  // Get the bounds of the current word
  getCurrentWordBounds(row, col, direction, gridData, gridWidth, gridHeight) {
    const mainController = this.getMainController()
    if (!mainController) return null

    if (direction === 'across') {
      // Find start and end of across word
      let startCol = col
      while (startCol > 0 && !mainController.isCellBlocked(row, startCol - 1)) {
        startCol--
      }
      let endCol = col
      while (endCol < gridWidth - 1 && !mainController.isCellBlocked(row, endCol + 1)) {
        endCol++
      }
      
      // Only return bounds if it's a valid word (more than 1 letter)
      if (endCol > startCol) {
        return { startRow: row, endRow: row, startCol, endCol }
      }
    } else {
      // Find start and end of down word
      let startRow = row
      while (startRow > 0 && !mainController.isCellBlocked(startRow - 1, col)) {
        startRow--
      }
      let endRow = row
      while (endRow < gridHeight - 1 && !mainController.isCellBlocked(endRow + 1, col)) {
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
  moveToNextUnfilledWord(selectedRow, selectedCol, direction) {
    console.log(`Word navigation: moveToNextUnfilledWord called from (${selectedRow}, ${selectedCol}) direction: ${direction}`)
    
    const mainController = this.getMainController()
    if (!mainController) return null

    // Ensure clues data is loaded via play mode clue management controller
    const cluesData = mainController.delegateToController('play-mode-clue-management', 'getCluesData')
    if (!cluesData) {
      console.log('Clues data not loaded, attempting to load now')
      mainController.delegateToController('play-mode-clue-management', 'reloadCluesData')
    }
    
    const playModeController = mainController.getController('play-mode-operations')
    if (playModeController) {
      console.log('Found play mode controller, calling moveToNextUnfilledWord')
      const nextPosition = playModeController.moveToNextUnfilledWord(cluesData, mainController.gridData, direction, selectedRow, selectedCol)
      if (nextPosition) {
        console.log(`Moving to next position: (${nextPosition.row}, ${nextPosition.col}) direction: ${nextPosition.direction}`)
        return nextPosition
      } else {
        console.log('No next unfilled word found by play mode controller')
      }
    } else {
      console.log('No play mode controller found')
    }

    // Return null to indicate fallback to normal navigation
    return null
  }

  // Move to the previous unfilled word in the current direction, or switch directions
  moveToPreviousUnfilledWord(selectedRow, selectedCol, direction) {
    console.log(`Word navigation: moveToPreviousUnfilledWord called from (${selectedRow}, ${selectedCol}) direction: ${direction}`)
    
    const mainController = this.getMainController()
    if (!mainController) return null

    const cluesData = mainController.delegateToController('play-mode-clue-management', 'getCluesData')
    const playModeController = mainController.getController('play-mode-operations')
    if (playModeController) {
      console.log('Found play mode controller, calling moveToPreviousUnfilledWord')
      const prevPosition = playModeController.moveToPreviousUnfilledWord(cluesData, mainController.gridData, direction, selectedRow, selectedCol)
      if (prevPosition) {
        console.log(`Moving to previous position: (${prevPosition.row}, ${prevPosition.col}) direction: ${prevPosition.direction}`)
        return prevPosition
      } else {
        console.log('No previous unfilled word found by play mode controller')
      }
    } else {
      console.log('No play mode controller found')
    }

    // Return null to indicate fallback to normal navigation
    return null
  }

  // Get the number of the current word
  getCurrentWordNumber(selectedRow, selectedCol, gridData) {
    const mainController = this.getMainController()
    if (!mainController) return null

    const numbering = mainController.calculateGridNumbering(gridData)
    const wordBounds = this.getCurrentWordBounds(selectedRow, selectedCol, mainController.direction, gridData, mainController.gridWidth, mainController.gridHeight)
    if (!wordBounds) return null

    // For both across and down, we want the starting position of the word
    const startKey = `${wordBounds.startRow},${wordBounds.startCol}`
    return numbering[startKey] || null
  }

  // Get information about the current word at a position
  getCurrentWordInfo(row, col, direction, gridData) {
    const mainController = this.getMainController()
    if (!mainController) return null

    // Delegate to grid management controller
    const gridController = mainController.getController('grid-management')
    if (gridController) {
      return gridController.getCurrentWordInfo(row, col, direction, gridData)
    }
    
    console.error('Grid management controller not found for getCurrentWordInfo')
    return null
  }

  // Check if a word is completely filled (for auto-advance logic)
  shouldAutoAdvance(row, col, direction, mode) {
    if (mode !== 'play') return false
    
    return this.isWordComplete(row, col, direction)
  }

  // Handle word completion auto-advance
  handleWordCompletion(row, col, direction, mode) {
    if (this.shouldAutoAdvance(row, col, direction, mode)) {
      console.log('Word completed at', row, col, '- auto-advancing to next unfilled word')
      const nextPosition = this.moveToNextUnfilledWord(row, col, direction)
      if (nextPosition) {
        return nextPosition
      }
    }
    return null
  }
}
