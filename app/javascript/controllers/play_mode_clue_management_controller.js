// Play Mode Clue Management Controller - Aug 2, 2025
import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = []
  static values = {
    mode: String
  }

  connect() {
    this.cluesData = { across: [], down: [] }
    this.currentClue = null
    
    // Only initialize for play mode
    if (this.modeValue === 'play') {
      this.loadCluesData()
      this.bindClueClickEvents()
    }
  }

  // Bind click events to clue items
  bindClueClickEvents() {
    // Delegate clue clicks to this controller
    this.element.addEventListener('click', this.handleClueClick.bind(this))
  }

  // Get access to main controller for state and delegation
  getMainController() {
    return this.application.getControllerForElementAndIdentifier(this.element, 'crossword-game')
  }

  // Load clues data from various sources
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

  // Protect server-rendered clues from being overwritten
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

  // Handle clicks on clue items
  handleClueClick(event) {
    const clueItem = event.target.closest('.clue-item')
    if (!clueItem) return

    event.preventDefault()
    
    const direction = clueItem.dataset.direction
    const number = parseInt(clueItem.dataset.number)
    const row = parseInt(clueItem.dataset.row)
    const col = parseInt(clueItem.dataset.col)

    // Notify main controller to change direction and select cell
    const mainController = this.getMainController()
    if (mainController) {
      mainController.direction = direction
      mainController.selectCell(row, col)
    }
    
    this.setActiveClue(clueItem, direction, number)
  }

  // Set the active clue and update display
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

  // Scroll clue item into view within the clues panel
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

  // Update the current clue display area
  updateCurrentClueDisplay(direction, number, clueText, clueLength) {
    const titleElement = this.element.querySelector('#current-clue-title')
    const textElement = this.element.querySelector('#current-clue-text')

    if (titleElement && textElement) {
      titleElement.textContent = `${number} ${direction.charAt(0).toUpperCase() + direction.slice(1)}`
      textElement.textContent = `${clueText} ${clueLength}`
    }
  }

  // Update current clue based on grid position and direction
  updateCurrentClueFromPosition(row, col, direction) {
    if (!this.cluesData) return

    // Find the clue that matches the current position and direction
    const clues = this.cluesData[direction] || []
    const matchingClue = clues.find(clue => {
      if (direction === 'across') {
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
        `.clue-item[data-direction="${direction}"][data-number="${matchingClue.number}"]`
      )
      if (clueItem) {
        this.setActiveClue(clueItem, direction, matchingClue.number)
      }
    }
  }

  // Public method for accessing clues data
  getCluesData() {
    return this.cluesData
  }

  // Public method for accessing current clue
  getCurrentClue() {
    return this.currentClue
  }

  // Public method to reload clues data
  reloadCluesData() {
    this.loadCluesData()
  }
}
