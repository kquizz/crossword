import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static values = {
    mode: String
  }

  connect() {
    console.log("Keyboard Handler Controller connected")
    
    // Bind the main keydown handler
    document.addEventListener('keydown', this.handleKeydown.bind(this))
  }

  disconnect() {
    // Clean up event listener
    document.removeEventListener('keydown', this.handleKeydown.bind(this))
  }

  // Get reference to main controller for state access
  get mainController() {
    return this.application.getControllerForElementAndIdentifier(this.element, 'crossword-game')
  }

  handleKeydown(event) {
    const mainController = this.mainController
    if (!mainController) return
    
    // Don't handle keydown if user is typing in a form field
    if (this.shouldIgnoreKeydown(event)) return
    if (!mainController.selectedCell) return

    const context = this.getKeydownContext(event, mainController)
    
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

  getKeydownContext(event, mainController) {
    return {
      row: mainController.selectedRow,
      col: mainController.selectedCol,
      key: event.key,
      isShiftModifier: event.shiftKey,
      isBlockMode: mainController.modeValue === 'create' && mainController.isBlockMode,
      isPlayMode: mainController.modeValue === 'play',
      isCreateMode: mainController.modeValue === 'create'
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
    const navigationController = this.application.getControllerForElementAndIdentifier(this.element, 'navigation')
    const gridController = this.application.getControllerForElementAndIdentifier(this.element, 'grid-management')
    const mainController = this.mainController
    
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
        if (gridController && mainController) {
          gridController.toggleBlock(context.row, context.col, mainController.gridData)
        }
      }
    }
  }

  // Configuration for letter mode key handlers
  getLetterModeKeyHandlers() {
    const navigationController = this.application.getControllerForElementAndIdentifier(this.element, 'navigation')
    
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
    const mainController = this.mainController
    const navigationController = this.application.getControllerForElementAndIdentifier(this.element, 'navigation')
    
    if (mainController) {
      mainController.direction = direction
    }
    
    if (navigationController) {
      navigationController.updateDirection(direction)
      navigationController.moveSelection(newRow, newCol)
    }
  }

  handleDeleteKey(context, moveBackward) {
    const gridController = this.application.getControllerForElementAndIdentifier(this.element, 'grid-management')
    const navigationController = this.application.getControllerForElementAndIdentifier(this.element, 'navigation')
    const mainController = this.mainController
    
    if (gridController && mainController) {
      gridController.setCellValue(context.row, context.col, '', mainController.gridData)
    } else {
      console.error('Grid management controller not found')
      return
    }
    
    if (navigationController) {
      navigationController.moveInDirection(context.row, context.col, moveBackward)
    }
  }

  handleSpaceKey(context) {
    const gridController = this.application.getControllerForElementAndIdentifier(this.element, 'grid-management')
    const navigationController = this.application.getControllerForElementAndIdentifier(this.element, 'navigation')
    const mainController = this.mainController
    
    if (context.isCreateMode) {
      if (gridController && mainController) {
        gridController.toggleBlock(context.row, context.col, mainController.gridData)
      }
    } else {
      if (navigationController) {
        navigationController.moveInDirection(context.row, context.col, false)
      }
    }
  }

  handleTabKey(context, event) {
    console.log('Tab pressed, shiftKey:', event.shiftKey, 'mode:', this.modeValue)
    const mainController = this.mainController
    
    if (context.isPlayMode && mainController) {
      // In play mode, use unfilled word navigation
      if (event.shiftKey) {
        console.log('Calling moveToPreviousUnfilledWord')
        mainController.moveToPreviousUnfilledWord()
      } else {
        console.log('Calling moveToNextUnfilledWord')
        mainController.moveToNextUnfilledWord()
      }
    } else {
      // In create mode, use basic word navigation
      const navigationController = this.application.getControllerForElementAndIdentifier(this.element, 'navigation')
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
    const gridController = this.application.getControllerForElementAndIdentifier(this.element, 'grid-management')
    const navigationController = this.application.getControllerForElementAndIdentifier(this.element, 'navigation')
    const mainController = this.mainController
    
    if (gridController && mainController) {
      gridController.setCellValue(context.row, context.col, letter, mainController.gridData)
    } else {
      console.error('Grid management controller not found')
      return
    }
    
    // Handle auto-advance in play mode
    if (context.isPlayMode && mainController && mainController.isWordComplete(context.row, context.col)) {
      console.log('Word completed at', context.row, context.col, '- auto-advancing to next unfilled word')
      mainController.moveToNextUnfilledWord()
    } else {
      if (navigationController) {
        navigationController.moveInDirection(context.row, context.col, false)
      }
    }
  }

  toggleDirection() {
    const mainController = this.mainController
    if (!mainController) return
    
    // Don't toggle direction in block mode
    if (mainController.modeValue === 'create' && mainController.isBlockMode) {
      return
    }

    mainController.direction = mainController.direction === 'across' ? 'down' : 'across'
    
    // Clear and update highlights
    const highlightController = this.application.getControllerForElementAndIdentifier(this.element, 'highlight')
    if (highlightController) {
      highlightController.clearHighlights()
      highlightController.highlightCurrentWord(mainController.selectedRow, mainController.selectedCol, mainController.direction, mainController.gridData)
    }
    
    // Notify navigation controller to update direction indicator
    const navigationController = this.application.getControllerForElementAndIdentifier(this.element, 'navigation')
    if (navigationController) {
      navigationController.updateDirection(mainController.direction)
      navigationController.updateDirectionIndicator()
    }
    
    // Update clue highlighting for the new direction in play mode
    if (mainController.modeValue === 'play' && mainController.selectedRow !== undefined && mainController.selectedCol !== undefined) {
      const clueDisplayController = this.application.getControllerForElementAndIdentifier(this.element, 'clue-display')
      if (clueDisplayController) {
        clueDisplayController.updateCurrentClueFromPosition(mainController.selectedRow, mainController.selectedCol, mainController.direction)
      }
    }
    
    // Update clue suggestions for the new direction in create mode
    if (mainController.modeValue === 'create' && mainController.selectedRow !== undefined && mainController.selectedCol !== undefined) {
      const currentWord = mainController.getCurrentWordInfo(mainController.selectedRow, mainController.selectedCol)
      if (currentWord) {
        const clueController = this.application.getControllerForElementAndIdentifier(this.element, 'clue-suggestions')
        if (clueController) {
          clueController.updateCluesSuggestions(mainController.selectedRow, mainController.selectedCol, currentWord, mainController.gridData)
        }
      }
    }
  }
}
