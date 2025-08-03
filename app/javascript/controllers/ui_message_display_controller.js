// UI Message & Display Management Controller - Aug 2, 2025
import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = []
  static values = {}

  connect() {
    // Ready to handle UI messages and display updates
  }

  // Get access to main controller for grid data access
  getMainController() {
    return this.application.getControllerForElementAndIdentifier(this.element, 'crossword-game')
  }

  // Handle show message events from other controllers
  handleShowMessage(event) {
    const { text, type } = event.detail
    this.showMessage(text, type)
  }

  // Set a cell value by delegating to grid management controller
  setCellValue(row, col, value) {
    const mainController = this.getMainController()
    if (mainController) {
      const gridController = mainController.getController('grid-management')
      if (gridController) {
        gridController.setCellValue(row, col, value, mainController.gridData)
      }
    }
  }

  // Clear error styling from a cell
  clearCellError(row, col) {
    const mainController = this.getMainController()
    if (mainController) {
      const cell = mainController.getCellElement(row, col)
      if (cell) {
        cell.classList.remove('error')
      }
    }
  }

  // Fill an entire word with the answer letters
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

  // Show the puzzle completion celebration message
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

  // Show a temporary message to the user
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

  // Show error message with error styling
  showError(text) {
    this.showMessage(text, 'danger')
  }

  // Show success message with success styling
  showSuccess(text) {
    this.showMessage(text, 'success')
  }

  // Show warning message with warning styling
  showWarning(text) {
    this.showMessage(text, 'warning')
  }

  // Clear all active messages
  clearMessages() {
    const messages = this.element.querySelectorAll('.puzzle-message')
    messages.forEach(message => {
      if (message.parentElement) {
        message.remove()
      }
    })
  }
}
